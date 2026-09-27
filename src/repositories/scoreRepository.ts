import { IDatabaseConnection } from '../database/types';
import { Score, PlayerWithStats, Group } from '../types';
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
   * Scores can only be recorded once the round is ACTIVE.
   */
  async saveScore(roundId: string, playerId: string, points: number): Promise<void> {
    const now = new Date().toISOString();

    await this.db.withTransactionAsync(async () => {
      const round = await this.db.getFirstAsync<{ status: string }>(
        'SELECT status FROM rounds WHERE id = ?',
        roundId
      );

      if (!round) {
        throw new Error('Round not found.');
      }
      if (round.status === 'LOCKED') {
        throw new Error('This round is locked. Unlock the round before making changes.');
      }
      if (round.status !== 'ACTIVE') {
        throw new Error('This round has not started. Start the round before recording scores.');
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

      // Synchronize group quiz_score if player belongs to a group
      const groupMember = await this.db.getFirstAsync<{ group_id: string }>(
        'SELECT group_id FROM group_members WHERE round_id = ? AND player_id = ?',
        roundId,
        playerId
      );
      if (groupMember) {
        const sumRow = await this.db.getFirstAsync<{ total: number }>(
          `SELECT COALESCE(SUM(s.points), 0) as total
           FROM group_members gm
           JOIN scores s ON s.round_id = gm.round_id AND s.player_id = gm.player_id
           WHERE gm.round_id = ? AND gm.group_id = ?`,
          roundId,
          groupMember.group_id
        );
        await this.db.runAsync(
          'UPDATE groups SET quiz_score = ? WHERE id = ?',
          sumRow?.total ?? 0,
          groupMember.group_id
        );
      }
    });
  }

  /**
   * Sets or updates the quiz score for an entire group in a specific round.
   * Updates the group's quiz_score and synchronizes all group members' scores in this round.
   */
  async saveGroupScore(roundId: string, groupId: string, points: number): Promise<void> {
    const now = new Date().toISOString();

    await this.db.withTransactionAsync(async () => {
      const round = await this.db.getFirstAsync<{ status: string }>(
        'SELECT status FROM rounds WHERE id = ?',
        roundId
      );

      if (!round) {
        throw new Error('Round not found.');
      }
      if (round.status === 'LOCKED') {
        throw new Error('This round is locked. Unlock the round before making changes.');
      }
      if (round.status !== 'ACTIVE') {
        throw new Error('This round has not started. Start the round before recording scores.');
      }

      // Update group quiz_score
      await this.db.runAsync(
        'UPDATE groups SET quiz_score = ? WHERE id = ?',
        points,
        groupId
      );

      // Get group items bonus so carry total is added to player as well
      const group = await this.db.getFirstAsync<Group>(
        'SELECT * FROM groups WHERE id = ?',
        groupId
      );
      const bCount = group?.book_count ?? 0;
      const pCount = group?.pen_count ?? 0;
      const paCount = group?.paper_count ?? 0;
      const bPts = group?.book_points ?? 10;
      const pPts = group?.pen_points ?? 5;
      const paPts = group?.paper_points ?? 5;
      const itemsBonus = bCount * bPts + pCount * pPts + paCount * paPts;
      const totalPoints = points + itemsBonus;

      // Synchronize all members assigned to this group in this round
      const members = await this.db.getAllAsync<{ player_id: string }>(
        'SELECT player_id FROM group_members WHERE round_id = ? AND group_id = ?',
        roundId,
        groupId
      );

      for (const m of members) {
        const existing = await this.db.getFirstAsync<Score>(
          'SELECT id FROM scores WHERE round_id = ? AND player_id = ?',
          roundId,
          m.player_id
        );

        if (existing) {
          await this.db.runAsync(
            'UPDATE scores SET points = ?, updated_at = ? WHERE id = ?',
            totalPoints,
            now,
            existing.id
          );
        } else {
          const id = generateId();
          await this.db.runAsync(
            'INSERT INTO scores (id, round_id, player_id, points, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            id,
            roundId,
            m.player_id,
            totalPoints,
            now,
            now
          );
        }
      }
    });
  }

  /**
   * Computes cumulative total score directly from the scores table.
   * Scores belong permanently to the individual player.
   */
  async getPlayerTotalScore(playerId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number | null }>(
      `SELECT (COALESCE(p.initial_score, 0) + COALESCE(SUM(s.points), 0)) AS total
       FROM players p
       LEFT JOIN scores s ON s.player_id = p.id
       WHERE p.id = ?
       GROUP BY p.id`,
      playerId
    );
    return row?.total ?? 0;
  }

  /**
   * Gets current overall leader (highest cumulative score).
   */
  async getCurrentLeader(): Promise<PlayerWithStats | null> {
    const row = await this.db.getFirstAsync<any>(
      `SELECT
        p.*,
        (COALESCE(p.initial_score, 0) + COALESCE(SUM(s.points), 0)) AS total_score,
        COUNT(s.id) AS rounds_played
       FROM players p
       LEFT JOIN scores s ON s.player_id = p.id
       WHERE p.active = 1
       GROUP BY p.id
       ORDER BY total_score DESC, p.created_at ASC
       LIMIT 1`
    );
    if (!row) return null;
    return {
      ...row,
      initial_score: row.initial_score ?? 0,
      total_score: row.total_score ?? 0,
      rounds_played: row.rounds_played ?? 0,
    };
  }
}
