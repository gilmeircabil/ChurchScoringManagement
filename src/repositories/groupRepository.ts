import { IDatabaseConnection } from '../database/types';
import { Group, AssignedMember, GroupDetail, Player, Score } from '../types';
import { generateId } from '../utils/idGenerator';

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
      const items_bonus =
        book_count * book_points + pen_count * pen_points + paper_count * paper_points;
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
        throw new Error('This round is locked. Unlock the round before making changes.');
      }

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

      // Ensure score row exists and matches group's current total score (quiz_score + items_bonus)
      const targetGroup = await this.db.getFirstAsync<Group>(
        'SELECT * FROM groups WHERE id = ?',
        groupId
      );
      const bCount = targetGroup?.book_count ?? 0;
      const pCount = targetGroup?.pen_count ?? 0;
      const paCount = targetGroup?.paper_count ?? 0;
      const bPts = targetGroup?.book_points ?? 10;
      const pPts = targetGroup?.pen_points ?? 5;
      const paPts = targetGroup?.paper_points ?? 5;
      const itemsBonus = bCount * bPts + pCount * pPts + paCount * paPts;
      const groupScore = (targetGroup?.quiz_score ?? 0) + itemsBonus;

      const existingScore = await this.db.getFirstAsync<{ id: string }>(
        'SELECT id FROM scores WHERE round_id = ? AND player_id = ?',
        roundId,
        playerId
      );
      if (!existingScore) {
        const scoreId = generateId();
        await this.db.runAsync(
          'INSERT INTO scores (id, round_id, player_id, points, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          scoreId,
          roundId,
          playerId,
          groupScore,
          now,
          now
        );
      } else if (groupScore > 0) {
        await this.db.runAsync(
          'UPDATE scores SET points = ?, updated_at = ? WHERE id = ?',
          groupScore,
          now,
          existingScore.id
        );
      }
    });
  }

  async removePlayerFromRound(roundId: string, playerId: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const round = await this.db.getFirstAsync<{ status: string }>(
        'SELECT status FROM rounds WHERE id = ?',
        roundId
      );
      if (round?.status === 'LOCKED') {
        throw new Error('This round is locked. Unlock the round before making changes.');
      }

      await this.db.runAsync(
        'DELETE FROM group_members WHERE round_id = ? AND player_id = ?',
        roundId,
        playerId
      );

      // Also clean up score if 0 points
      const scoreRow = await this.db.getFirstAsync<{ points: number }>(
        'SELECT points FROM scores WHERE round_id = ? AND player_id = ?',
        roundId,
        playerId
      );
      if (scoreRow && scoreRow.points === 0) {
        await this.db.runAsync(
          'DELETE FROM scores WHERE round_id = ? AND player_id = ?',
          roundId,
          playerId
        );
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
    if (!group) throw new Error('Group not found.');

    const round = await this.db.getFirstAsync<{ status: string }>(
      'SELECT status FROM rounds WHERE id = ?',
      group.round_id
    );
    if (round?.status === 'LOCKED') {
      throw new Error('This round is locked. Unlock the round before making changes.');
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

    const totalItemsBonus = bCount * bPts + pCount * pPts + paCount * paPts;
    const quizScore = group.quiz_score ?? 0;
    const totalPlayerPoints = quizScore + totalItemsBonus;

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

      // Carry total is added to player also: sync all members of this group in this round
      const members = await this.db.getAllAsync<{ player_id: string }>(
        'SELECT player_id FROM group_members WHERE round_id = ? AND group_id = ?',
        group.round_id,
        groupId
      );

      const now = new Date().toISOString();
      for (const m of members) {
        const existing = await this.db.getFirstAsync<Score>(
          'SELECT id FROM scores WHERE round_id = ? AND player_id = ?',
          group.round_id,
          m.player_id
        );

        if (existing) {
          await this.db.runAsync(
            'UPDATE scores SET points = ?, updated_at = ? WHERE id = ?',
            totalPlayerPoints,
            now,
            existing.id
          );
        } else {
          const id = generateId();
          await this.db.runAsync(
            'INSERT INTO scores (id, round_id, player_id, points, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            id,
            group.round_id,
            m.player_id,
            totalPlayerPoints,
            now,
            now
          );
        }
      }
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
      throw new Error('This round is locked. Unlock the round before making changes.');
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

      // Re-synchronize member scores for all groups in this round
      const groupsInRound = await this.db.getAllAsync<Group>(
        'SELECT * FROM groups WHERE round_id = ?',
        roundId
      );
      const now = new Date().toISOString();
      for (const g of groupsInRound) {
        const itemsBonus = (g.book_count ?? 0) * bPts + (g.pen_count ?? 0) * pPts + (g.paper_count ?? 0) * paPts;
        const totalScore = (g.quiz_score ?? 0) + itemsBonus;

        const members = await this.db.getAllAsync<{ player_id: string }>(
          'SELECT player_id FROM group_members WHERE round_id = ? AND group_id = ?',
          roundId,
          g.id
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
              totalScore,
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
              totalScore,
              now,
              now
            );
          }
        }
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
