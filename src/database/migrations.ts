import { IDatabaseConnection } from './types';
import { APP_CONFIG } from '../constants/config';

export const INITIAL_SCHEMA = `
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
    bible_count INTEGER NOT NULL DEFAULT 0,
    bible_points INTEGER NOT NULL DEFAULT 5,
    bible_name TEXT NOT NULL DEFAULT 'Bible',
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
    bonus_points INTEGER NOT NULL DEFAULT 0,
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
 * Columns that older releases added one at a time through ad hoc `ALTER TABLE`
 * statements. They are re-applied idempotently on every launch so a device that
 * was interrupted mid-upgrade, or that predates `PRAGMA user_version`, can never
 * be left with a half-populated table.
 */
const REPAIRABLE_COLUMNS: readonly { table: string; column: string; definition: string }[] = [
  { table: 'players', column: 'initial_score', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'groups', column: 'name', definition: 'TEXT' },
  { table: 'groups', column: 'quiz_score', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'groups', column: 'book_count', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'groups', column: 'pen_count', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'groups', column: 'paper_count', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'groups', column: 'book_points', definition: 'INTEGER NOT NULL DEFAULT 10' },
  { table: 'groups', column: 'pen_points', definition: 'INTEGER NOT NULL DEFAULT 5' },
  { table: 'groups', column: 'paper_points', definition: 'INTEGER NOT NULL DEFAULT 5' },
  { table: 'groups', column: 'book_name', definition: "TEXT NOT NULL DEFAULT 'Book'" },
  { table: 'groups', column: 'pen_name', definition: "TEXT NOT NULL DEFAULT 'Pen'" },
  { table: 'groups', column: 'paper_name', definition: "TEXT NOT NULL DEFAULT 'Paper'" },
  { table: 'groups', column: 'bible_count', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'groups', column: 'bible_points', definition: 'INTEGER NOT NULL DEFAULT 5' },
  { table: 'groups', column: 'bible_name', definition: "TEXT NOT NULL DEFAULT 'Bible'" },
  { table: 'scores', column: 'bonus_points', definition: 'INTEGER NOT NULL DEFAULT 0' },
];

type Migration = {
  /** Schema version this migration produces. Must increase by exactly 1 per entry. */
  readonly version: number;
  readonly description: string;
  readonly up: (db: IDatabaseConnection) => Promise<void>;
};

/**
 * Ordered, append-only migration list.
 *
 * Rules for changing this file:
 *  1. Never edit a migration that has shipped - add a new one instead.
 *  2. Append the new entry with the next `version`.
 *  3. Bump `APP_CONFIG.databaseVersion` in the same change.
 */
const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'Initial schema',
    up: async (db) => {
      await db.execAsync(INITIAL_SCHEMA);
    },
  },
  {
    version: 2,
    description: 'Enforce unique player numbers and group numbers',
    up: async (db) => {
      await dedupePlayerNumbers(db);
      await db.execAsync(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_players_player_number ON players(player_number);'
      );

      await dedupeGroupNumbers(db);
      await db.execAsync(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_round_number ON groups(round_id, group_number);'
      );
    },
  },
  {
    version: 3,
    description: 'Add Item 4 (Bible) carry bonus columns to groups',
    up: async (_db) => {
      // REPAIRABLE_COLUMNS idempotently adds bible_count, bible_points, bible_name
    },
  },
  {
    version: 4,
    description: 'Add bonus_points to scores for individual bonus round',
    up: async (_db) => {
      // REPAIRABLE_COLUMNS idempotently adds bonus_points
    },
  },
];

const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/**
 * Gives every player a unique, positive number while keeping the numbers that
 * are already unique, so a migration never renumbers data unnecessarily.
 */
async function dedupePlayerNumbers(db: IDatabaseConnection): Promise<void> {
  const players = await db.getAllAsync<{ id: string; player_number: number; created_at: string }>(
    'SELECT id, player_number, created_at FROM players ORDER BY created_at ASC, rowid ASC'
  );

  const used = new Set<number>();
  let nextCandidate = 1;

  for (const player of players) {
    const current = Number(player.player_number);
    let assigned = Number.isInteger(current) && current > 0 ? current : 0;

    if (assigned === 0 || used.has(assigned)) {
      while (used.has(nextCandidate)) {
        nextCandidate += 1;
      }
      assigned = nextCandidate;
    }

    used.add(assigned);

    if (assigned !== current) {
      await db.runAsync('UPDATE players SET player_number = ? WHERE id = ?', assigned, player.id);
    }
  }
}

/**
 * Renumbers groups within each round to a gap-free 1..N sequence, preserving the
 * original order. Only renumbers rounds that actually contain duplicates.
 */
async function dedupeGroupNumbers(db: IDatabaseConnection): Promise<void> {
  const groups = await db.getAllAsync<{ id: string; round_id: string; group_number: number }>(
    'SELECT id, round_id, group_number FROM groups ORDER BY round_id ASC, group_number ASC, rowid ASC'
  );

  const nextPerRound = new Map<string, number>();
  const usedPerRound = new Map<string, Set<number>>();

  for (const group of groups) {
    const roundId = group.round_id;
    const used = usedPerRound.get(roundId) ?? new Set<number>();
    usedPerRound.set(roundId, used);

    const current = Number(group.group_number);
    let assigned = Number.isInteger(current) && current > 0 ? current : 0;

    if (assigned === 0 || used.has(assigned)) {
      let candidate = nextPerRound.get(roundId) ?? 1;
      while (used.has(candidate)) {
        candidate += 1;
      }
      assigned = candidate;
      nextPerRound.set(roundId, candidate + 1);
    }

    used.add(assigned);

    if (assigned !== current) {
      await db.runAsync('UPDATE groups SET group_number = ? WHERE id = ?', assigned, group.id);
    }
  }
}

async function getSchemaVersion(db: IDatabaseConnection): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return Number(row?.user_version ?? 0);
}

async function tableHasColumn(
  db: IDatabaseConnection,
  table: string,
  column: string
): Promise<boolean> {
  // `table` is never user input: it comes from the REPAIRABLE_COLUMNS constant.
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return columns.some((entry) => entry.name === column);
}

async function applySchemaRepairs(db: IDatabaseConnection): Promise<void> {
  for (const { table, column, definition } of REPAIRABLE_COLUMNS) {
    if (await tableHasColumn(db, table, column)) {
      continue;
    }
    await db.runAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * Prepares the database and brings its schema up to `APP_CONFIG.databaseVersion`.
 *
 * Safe to call on every launch: it is fully idempotent, runs inside a
 * transaction, and never modifies data the running schema version already
 * understands.
 */
export async function initializeDatabase(db: IDatabaseConnection): Promise<void> {
  if (APP_CONFIG.databaseVersion !== LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Schema version mismatch: APP_CONFIG.databaseVersion is ${APP_CONFIG.databaseVersion} but the ` +
        `newest migration in src/database/migrations.ts is version ${LATEST_SCHEMA_VERSION}. ` +
        'Add the missing migration or correct the configured version.'
    );
  }

  // Must be set outside a transaction: SQLite ignores it inside one.
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const currentVersion = await getSchemaVersion(db);

  if (currentVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `This database was created by a newer version of the app (schema ${currentVersion}, this build ` +
        `supports ${LATEST_SCHEMA_VERSION}). Update the app before continuing.`
    );
  }

  await db.withTransactionAsync(async () => {
    // Idempotent: creates anything missing so both fresh installs and legacy
    // databases converge on the same starting point.
    await db.execAsync(INITIAL_SCHEMA);
    await applySchemaRepairs(db);

    for (const migration of MIGRATIONS) {
      if (migration.version <= currentVersion) {
        continue;
      }
      await migration.up(db);
      // `user_version` only accepts an integer literal; the value is a constant.
      await db.execAsync(`PRAGMA user_version = ${migration.version};`);
    }
  });
}
