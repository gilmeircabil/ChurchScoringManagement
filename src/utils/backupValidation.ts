import { RoundStatus } from '../types';

/**
 * Structural and referential validation for backup payloads.
 *
 * A backup file is user-supplied input: it can be truncated, hand-edited, or
 * produced by a future version of the app. Everything is checked before a single
 * row is written, because the restore replaces the whole database inside one
 * transaction and a mid-restore failure would otherwise be hard to reason about.
 */

const SUPPORTED_BACKUP_VERSION = 1;

const ROUND_STATUSES: readonly RoundStatus[] = ['DRAFT', 'ACTIVE', 'LOCKED'];

export type BackupValidationResult =
  | { isValid: true }
  | { isValid: false; error: string };

function fail(error: string): BackupValidationResult {
  return { isValid: false, error };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Scores and item counts are whole, non-negative numbers. */
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isTimestamp(value: unknown): boolean {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

/** Collects IDs and reports a clear message on the first duplicate. */
class UniqueIdCollector {
  private readonly seen = new Set<string>();

  constructor(private readonly label: string) {}

  /** IDs collected so far, for use in later referential checks. */
  get ids(): ReadonlySet<string> {
    return this.seen;
  }

  add(id: unknown): BackupValidationResult | null {
    if (!isNonEmptyString(id)) {
      return fail(`A ${this.label} record is missing its id.`);
    }
    if (this.seen.has(id)) {
      return fail(`The backup contains duplicate ${this.label} records (id "${id}").`);
    }
    this.seen.add(id);
    return null;
  }
}

class UniqueKeyCollector {
  private readonly seen = new Set<string>();

  constructor(private readonly label: string) {}

  add(key: string, describe: () => string): BackupValidationResult | null {
    if (this.seen.has(key)) {
      return fail(`The backup contains duplicate ${this.label} (${describe()}).`);
    }
    this.seen.add(key);
    return null;
  }
}

export function validateBackupData(data: unknown): BackupValidationResult {
  if (!isPlainObject(data)) {
    return fail('Backup file is invalid or corrupted (not valid JSON).');
  }

  if (data.version !== SUPPORTED_BACKUP_VERSION) {
    return fail(`Unsupported backup version. Expected version ${SUPPORTED_BACKUP_VERSION}.`);
  }

  if (!isTimestamp(data.exportedAt)) {
    return fail('Backup file has an invalid or missing export date.');
  }

  const tables = ['players', 'rounds', 'groups', 'groupMembers', 'scores'] as const;
  for (const table of tables) {
    if (!Array.isArray(data[table])) {
      return fail(
        'Backup file is missing required data tables (players, rounds, groups, groupMembers, scores).'
      );
    }
  }

  const players = data.players as Record<string, unknown>[];
  const rounds = data.rounds as Record<string, unknown>[];
  const groups = data.groups as Record<string, unknown>[];
  const groupMembers = data.groupMembers as Record<string, unknown>[];
  const scores = data.scores as Record<string, unknown>[];

  // --- players ---
  const playerIds = new UniqueIdCollector('player');
  const playerNumbers = new UniqueKeyCollector('player numbers');
  for (const player of players) {
    if (!isPlainObject(player)) {
      return fail('Corrupted player record found in backup.');
    }
    const idError = playerIds.add(player.id);
    if (idError) return idError;

    if (!isNonEmptyString(player.name)) {
      return fail('A player record in the backup has an empty name.');
    }
    if ((player.name as string).length > 50) {
      return fail('A player name in the backup is longer than 50 characters.');
    }
    if (!isPositiveInteger(player.player_number)) {
      return fail('A player record in the backup has an invalid player number.');
    }
    const numberError = playerNumbers.add(
      String(player.player_number),
      () => `player number #${player.player_number}`
    );
    if (numberError) return numberError;

    if (!isNonNegativeInteger(player.initial_score ?? 0)) {
      return fail('A player record in the backup has an invalid initial score.');
    }
    if (!isNonNegativeInteger(player.active ?? 1)) {
      return fail('A player record in the backup has an invalid active flag.');
    }
    if (!isTimestamp(player.created_at) || !isTimestamp(player.updated_at)) {
      return fail('A player record in the backup has an invalid timestamp.');
    }
  }
  const knownPlayerIds = playerIds.ids;

  // --- rounds ---
  const roundIds = new UniqueIdCollector('round');
  for (const round of rounds) {
    if (!isPlainObject(round)) {
      return fail('Corrupted round record found in backup.');
    }
    const idError = roundIds.add(round.id);
    if (idError) return idError;

    if (!isNonEmptyString(round.round_date) || Number.isNaN(Date.parse(round.round_date))) {
      return fail('A round record in the backup has an invalid round date.');
    }
    if (!isPositiveInteger(round.group_count)) {
      return fail('A round record in the backup has an invalid group count.');
    }
    if (!ROUND_STATUSES.includes(round.status as RoundStatus)) {
      return fail('A round record in the backup has an invalid status.');
    }
    if (!isTimestamp(round.created_at) || !isTimestamp(round.updated_at)) {
      return fail('A round record in the backup has an invalid timestamp.');
    }
  }
  const knownRoundIds = roundIds.ids;

  // --- groups ---
  const groupIds = new UniqueIdCollector('group');
  const groupKeys = new UniqueKeyCollector('groups within a round');
  const groupRoundById = new Map<string, string>();
  for (const group of groups) {
    if (!isPlainObject(group)) {
      return fail('Corrupted group record found in backup.');
    }
    const idError = groupIds.add(group.id);
    if (idError) return idError;

    if (!knownRoundIds.has(group.round_id as string)) {
      return fail('A group in the backup references a round that does not exist.');
    }
    if (!isPositiveInteger(group.group_number)) {
      return fail('A group record in the backup has an invalid group number.');
    }
    const keyError = groupKeys.add(
      `${group.round_id}:${group.group_number}`,
      () => `round "${group.round_id}" group #${group.group_number}`
    );
    if (keyError) return keyError;

    if (!isNonNegativeInteger(group.quiz_score ?? 0)) {
      return fail('A group record in the backup has an invalid quiz score.');
    }
    for (const field of [
      'book_count',
      'pen_count',
      'paper_count',
      'book_points',
      'pen_points',
      'paper_points',
    ] as const) {
      if (!isNonNegativeInteger(group[field] ?? 0)) {
        return fail(`A group record in the backup has an invalid ${field}.`);
      }
    }
    for (const field of ['book_name', 'pen_name', 'paper_name'] as const) {
      if (!isNonEmptyString(group[field])) {
        return fail(`A group record in the backup is missing its ${field}.`);
      }
    }
    if (group.name !== null && group.name !== undefined && typeof group.name !== 'string') {
      return fail('A group record in the backup has an invalid name.');
    }

    groupRoundById.set(group.id as string, group.round_id as string);
  }

  // --- group members ---
  const memberIds = new UniqueIdCollector('group assignment');
  const memberKeys = new UniqueKeyCollector('player assignments within a round');
  for (const member of groupMembers) {
    if (!isPlainObject(member)) {
      return fail('Corrupted group assignment record found in backup.');
    }
    const idError = memberIds.add(member.id);
    if (idError) return idError;

    if (!knownRoundIds.has(member.round_id as string)) {
      return fail('A group assignment in the backup references a round that does not exist.');
    }
    if (!knownPlayerIds.has(member.player_id as string)) {
      return fail('A group assignment in the backup references a player that does not exist.');
    }
    const groupRound = groupRoundById.get(member.group_id as string);
    if (groupRound === undefined) {
      return fail('A group assignment in the backup references a group that does not exist.');
    }
    if (groupRound !== member.round_id) {
      return fail('A group assignment in the backup links a group to the wrong round.');
    }
    const keyError = memberKeys.add(
      `${member.round_id}:${member.player_id}`,
      () => `a player assigned twice in round "${member.round_id}"`
    );
    if (keyError) return keyError;

    if (!isTimestamp(member.created_at)) {
      return fail('A group assignment in the backup has an invalid timestamp.');
    }
  }

  // --- scores ---
  const scoreIds = new UniqueIdCollector('score');
  const scoreKeys = new UniqueKeyCollector('scores within a round');
  for (const score of scores) {
    if (!isPlainObject(score)) {
      return fail('Corrupted score record found in backup.');
    }
    const idError = scoreIds.add(score.id);
    if (idError) return idError;

    if (!knownRoundIds.has(score.round_id as string)) {
      return fail('A score in the backup references a round that does not exist.');
    }
    if (!knownPlayerIds.has(score.player_id as string)) {
      return fail('A score in the backup references a player that does not exist.');
    }
    if (!isNonNegativeInteger(score.points)) {
      return fail('A score record in the backup has an invalid point total.');
    }
    const keyError = scoreKeys.add(
      `${score.round_id}:${score.player_id}`,
      () => `two scores for one player in round "${score.round_id}"`
    );
    if (keyError) return keyError;

    if (!isTimestamp(score.created_at) || !isTimestamp(score.updated_at)) {
      return fail('A score record in the backup has an invalid timestamp.');
    }
  }

  return { isValid: true };
}
