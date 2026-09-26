import { IDatabaseConnection } from '../database/types';
import { Score, PlayerWithStats } from '../types';
import { generateId } from '../utils/idGenerator';

export class ScoreRepository {
  private db: IDatabaseConnection;

  constructor(db: IDatabaseConnection) {
    this.db = db;
  }

  async getScore(roundId: string, playerId: string): Promise<Score | null> {
    return await this.db.getFirstAsync<Score>(
      'SELECT * FROM scores WHERE round_id = ? AND player_id = ?',
      roundId,
      playerId
    );
  }

  /**
   * Sets or updates a player's score for a specific round.
   * Replaces the score for that round rather than adding on top.
   */
  async saveScore(roundId: string, playerId: string, points: number): Promise<void> {
    const now = new Date().toISOString();

    await this.db.withTransactionAsync(async () => {
      // Check if round is locked
      const round = await this.db.getFirstAsync<{ status: string }>(
        'SELECT status FROM rounds WHERE id = ?',
        roundId
      );
      if (round?.status === 'LOCKED') {
        throw new Error('This round is locked. Unlock the round before making changes.');
      }

      const existing = await this.db.getFirstAsync<Score>(
        'SELECT id FROM scores WHERE round_id = ? AND player_id = ?',
        roundId,
        playerId
      );

      if (existing) {
        await this.db.runAsync(
          'UPDATE scores SET points = ?, updated_at = ? WHERE id = ?',
          points,
          now,
          existing.id
        );
      } else {
        const id = generateId();
        await this.db.runAsync(
          'INSERT INTO scores (id, round_id, player_id, points, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          id,
          roundId,
          playerId,
          points,
          now,
          now
        );
      }
    });
  }

  /**
   * Computes cumulative total score directly from the scores table.
   * Scores belong permanently to the individual player.
   */
  async getPlayerTotalScore(playerId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number | null }>(
      'SELECT COALESCE(SUM(points), 0) AS total FROM scores WHERE player_id = ?',
      playerId
    );
    return row?.total ?? 0;
  }

  /**
   * Gets current overall leader (highest cumulative score).
   */
  async getCurrentLeader(): Promise<PlayerWithStats | null> {
    const row = await this.db.getFirstAsync<PlayerWithStats>(
      `SELECT
        p.*,
        COALESCE(SUM(s.points), 0) AS total_score,
        COUNT(s.id) AS rounds_played
       FROM players p
       JOIN scores s ON s.player_id = p.id
       WHERE p.active = 1
       GROUP BY p.id
       ORDER BY total_score DESC, p.created_at ASC
       LIMIT 1`
    );
    return row ?? null;
  }
}
