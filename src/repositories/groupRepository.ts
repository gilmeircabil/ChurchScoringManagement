import { IDatabaseConnection } from '../database/types';
import { Group, AssignedMember, GroupDetail, Player } from '../types';
import { generateId } from '../utils/idGenerator';
import { UserFacingError } from '../utils/errors';
import {
  computeItemsBonus,
  ensureScoreRow,
  recomputeGroupQuizScore,
  syncMemberScoresToGroupCarry,
} from './groupScoring';

export class GroupRepository {
  private db: IDatabaseConnection;

  constructor(db: IDatabaseConnection) {
    this.db = db;
  }

  async getGroupsByRoundId(roundId: string): Promise<Group[]> {
    return await this.db.getAllAsync<Group>(
      'SELECT * FROM groups WHERE round_id = ? ORDER BY group_number ASC',
      roundId
    );
  }

  async getPlayerAssignmentInRound(
    roundId: string,
    playerId: string
  ): Promise<{ group_id: string; group_number: number; member_id: string } | null> {
    const row = await this.db.getFirstAsync<{
      group_id: string;
      group_number: number;
      member_id: string;
    }>(
      `SELECT
        gm.id AS member_id,
        gm.group_id,
        g.group_number
       FROM group_members gm
       JOIN groups g ON gm.group_id = g.id
       WHERE gm.round_id = ? AND gm.player_id = ?`,
      roundId,
      playerId
    );
    return row ?? null;
  }

  async getAssignedMembers(roundId: string): Promise<AssignedMember[]> {
    return await this.db.getAllAsync<AssignedMember>(
      `SELECT
        gm.id AS group_member_id,
        gm.group_id,
        g.group_number,
        p.id AS player_id,
        p.name AS player_name,
        p.player_number,
        COALESCE(s.points, 0) AS round_score
       FROM group_members gm
       JOIN groups g ON gm.group_id = g.id
       JOIN players p ON gm.player_id = p.id
       LEFT JOIN scores s ON s.round_id = gm.round_id AND s.player_id = gm.player_id
       WHERE gm.round_id = ?
       ORDER BY g.group_number ASC, p.name COLLATE NOCASE ASC, p.player_number ASC`,
      roundId
    );
  }

  async getGroupDetails(roundId: string): Promise<GroupDetail[]> {
    const groups = await this.getGroupsByRoundId(roundId);
    const assignedMembers = await this.getAssignedMembers(roundId);

    return groups.map((g) => {
      const members = assignedMembers.filter((m) => m.group_id === g.id);
      const quiz_score =
        g.quiz_score !== undefined && g.quiz_score !== null
          ? g.quiz_score
          : members.reduce((sum, m) => sum + (m.round_score || 0), 0);
      const book_count = g.book_count ?? 0;
      const pen_count = g.pen_count ?? 0;
      const paper_count = g.paper_count ?? 0;
      const book_points = g.book_points ?? 10;
      const pen_points = g.pen_points ?? 5;
      const paper_points = g.paper_points ?? 5;
      const items_bonus = computeItemsBonus(g);
      const total_score = quiz_score + items_bonus;

      const book_name = g.book_name || 'Book';
      const pen_name = g.pen_name || 'Pen';
      const paper_name = g.paper_name || 'Paper';

      return {
        id: g.id,
        group_number: g.group_number,
        name: g.name ?? null,
        members,
        book_count,
        pen_count,
        paper_count,
        book_points,
        pen_points,
        paper_points,
        book_name,
        pen_name,
        paper_name,
        quiz_score,
        items_bonus,
        total_score,
      };
    });
  }

  async getUnassignedPlayers(roundId: string, searchQuery?: string): Promise<Player[]> {
    let sql = `
      SELECT p.*
      FROM players p
      WHERE p.active = 1
        AND p.id NOT IN (
          SELECT player_id FROM group_members WHERE round_id = ?
        )
    `;
    const params: any[] = [roundId];

    if (searchQuery && searchQuery.trim().length > 0) {
      sql += ' AND LOWER(p.name) LIKE ?';
      params.push(`%${searchQuery.trim().toLowerCase()}%`);
    }

    sql += ' ORDER BY p.name COLLATE NOCASE ASC, p.player_number ASC';

    return await this.db.getAllAsync<Player>(sql, ...params);
  }

  async getCountsForRound(roundId: string): Promise<{
    totalPlayers: number;
    assignedCount: number;
    unassignedCount: number;
  }> {
    const totalRow = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM players WHERE active = 1'
    );
    const assignedRow = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(DISTINCT player_id) as count FROM group_members WHERE round_id = ?',
      roundId
    );

    const total = totalRow?.count ?? 0;
    const assigned = assignedRow?.count ?? 0;
    const unassigned = Math.max(0, total - assigned);

    return {
      totalPlayers: total,
      assignedCount: assigned,
      unassignedCount: unassigned,
    };
  }

  /**
   * Assigns a player to a group in a round.
   * If the player was previously in another group in the same round, replaces it atomically.
   *
   * The player's own score for the round is deliberately left untouched: moving
   * a player between groups must not rewrite a score that has already been
   * recorded. A missing score row is created at zero so the player still appears
   * in the round's score list.
   */
  async assignPlayerToGroup(roundId: string, groupId: string, playerId: string): Promise<void> {
    const id = generateId();
    const now = new Date().toISOString();

    await this.db.withTransactionAsync(async () => {
      // Check if round is locked
      const round = await this.db.getFirstAsync<{ status: string }>(
        'SELECT status FROM rounds WHERE id = ?',
        roundId
      );
      if (round?.status === 'LOCKED') {
        throw new UserFacingError('This round is locked. Unlock the round before making changes.');
      }

      // Remember the previous group so its quiz total can be re-derived.
      const previous = await this.db.getFirstAsync<{ group_id: string }>(
        'SELECT group_id FROM group_members WHERE round_id = ? AND player_id = ?',
        roundId,
        playerId
      );

      // Remove any existing assignment for this player in this round
      await this.db.runAsync(
        'DELETE FROM group_members WHERE round_id = ? AND player_id = ?',
        roundId,
        playerId
      );

      // Insert new assignment
      await this.db.runAsync(
        'INSERT INTO group_members (id, round_id, group_id, player_id, created_at) VALUES (?, ?, ?, ?, ?)',
        id,
        roundId,
        groupId,
        playerId,
        now
      );

      // Only seed a missing score row; never overwrite an existing one.
      await ensureScoreRow(this.db, roundId, playerId, now);

      if (previous && previous.group_id !== groupId) {
        await recomputeGroupQuizScore(this.db, roundId, previous.group_id);
      }
      await recomputeGroupQuizScore(this.db, roundId, groupId);
    });
  }

  /**
   * Removes a player from every group in a round.
   *
   * The player's score row for the round is kept: it is part of their permanent
   * history and feeds the cumulative total, so removing a group assignment must
   * not silently discard points the user has already recorded. The source
   * group's quiz total is re-derived so the group view stays consistent.
   */
  async removePlayerFromRound(roundId: string, playerId: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const round = await this.db.getFirstAsync<{ status: string }>(
        'SELECT status FROM rounds WHERE id = ?',
        roundId
      );
      if (round?.status === 'LOCKED') {
        throw new UserFacingError('This round is locked. Unlock the round before making changes.');
      }

      const previous = await this.db.getFirstAsync<{ group_id: string }>(
        'SELECT group_id FROM group_members WHERE round_id = ? AND player_id = ?',
        roundId,
        playerId
      );

      await this.db.runAsync(
        'DELETE FROM group_members WHERE round_id = ? AND player_id = ?',
        roundId,
        playerId
      );

      if (previous) {
        await recomputeGroupQuizScore(this.db, roundId, previous.group_id);
      }
    });
  }

  /**
   * Updates item carry counts, item names, and point values for a group, and optionally custom group name.
   */
  async updateGroupItems(
    groupId: string,
    data: {
      name?: string | null;
      book_count: number;
      pen_count: number;
      paper_count: number;
      book_points?: number;
      pen_points?: number;
      paper_points?: number;
      book_name?: string;
      pen_name?: string;
      paper_name?: string;
    }
  ): Promise<void> {
    const group = await this.db.getFirstAsync<Group>(
      'SELECT * FROM groups WHERE id = ?',
      groupId
    );
    if (!group) throw new UserFacingError('Group not found.');

    const round = await this.db.getFirstAsync<{ status: string }>(
      'SELECT status FROM rounds WHERE id = ?',
      group.round_id
    );
    if (round?.status === 'LOCKED') {
      throw new UserFacingError('This round is locked. Unlock the round before making changes.');
    }

    const bCount = Math.max(0, data.book_count || 0);
    const pCount = Math.max(0, data.pen_count || 0);
    const paCount = Math.max(0, data.paper_count || 0);
    const bPts =
      typeof data.book_points === 'number'
        ? Math.max(0, data.book_points)
        : (group.book_points ?? 10);
    const pPts =
      typeof data.pen_points === 'number'
        ? Math.max(0, data.pen_points)
        : (group.pen_points ?? 5);
    const paPts =
      typeof data.paper_points === 'number'
        ? Math.max(0, data.paper_points)
        : (group.paper_points ?? 5);
    const bName = (data.book_name && data.book_name.trim()) || group.book_name || 'Book';
    const pName = (data.pen_name && data.pen_name.trim()) || group.pen_name || 'Pen';
    const paName = (data.paper_name && data.paper_name.trim()) || group.paper_name || 'Paper';
    const groupName = data.name !== undefined ? (data.name?.trim() || null) : (group.name ?? null);

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE groups 
         SET name = ?, book_count = ?, pen_count = ?, paper_count = ?, book_points = ?, pen_points = ?, paper_points = ?, book_name = ?, pen_name = ?, paper_name = ?
         WHERE id = ?`,
        groupName,
        bCount,
        pCount,
        paCount,
        bPts,
        pPts,
        paPts,
        bName,
        pName,
        paName,
        groupId
      );

      // Carry total is added to player also: sync all members of this group in
      // this round. `quiz_score` is intentionally left as-is: changing the items
      // bonus must not change the group's own quiz total.
      await syncMemberScoresToGroupCarry(this.db, group.round_id, groupId);
    });
  }

  /**
   * Updates item names and point values across all groups in a round.
   */
  async updateRoundItemRules(
    roundId: string,
    rules: {
      book_points: number;
      pen_points: number;
      paper_points: number;
      book_name?: string;
      pen_name?: string;
      paper_name?: string;
    }
  ): Promise<void> {
    const round = await this.db.getFirstAsync<{ status: string }>(
      'SELECT status FROM rounds WHERE id = ?',
      roundId
    );
    if (round?.status === 'LOCKED') {
      throw new UserFacingError('This round is locked. Unlock the round before making changes.');
    }

    const bPts = Math.max(0, rules.book_points);
    const pPts = Math.max(0, rules.pen_points);
    const paPts = Math.max(0, rules.paper_points);
    const bName = rules.book_name?.trim() || 'Book';
    const pName = rules.pen_name?.trim() || 'Pen';
    const paName = rules.paper_name?.trim() || 'Paper';

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        'UPDATE groups SET book_points = ?, pen_points = ?, paper_points = ?, book_name = ?, pen_name = ?, paper_name = ? WHERE round_id = ?',
        bPts,
        pPts,
        paPts,
        bName,
        pName,
        paName,
        roundId
      );

      // Re-synchronize member carries for all groups in this round. Each group
      // keeps its own quiz_score; only the bonus component changes.
      const groupsInRound = await this.db.getAllAsync<{ id: string }>(
        'SELECT id FROM groups WHERE round_id = ?',
        roundId
      );
      for (const g of groupsInRound) {
        await syncMemberScoresToGroupCarry(this.db, roundId, g.id);
      }
    });
  }

  /**
   * Updates the point values for items across all groups in a round (backward-compatible).
   */
  async updateRoundItemPoints(
    roundId: string,
    points: {
      book_points: number;
      pen_points: number;
      paper_points: number;
    }
  ): Promise<void> {
    await this.updateRoundItemRules(roundId, points);
  }
}
