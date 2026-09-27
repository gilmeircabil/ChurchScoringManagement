export type RoundStatus = 'DRAFT' | 'ACTIVE' | 'LOCKED';

export interface Player {
  id: string;
  player_number: number;
  name: string;
  initial_score?: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Round {
  id: string;
  round_date: string;
  group_count: number;
  status: RoundStatus;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  round_id: string;
  group_number: number;
  name?: string | null;
  book_count?: number;
  pen_count?: number;
  paper_count?: number;
  book_points?: number;
  pen_points?: number;
  paper_points?: number;
  book_name?: string;
  pen_name?: string;
  paper_name?: string;
}

export interface GroupMember {
  id: string;
  round_id: string;
  group_id: string;
  player_id: string;
  created_at: string;
}

export interface Score {
  id: string;
  round_id: string;
  player_id: string;
  points: number;
  created_at: string;
  updated_at: string;
}

// Aggregate & View types
export interface PlayerWithStats extends Player {
  total_score: number;
  rounds_played: number;
  initial_score: number;
}

export interface PlayerScoreHistoryItem {
  score_id: string;
  round_id: string;
  round_date: string;
  round_status: RoundStatus;
  group_number?: number;
  points: number;
  updated_at: string;
}

export interface AssignedMember {
  group_member_id: string;
  group_id: string;
  group_number: number;
  player_id: string;
  player_name: string;
  player_number: number;
  round_score: number;
}

export interface GroupDetail {
  id: string;
  group_number: number;
  name?: string | null;
  members: AssignedMember[];
  book_count: number;
  pen_count: number;
  paper_count: number;
  book_points: number;
  pen_points: number;
  paper_points: number;
  book_name: string;
  pen_name: string;
  paper_name: string;
  quiz_score: number;
  items_bonus: number;
  total_score: number;
}

export interface ItemPointsConfig {
  book: number;
  pen: number;
  paper: number;
}

export interface ItemRuleConfig {
  book_name: string;
  book_points: number;
  pen_name: string;
  pen_points: number;
  paper_name: string;
  paper_points: number;
}

export interface GroupReportItem {
  rank: number;
  group_id: string;
  group_number: number;
  name?: string | null;
  member_count: number;
  member_names: string[];
  quiz_score: number;
  book_count: number;
  pen_count: number;
  paper_count: number;
  book_points: number;
  pen_points: number;
  paper_points: number;
  book_name: string;
  pen_name: string;
  paper_name: string;
  items_bonus: number;
  total_score: number;
}

export interface ReportItem {
  rank: number;
  player_id: string;
  player_name: string;
  player_number: number;
  score: number;
  rounds_count?: number;
}

export interface RoundHistoryItem {
  id: string;
  round_date: string;
  group_count: number;
  status: RoundStatus;
  assigned_count: number;
  created_at: string;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  players: Player[];
  rounds: Round[];
  groups: Group[];
  groupMembers: GroupMember[];
  scores: Score[];
}

export type MainTab = 'home' | 'players' | 'round' | 'reports' | 'history' | 'settings';
