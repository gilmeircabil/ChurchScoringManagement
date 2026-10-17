import { IDatabaseConnection } from '../database/types';
import { Score, PlayerWithStats } from '../types';
import { UserFacingError } from '../utils/errors';
import { computeMemberCarry, recomputeGroupQuizScore, upsertScore, upsertIndividualBonus } from './groupScoring';

export class ScoreRepository {
  private db: IDatabaseConnection;

  constructor(db: IDatabaseConnection) {
    this.db = db;
  }

  /**
   * Verifies a round exists and is accepting score changes.
   * Must be called inside a transaction.
   */
  private async assertRoundIsScorable(roundId: string): Promise<void> {
    const round = await this.db.getFirstAsync<{ status: string }>(
      'SELECT status FROM rounds WHERE id = ?',
      roundId
    );

    if (!round) {
      throw new UserFacingError('Round not found.');
    }
    if (round.status === 'LOCKED') {
      throw new UserFacingError('This round is locked. Unlock the round before making changes.');
    }
    if (round.status !== 'ACTIVE') {
      throw new UserFacingError(
        'This round has not started. Start the round before recording scores.'
      );
    }
  }

  async getScore(roundId: string, playerId: string): Promise<Score | null> {
    return await this.db.getFirstAsync<Score>(
      'SELECT * FROM scores WHERE round_id = ? AND player_id = ?',
      roundId,
      playerId
    );
  }

  /**
   * Sets or updates an individual player's bonus round points for a specific round.
   * Only affects the player's personal score and NEVER modifies the group's quiz score.
   * Can be awarded when the round is ACTIVE or after the round is LOCKED/Finished.
   */
  async saveIndividualBonus(roundId: string, playerId: string, bonusPoints: number): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const round = await this.db.getFirstAsync<{ status: string }>(
        'SELECT status FROM rounds WHERE id = ?',
        roundId
      );

      if (!round) {
        throw new UserFacingError('Round not found.');
      }
      if (round.status === 'DRAFT') {
        throw new UserFacingError(
          'This round has not started yet. Start the round before recording bonus points.'
        );
      }

      await upsertIndividualBonus(this.db, roundId, playerId, bonusPoints);
    });
  }

  /**
   * Sets or updates a player's score for a specific round.
   * Replaces the score for that round rather than adding on top.
   * Scores can only be recorded once the round is ACTIVE.
   */
  async saveScore(roundId: string, playerId: string, points: number): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.assertRoundIsScorable(roundId);

      await upsertScore(this.db, roundId, playerId, points);

      // Keep the owning group's quiz total in step with the members' scores.
      // The player's own historical score is never rewritten here.
      const groupMember = await this.db.getFirstAsync<{ group_id: string }>(
        'SELECT group_id FROM group_members WHERE round_id = ? AND player_id = ?',
        roundId,
        playerId
      );
      if (groupMember) {
        await recomputeGroupQuizScore(this.db, roundId, groupMember.group_id);
      }
    });
  }

  /**
   * Sets or updates the quiz score for an entire group in a specific round.
   * Updates the group's quiz_score and synchronizes all group members' scores in this round.
   */
  async saveGroupScore(roundId: string, groupId: string, points: number): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.assertRoundIsScorable(roundId);

      const group = await this.db.getFirstAsync<Parameters<typeof computeMemberCarry>[0]>(
        'SELECT * FROM groups WHERE id = ?',
        groupId
      );
      if (!group) {
        throw new UserFacingError('Group not found.');
      }

      // The entered value is the group's own quiz total; the item bonus is
      // added on top when carrying it to members.
      await this.db.runAsync(
        'UPDATE groups SET quiz_score = ? WHERE id = ?',
        points,
        groupId
      );

      const groupWithScore = { ...group, quiz_score: points };
      const carry = computeMemberCarry(groupWithScore);

      const members = await this.db.getAllAsync<{ player_id: string }>(
        'SELECT player_id FROM group_members WHERE round_id = ? AND group_id = ?',
        roundId,
        groupId
      );

      const now = new Date().toISOString();
      for (const member of members) {
        await upsertScore(this.db, roundId, member.player_id, carry, now);
      }
    });
  }

  /**
   * Computes cumulative total score directly from the scores table.
   * Scores belong permanently to the individual player, including any bonus round points.
   */
  async getPlayerTotalScore(playerId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number | null }>(
      `SELECT (COALESCE(p.initial_score, 0) + COALESCE(SUM(s.points + s.bonus_points), 0)) AS total
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
        (COALESCE(p.initial_score, 0) + COALESCE(SUM(s.points + s.bonus_points), 0)) AS total_score,
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
