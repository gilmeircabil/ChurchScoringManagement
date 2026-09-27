import { IDatabaseConnection } from './types';
import { APP_CONFIG } from '../constants/config';

export const INITIAL_SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    player_number INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    initial_score INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rounds (
    id TEXT PRIMARY KEY,
    round_date TEXT NOT NULL,
    group_count INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL,
    group_number INTEGER NOT NULL,
    name TEXT,
    quiz_score INTEGER NOT NULL DEFAULT 0,
    book_count INTEGER NOT NULL DEFAULT 0,
    pen_count INTEGER NOT NULL DEFAULT 0,
    paper_count INTEGER NOT NULL DEFAULT 0,
    book_points INTEGER NOT NULL DEFAULT 10,
    pen_points INTEGER NOT NULL DEFAULT 5,
    paper_points INTEGER NOT NULL DEFAULT 5,
    book_name TEXT NOT NULL DEFAULT 'Book',
    pen_name TEXT NOT NULL DEFAULT 'Pen',
    paper_name TEXT NOT NULL DEFAULT 'Paper',
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_members (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(round_id, player_id),
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scores (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(round_id, player_id),
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
CREATE INDEX IF NOT EXISTS idx_players_active ON players(active);
CREATE INDEX IF NOT EXISTS idx_scores_player_id ON scores(player_id);
CREATE INDEX IF NOT EXISTS idx_scores_round_id ON scores(round_id);
CREATE INDEX IF NOT EXISTS idx_group_members_player_id ON group_members(player_id);
CREATE INDEX IF NOT EXISTS idx_group_members_round_id ON group_members(round_id);
CREATE INDEX IF NOT EXISTS idx_groups_round_id ON groups(round_id);
`;

/**
 * Runs database migrations and schema setup.
 */
export async function initializeDatabase(db: IDatabaseConnection): Promise<void> {
  // Ensure foreign keys are on
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion === 0) {
    await db.execAsync(INITIAL_SCHEMA);
    await db.execAsync(`PRAGMA user_version = ${APP_CONFIG.databaseVersion};`);
  } else if (currentVersion < APP_CONFIG.databaseVersion) {
    // Future migration steps can be added here
    await db.execAsync(`PRAGMA user_version = ${APP_CONFIG.databaseVersion};`);
  }

  // Ensure initial_score column exists for upgraded databases
  try {
    await db.execAsync('ALTER TABLE players ADD COLUMN initial_score INTEGER NOT NULL DEFAULT 0;');
  } catch {
    // Column already exists
  }

  // Ensure groups table has items bonus columns for upgraded databases
  try {
    await db.execAsync('ALTER TABLE groups ADD COLUMN book_count INTEGER NOT NULL DEFAULT 0;');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE groups ADD COLUMN pen_count INTEGER NOT NULL DEFAULT 0;');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE groups ADD COLUMN paper_count INTEGER NOT NULL DEFAULT 0;');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE groups ADD COLUMN book_points INTEGER NOT NULL DEFAULT 10;');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE groups ADD COLUMN pen_points INTEGER NOT NULL DEFAULT 5;');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE groups ADD COLUMN paper_points INTEGER NOT NULL DEFAULT 5;');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE groups ADD COLUMN name TEXT;');
  } catch {}
  try {
    await db.execAsync("ALTER TABLE groups ADD COLUMN book_name TEXT NOT NULL DEFAULT 'Book';");
  } catch {}
  try {
    await db.execAsync("ALTER TABLE groups ADD COLUMN pen_name TEXT NOT NULL DEFAULT 'Pen';");
  } catch {}
  try {
    await db.execAsync("ALTER TABLE groups ADD COLUMN paper_name TEXT NOT NULL DEFAULT 'Paper';");
  } catch {}
  try {
    await db.execAsync('ALTER TABLE groups ADD COLUMN quiz_score INTEGER NOT NULL DEFAULT 0;');
  } catch {}
}
