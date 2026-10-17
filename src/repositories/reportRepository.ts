import { IDatabaseConnection } from '../database/types';
import { ReportItem, GroupReportItem, Group, AssignedMember } from '../types';
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
        (COALESCE(p.initial_score, 0) + COALESCE(SUM(s.points + s.bonus_points), 0)) AS total_score,
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
      group_score: number;
      bonus_points: number;
      round_score: number;
    }>(
      `SELECT
        p.id AS player_id,
        p.name AS player_name,
        p.player_number,
        COALESCE(s.points, 0) AS group_score,
        COALESCE(s.bonus_points, 0) AS bonus_points,
        (COALESCE(s.points, 0) + COALESCE(s.bonus_points, 0)) AS round_score
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
      group_score: r.group_score,
      bonus_points: r.bonus_points,
    }));

    return assignCompetitionRanks(mapped);
  }

  /**
   * Group leaderboard for a specific round, ranked from highest to lowest by total group score
   * (member quiz scores + book/pen/paper carry items bonus).
   */
  async getGroupReport(roundId: string): Promise<GroupReportItem[]> {
    const groups = await this.db.getAllAsync<Group>(
      'SELECT * FROM groups WHERE round_id = ? ORDER BY group_number ASC',
      roundId
    );

    const assignedMembers = await this.db.getAllAsync<AssignedMember>(
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
       ORDER BY g.group_number ASC, p.name COLLATE NOCASE ASC`,
      roundId
    );

    const mapped = groups.map((g) => {
      const members = assignedMembers.filter((m) => m.group_id === g.id);
      const quiz_score =
        g.quiz_score !== undefined && g.quiz_score !== null
          ? g.quiz_score
          : members.reduce((sum, m) => sum + (m.round_score || 0), 0);
      const book_count = g.book_count ?? 0;
      const pen_count = g.pen_count ?? 0;
      const paper_count = g.paper_count ?? 0;
      const bible_count = g.bible_count ?? 0;
      const book_points = g.book_points ?? 10;
      const pen_points = g.pen_points ?? 5;
      const paper_points = g.paper_points ?? 5;
      const bible_points = g.bible_points ?? 5;
      const items_bonus =
        book_count * book_points + pen_count * pen_points + paper_count * paper_points + bible_count * bible_points;
      const total_score = quiz_score + items_bonus;

      const book_name = g.book_name || 'Book';
      const pen_name = g.pen_name || 'Pen';
      const paper_name = g.paper_name || 'Paper';
      const bible_name = g.bible_name || 'Bible';

      return {
        rank: 0,
        group_id: g.id,
        group_number: g.group_number,
        name: g.name ?? null,
        member_count: members.length,
        member_names: members.map((m) => m.player_name),
        quiz_score,
        book_count,
        pen_count,
        paper_count,
        bible_count,
        book_points,
        pen_points,
        paper_points,
        bible_points,
        book_name,
        pen_name,
        paper_name,
        bible_name,
        items_bonus,
        total_score,
        score: total_score,
      };
    });

    return assignCompetitionRanks(mapped);
  }
}
