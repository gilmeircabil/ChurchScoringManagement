import { IDatabaseConnection } from '../database/types';
import { Round, RoundStatus, RoundHistoryItem } from '../types';
import { generateId } from '../utils/idGenerator';

export class RoundRepository {
  private db: IDatabaseConnection;

  constructor(db: IDatabaseConnection) {
    this.db = db;
  }

  async createRound(roundDate: string, groupCount: number): Promise<Round> {
    const roundId = generateId();
    const now = new Date().toISOString();

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
        await this.db.runAsync(
          'INSERT INTO groups (id, round_id, group_number) VALUES (?, ?, ?)',
          groupId,
          roundId,
          i
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
   * Returns current active round if one exists, otherwise most recent draft round, or null.
   */
  async getCurrentWorkingRound(): Promise<Round | null> {
    // Check for ACTIVE first
    const active = await this.db.getFirstAsync<Round>(
      "SELECT * FROM rounds WHERE status = 'ACTIVE' ORDER BY round_date DESC, created_at DESC LIMIT 1"
    );
    if (active) return active;

    // Check for DRAFT next
    const draft = await this.db.getFirstAsync<Round>(
      "SELECT * FROM rounds WHERE status = 'DRAFT' ORDER BY round_date DESC, created_at DESC LIMIT 1"
    );
    if (draft) return draft;

    return null;
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
        throw new Error(
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
