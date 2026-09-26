import { IDatabaseConnection } from '../database/types';
import { Player, PlayerWithStats, PlayerScoreHistoryItem } from '../types';
import { generateId } from '../utils/idGenerator';

export class PlayerRepository {
  private db: IDatabaseConnection;

  constructor(db: IDatabaseConnection) {
    this.db = db;
  }

  async getNextPlayerNumber(): Promise<number> {
    const row = await this.db.getFirstAsync<{ max_num: number | null }>(
      'SELECT MAX(player_number) as max_num FROM players'
    );
    return (row?.max_num ?? 0) + 1;
  }

  async getAllPlayers(activeOnly = true): Promise<Player[]> {
    const query = activeOnly
      ? 'SELECT * FROM players WHERE active = 1 ORDER BY name COLLATE NOCASE ASC, player_number ASC'
      : 'SELECT * FROM players ORDER BY name COLLATE NOCASE ASC, player_number ASC';
    return await this.db.getAllAsync<Player>(query);
  }

  async getPlayerById(id: string): Promise<Player | null> {
    return await this.db.getFirstAsync<Player>('SELECT * FROM players WHERE id = ?', id);
  }

  async searchPlayers(query: string, activeOnly = true): Promise<Player[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return this.getAllPlayers(activeOnly);
    }
    const pattern = `%${trimmed}%`;
    const sql = activeOnly
      ? 'SELECT * FROM players WHERE active = 1 AND LOWER(name) LIKE ? ORDER BY name COLLATE NOCASE ASC, player_number ASC'
      : 'SELECT * FROM players WHERE LOWER(name) LIKE ? ORDER BY name COLLATE NOCASE ASC, player_number ASC';
    return await this.db.getAllAsync<Player>(sql, pattern);
  }

  async findDuplicateNames(name: string, excludeId?: string): Promise<Player[]> {
    const trimmed = name.trim().toLowerCase();
    if (excludeId) {
      return await this.db.getAllAsync<Player>(
        'SELECT * FROM players WHERE LOWER(name) = ? AND id != ? AND active = 1',
        trimmed,
        excludeId
      );
    }
    return await this.db.getAllAsync<Player>(
      'SELECT * FROM players WHERE LOWER(name) = ? AND active = 1',
      trimmed
    );
  }

  async createPlayer(name: string): Promise<Player> {
    const id = generateId();
    const playerNumber = await this.getNextPlayerNumber();
    const now = new Date().toISOString();
    const cleanName = name.trim();

    await this.db.runAsync(
      'INSERT INTO players (id, player_number, name, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)',
      id,
      playerNumber,
      cleanName,
      now,
      now
    );

    return {
      id,
      player_number: playerNumber,
      name: cleanName,
      active: 1,
      created_at: now,
      updated_at: now,
    };
  }

  async updatePlayerName(id: string, newName: string): Promise<void> {
    const now = new Date().toISOString();
    const cleanName = newName.trim();
    await this.db.runAsync(
      'UPDATE players SET name = ?, updated_at = ? WHERE id = ?',
      cleanName,
      now,
      id
    );
  }

  async getPlayerWithStats(id: string): Promise<PlayerWithStats | null> {
    const player = await this.getPlayerById(id);
    if (!player) return null;

    const stats = await this.db.getFirstAsync<{ total_score: number | null; rounds_played: number }>(
      `SELECT
        COALESCE(SUM(points), 0) AS total_score,
        COUNT(id) AS rounds_played
       FROM scores
       WHERE player_id = ?`,
      id
    );

    return {
      ...player,
      total_score: stats?.total_score ?? 0,
      rounds_played: stats?.rounds_played ?? 0,
    };
  }

  async getPlayerScoreHistory(id: string): Promise<PlayerScoreHistoryItem[]> {
    const rows = await this.db.getAllAsync<{
      score_id: string;
      round_id: string;
      round_date: string;
      round_status: string;
      group_number: number | null;
      points: number;
      updated_at: string;
    }>(
      `SELECT
        s.id AS score_id,
        s.round_id,
        r.round_date,
        r.status AS round_status,
        g.group_number,
        s.points,
        s.updated_at
       FROM scores s
       JOIN rounds r ON s.round_id = r.id
       LEFT JOIN group_members gm ON gm.round_id = s.round_id AND gm.player_id = s.player_id
       LEFT JOIN groups g ON gm.group_id = g.id
       WHERE s.player_id = ?
       ORDER BY r.round_date DESC, r.created_at DESC`,
      id
    );

    return rows.map((r) => ({
      ...r,
      round_status: r.round_status as any,
      group_number: r.group_number ?? undefined,
    }));
  }

  async deletePlayer(id: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM scores WHERE player_id = ?', id);
      await this.db.runAsync('DELETE FROM group_members WHERE player_id = ?', id);
      await this.db.runAsync('DELETE FROM players WHERE id = ?', id);
    });
  }
}
