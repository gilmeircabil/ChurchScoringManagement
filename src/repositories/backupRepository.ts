import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { IDatabaseConnection } from '../database/types';
import { BackupData, Player, Round, Group, GroupMember, Score } from '../types';
import { APP_CONFIG } from '../constants/config';

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
    const groups = await this.db.getAllAsync<Group>('SELECT * FROM groups ORDER BY group_number ASC');
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
      console.warn('File system export not available or failed:', err);
    }

    return { success: true, jsonString };
  }

  /**
   * Validates structure and types of backup payload.
   */
  validateBackupData(data: any): { isValid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { isValid: false, error: 'Backup file is invalid or corrupted (not valid JSON).' };
    }

    if (typeof data.version !== 'number' || data.version !== 1) {
      return { isValid: false, error: 'Unsupported backup version. Expected version 1.' };
    }

    if (
      !Array.isArray(data.players) ||
      !Array.isArray(data.rounds) ||
      !Array.isArray(data.groups) ||
      !Array.isArray(data.groupMembers) ||
      !Array.isArray(data.scores)
    ) {
      return {
        isValid: false,
        error: 'Backup file is missing required data tables (players, rounds, groups, groupMembers, scores).',
      };
    }

    // Validate player entries
    for (const p of data.players) {
      if (!p.id || typeof p.name !== 'string') {
        return { isValid: false, error: 'Corrupted player record found in backup.' };
      }
    }

    // Validate round entries
    for (const r of data.rounds) {
      if (!r.id || !r.round_date || typeof r.group_count !== 'number' || !r.status) {
        return { isValid: false, error: 'Corrupted round record found in backup.' };
      }
    }

    return { isValid: true };
  }

  /**
   * Atomically restores database from validated backup data.
   */
  async restoreFromData(data: BackupData): Promise<void> {
    const validation = this.validateBackupData(data);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid backup file.');
    }

    await this.db.withTransactionAsync(async () => {
      // Clear existing records safely
      await this.db.runAsync('DELETE FROM scores');
      await this.db.runAsync('DELETE FROM group_members');
      await this.db.runAsync('DELETE FROM groups');
      await this.db.runAsync('DELETE FROM rounds');
      await this.db.runAsync('DELETE FROM players');

      // Insert players
      for (const p of data.players) {
        await this.db.runAsync(
          'INSERT INTO players (id, player_number, name, initial_score, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          p.id,
          p.player_number || 1,
          p.name,
          p.initial_score ?? 0,
          p.active ?? 1,
          p.created_at,
          p.updated_at
        );
      }

      // Insert rounds
      for (const r of data.rounds) {
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

      // Insert groups
      for (const g of data.groups) {
        await this.db.runAsync(
          'INSERT INTO groups (id, round_id, group_number, book_count, pen_count, paper_count, book_points, pen_points, paper_points, name, book_name, pen_name, paper_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          g.id,
          g.round_id,
          g.group_number,
          g.book_count ?? 0,
          g.pen_count ?? 0,
          g.paper_count ?? 0,
          g.book_points ?? 10,
          g.pen_points ?? 5,
          g.paper_points ?? 5,
          g.name ?? null,
          g.book_name || 'Book',
          g.pen_name || 'Pen',
          g.paper_name || 'Paper'
        );
      }

      // Insert group members
      for (const gm of data.groupMembers) {
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
      for (const s of data.scores) {
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
