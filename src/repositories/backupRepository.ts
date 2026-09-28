import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { IDatabaseConnection } from '../database/types';
import { BackupData, Player, Round, Group, GroupMember, Score } from '../types';
import { APP_CONFIG } from '../constants/config';
import { validateBackupData } from '../utils/backupValidation';
import { UserFacingError } from '../utils/errors';
import { logWarn } from '../utils/logger';

export class BackupRepository {
  private db: IDatabaseConnection;

  constructor(db: IDatabaseConnection) {
    this.db = db;
  }

  /**
   * Generates complete backup data structure from current database.
   */
  async generateBackupData(): Promise<BackupData> {
    const players = await this.db.getAllAsync<Player>('SELECT * FROM players ORDER BY player_number ASC');
    const rounds = await this.db.getAllAsync<Round>('SELECT * FROM rounds ORDER BY round_date ASC, created_at ASC');
    const groups = await this.db.getAllAsync<Group>(
      'SELECT * FROM groups ORDER BY round_id ASC, group_number ASC'
    );
    const groupMembers = await this.db.getAllAsync<GroupMember>('SELECT * FROM group_members ORDER BY created_at ASC');
    const scores = await this.db.getAllAsync<Score>('SELECT * FROM scores ORDER BY created_at ASC');

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      players,
      rounds,
      groups,
      groupMembers,
      scores,
    };
  }

  /**
   * Exports backup to a JSON file and prompts native share sheet if available.
   */
  async exportToFile(): Promise<{ success: boolean; filePath?: string; jsonString: string }> {
    const backupData = await this.generateBackupData();
    const jsonString = JSON.stringify(backupData, null, 2);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${APP_CONFIG.exportFileNamePrefix}_${timestamp}.json`;

      // Web environment: trigger browser download
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return { success: true, jsonString };
      }

      // If documentDirectory is available (mobile environment)
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      if (baseDir) {
        const filePath = `${baseDir}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, jsonString, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'application/json',
            dialogTitle: 'Export Quiz Score Backup',
            UTI: 'public.json',
          });
        }
        return { success: true, filePath, jsonString };
      }
    } catch (err) {
      logWarn('BackupRepository.exportToFile', err);
    }

    return { success: true, jsonString };
  }

  /**
   * Validates structure, types, and referential integrity of a backup payload.
   * See `validateBackupData` for the full rule set.
   */
  validateBackupData(data: unknown): { isValid: boolean; error?: string } {
    return validateBackupData(data);
  }

  /**
   * Atomically restores the database from a validated backup.
   *
   * The whole database is replaced inside a single transaction, so a failure
   * part-way through rolls back and leaves the existing data untouched. The
   * caller is responsible for confirming the destructive replacement with the
   * user first.
   */
  async restoreFromData(data: unknown): Promise<void> {
    const validation = validateBackupData(data);
    if (!validation.isValid) {
      throw new UserFacingError(validation.error);
    }
    const backup = data as BackupData;

    await this.db.withTransactionAsync(async () => {
      // Clear existing records safely
      await this.db.runAsync('DELETE FROM scores');
      await this.db.runAsync('DELETE FROM group_members');
      await this.db.runAsync('DELETE FROM groups');
      await this.db.runAsync('DELETE FROM rounds');
      await this.db.runAsync('DELETE FROM players');

      // Insert players
      for (const p of backup.players) {
        await this.db.runAsync(
          'INSERT INTO players (id, player_number, name, initial_score, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          p.id,
          p.player_number,
          p.name,
          p.initial_score ?? 0,
          p.active ?? 1,
          p.created_at,
          p.updated_at
        );
      }

      // Insert rounds
      for (const r of backup.rounds) {
        await this.db.runAsync(
          'INSERT INTO rounds (id, round_date, group_count, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          r.id,
          r.round_date,
          r.group_count,
          r.status,
          r.created_at,
          r.updated_at
        );
      }

      // Insert groups. `quiz_score` is restored explicitly: re-deriving it would
      // lose group-level scores and change the group report after a restore.
      for (const g of backup.groups) {
        await this.db.runAsync(
          `INSERT INTO groups (id, round_id, group_number, name, quiz_score,
             book_count, pen_count, paper_count,
             book_points, pen_points, paper_points,
             book_name, pen_name, paper_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          g.id,
          g.round_id,
          g.group_number,
          g.name ?? null,
          g.quiz_score ?? 0,
          g.book_count ?? 0,
          g.pen_count ?? 0,
          g.paper_count ?? 0,
          g.book_points ?? 10,
          g.pen_points ?? 5,
          g.paper_points ?? 5,
          g.book_name || 'Book',
          g.pen_name || 'Pen',
          g.paper_name || 'Paper'
        );
      }

      // Insert group members
      for (const gm of backup.groupMembers) {
        await this.db.runAsync(
          'INSERT INTO group_members (id, round_id, group_id, player_id, created_at) VALUES (?, ?, ?, ?, ?)',
          gm.id,
          gm.round_id,
          gm.group_id,
          gm.player_id,
          gm.created_at
        );
      }

      // Insert scores
      for (const s of backup.scores) {
        await this.db.runAsync(
          'INSERT INTO scores (id, round_id, player_id, points, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          s.id,
          s.round_id,
          s.player_id,
          s.points,
          s.created_at,
          s.updated_at
        );
      }
    });
  }

  /**
   * Deletes all application data.
   */
  async deleteAllData(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM scores');
      await this.db.runAsync('DELETE FROM group_members');
      await this.db.runAsync('DELETE FROM groups');
      await this.db.runAsync('DELETE FROM rounds');
      await this.db.runAsync('DELETE FROM players');
    });
  }
}
