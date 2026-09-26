import { IDatabaseConnection } from '../database/types';
import { ReportItem } from '../types';
import { assignCompetitionRanks } from '../utils/formatters';

export class ReportRepository {
  private db: IDatabaseConnection;

  constructor(db: IDatabaseConnection) {
    this.db = db;
  }

  /**
   * Overall all-time cumulative scores, ranked from highest to lowest.
   */
  async getOverallReport(): Promise<ReportItem[]> {
    const rows = await this.db.getAllAsync<{
      player_id: string;
      player_name: string;
      player_number: number;
      total_score: number;
      rounds_count: number;
    }>(
      `SELECT
        p.id AS player_id,
        p.name AS player_name,
        p.player_number,
        (COALESCE(p.initial_score, 0) + COALESCE(SUM(s.points), 0)) AS total_score,
        COUNT(s.id) AS rounds_count
       FROM players p
       LEFT JOIN scores s ON s.player_id = p.id
       WHERE p.active = 1
       GROUP BY p.id
       HAVING total_score > 0 OR COUNT(s.id) > 0
       ORDER BY total_score DESC, p.name COLLATE NOCASE ASC, p.player_number ASC`
    );

    const mapped = rows.map((r) => ({
      rank: 0,
      player_id: r.player_id,
      player_name: r.player_name,
      player_number: r.player_number,
      score: r.total_score,
      rounds_count: r.rounds_count,
    }));

    return assignCompetitionRanks(mapped);
  }

  /**
   * Scores for a specific round, ranked from highest to lowest.
   */
  async getRoundReport(roundId: string): Promise<ReportItem[]> {
    const rows = await this.db.getAllAsync<{
      player_id: string;
      player_name: string;
      player_number: number;
      round_score: number;
    }>(
      `SELECT
        p.id AS player_id,
        p.name AS player_name,
        p.player_number,
        COALESCE(s.points, 0) AS round_score
       FROM group_members gm
       JOIN players p ON gm.player_id = p.id
       LEFT JOIN scores s ON s.round_id = gm.round_id AND s.player_id = p.id
       WHERE gm.round_id = ?
       ORDER BY round_score DESC, p.name COLLATE NOCASE ASC, p.player_number ASC`,
      roundId
    );

    const mapped = rows.map((r) => ({
      rank: 0,
      player_id: r.player_id,
      player_name: r.player_name,
      player_number: r.player_number,
      score: r.round_score,
    }));

    return assignCompetitionRanks(mapped);
  }
}
