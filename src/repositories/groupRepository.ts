import { IDatabaseConnection } from '../database/types';
import { Group, AssignedMember, GroupDetail, Player } from '../types';
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
      return {
        id: g.id,
        group_number: g.group_number,
        members,
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

      // Ensure score row exists with default 0 if not already present
      const existingScore = await this.db.getFirstAsync(
        'SELECT id FROM scores WHERE round_id = ? AND player_id = ?',
        roundId,
        playerId
      );
      if (!existingScore) {
        const scoreId = generateId();
        await this.db.runAsync(
          'INSERT INTO scores (id, round_id, player_id, points, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
          scoreId,
          roundId,
          playerId,
          now,
          now
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
}
