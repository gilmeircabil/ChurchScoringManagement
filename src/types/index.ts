export type RoundStatus = 'DRAFT' | 'ACTIVE' | 'LOCKED';

export interface Player {
  id: string;
  player_number: number;
  name: string;
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
  members: AssignedMember[];
}

export interface RoundDetail {
  round: Round;
  groups: GroupDetail[];
  totalAssigned: number;
  totalUnassigned: number;
  totalPlayers: number;
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
