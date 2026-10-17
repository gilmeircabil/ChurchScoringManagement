import { IDatabaseConnection } from '../database/types';
import { Round, RoundStatus, RoundHistoryItem, ItemPointsConfig, ItemRuleConfig } from '../types';
import { generateId } from '../utils/idGenerator';
import { UserFacingError } from '../utils/errors';
import { GROUP_COLORS } from '../utils/groupColors';

export class RoundRepository {
  private db: IDatabaseConnection;

  constructor(db: IDatabaseConnection) {
    this.db = db;
  }

  async createRound(
    roundDate: string,
    groupCount: number,
    defaultRules?: Partial<ItemRuleConfig> & Partial<ItemPointsConfig>
  ): Promise<Round> {
    const roundId = generateId();
    const now = new Date().toISOString();
    const bookName = defaultRules?.book_name || 'Book';
    const penName = defaultRules?.pen_name || 'Pen';
    const paperName = defaultRules?.paper_name || 'Paper';
    const bibleName = defaultRules?.bible_name || 'Bible';
    const bookPts = defaultRules?.book_points ?? (defaultRules as any)?.book ?? 10;
    const penPts = defaultRules?.pen_points ?? (defaultRules as any)?.pen ?? 5;
    const paperPts = defaultRules?.paper_points ?? (defaultRules as any)?.paper ?? 5;
    const biblePts = defaultRules?.bible_points ?? (defaultRules as any)?.bible ?? 5;

    return await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        'INSERT INTO rounds (id, round_date, group_count, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        roundId,
        roundDate,
        groupCount,
        'DRAFT',
        now,
        now
      );

      for (let i = 1; i <= groupCount; i++) {
        const groupId = generateId();
        const defaultColor = GROUP_COLORS[(i - 1) % GROUP_COLORS.length];
        await this.db.runAsync(
          'INSERT INTO groups (id, round_id, group_number, name, book_count, pen_count, paper_count, bible_count, book_points, pen_points, paper_points, bible_points, book_name, pen_name, paper_name, bible_name) VALUES (?, ?, ?, ?, 0, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?)',
          groupId,
          roundId,
          i,
          defaultColor.name,
          bookPts,
          penPts,
          paperPts,
          biblePts,
          bookName,
          penName,
          paperName,
          bibleName
        );
      }

      return {
        id: roundId,
        round_date: roundDate,
        group_count: groupCount,
        status: 'DRAFT',
        created_at: now,
        updated_at: now,
      };
    });
  }

  async getRoundById(id: string): Promise<Round | null> {
    return await this.db.getFirstAsync<Round>('SELECT * FROM rounds WHERE id = ?', id);
  }

  /**
   * Returns current active round if one exists, otherwise null.
   * Only rounds actively in progress are treated as the current working round.
   */
  async getCurrentWorkingRound(): Promise<Round | null> {
    return await this.getActiveRound();
  }

  async getAllRounds(): Promise<Round[]> {
    return await this.db.getAllAsync<Round>(
      'SELECT * FROM rounds ORDER BY round_date DESC, created_at DESC'
    );
  }

  async getRoundHistoryList(): Promise<RoundHistoryItem[]> {
    return await this.db.getAllAsync<RoundHistoryItem>(
      `SELECT
        r.id,
        r.round_date,
        r.group_count,
        r.status,
        r.created_at,
        (SELECT COUNT(DISTINCT player_id) FROM group_members WHERE round_id = r.id) AS assigned_count
       FROM rounds r
       ORDER BY r.round_date DESC, r.created_at DESC`
    );
  }

  async updateRoundStatus(id: string, status: RoundStatus): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      'UPDATE rounds SET status = ?, updated_at = ? WHERE id = ?',
      status,
      now,
      id
    );
  }

  /**
   * Returns the first round still in progress, if any.
   */
  async getActiveRound(): Promise<Round | null> {
    return await this.db.getFirstAsync<Round>(
      "SELECT * FROM rounds WHERE status = 'ACTIVE' ORDER BY round_date DESC, created_at DESC LIMIT 1"
    );
  }

  /**
   * Permanently deletes a single round and all its groups, group members, and scores.
   * Players and their starting scores are preserved.
   */
  async deleteRound(id: string): Promise<void> {
    return await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM scores WHERE round_id = ?', id);
      await this.db.runAsync('DELETE FROM group_members WHERE round_id = ?', id);
      await this.db.runAsync('DELETE FROM groups WHERE round_id = ?', id);
      await this.db.runAsync('DELETE FROM rounds WHERE id = ?', id);
    });
  }

  /**
   * Erases every round along with its groups, group assignments and scores.
   * Players and their initial scores are preserved.
   * Refuses to run while a round is still ACTIVE.
   */
  async clearHistory(): Promise<number> {
    return await this.db.withTransactionAsync(async () => {
      const active = await this.db.getFirstAsync<{ id: string }>(
        "SELECT id FROM rounds WHERE status = 'ACTIVE' LIMIT 1"
      );
      if (active) {
        throw new UserFacingError(
          'A round is currently in progress. Lock or finish it before clearing history.'
        );
      }

      const total = await this.db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM rounds'
      );

      await this.db.runAsync('DELETE FROM scores');
      await this.db.runAsync('DELETE FROM group_members');
      await this.db.runAsync('DELETE FROM groups');
      await this.db.runAsync('DELETE FROM rounds');

      return total?.count ?? 0;
    });
  }
}
