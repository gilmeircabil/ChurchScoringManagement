import { describe, test, expect, beforeEach } from '@jest/globals';
import { SqlJsTestConnection } from './testDbAdapter';
import { initializeDatabase, INITIAL_SCHEMA } from '../src/database/migrations';
import { APP_CONFIG } from '../src/constants/config';
import { validateBackupData } from '../src/utils/backupValidation';
import { getErrorMessage, UserFacingError } from '../src/utils/errors';
import { QuizService, createQuizServiceWithDb } from '../src/services/quizService';
import { BackupData } from '../src/types';

const NOW = '2026-01-01T00:00:00.000Z';

describe('Production readiness — schema migrations', () => {
  test('a fresh database is migrated to the configured schema version', async () => {
    const conn = await SqlJsTestConnection.create();

    expect(await conn.getUserVersion()).toBe(APP_CONFIG.databaseVersion);
  });

  test('a legacy v1 database with duplicate player numbers is repaired, not rejected', async () => {
    const conn = await SqlJsTestConnection.createRaw();

    // Stage the v1 schema exactly as an older release left it behind.
    await conn.execAsync(INITIAL_SCHEMA);
    await conn.execAsync('PRAGMA user_version = 1;');

    // v1 had no UNIQUE index on players.player_number, so duplicates were possible.
    await conn.runAsync(
      'INSERT INTO players (id, player_number, name, initial_score, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
      'p1', 1, 'John', 0, NOW, NOW
    );
    await conn.runAsync(
      'INSERT INTO players (id, player_number, name, initial_score, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
      'p2', 1, 'John', 0, NOW, NOW
    );
    await conn.runAsync(
      'INSERT INTO players (id, player_number, name, initial_score, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
      'p3', 2, 'Sarah', 0, NOW, NOW
    );

    await initializeDatabase(conn);

    expect(await conn.getUserVersion()).toBe(APP_CONFIG.databaseVersion);

    const players = await conn.getAllAsync<{ id: string; player_number: number; name: string }>(
      'SELECT id, player_number, name FROM players ORDER BY player_number ASC'
    );
    const numbers = players.map((p) => p.player_number);

    expect(numbers).toHaveLength(3);
    expect(new Set(numbers).size).toBe(3);
    expect(numbers.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
    // Every original row survives, including the duplicate name. The first "John"
    // keeps number 1, the second "John" is moved to 2, and "Sarah" moves to 3.
    expect(players.map((p) => p.name)).toEqual(['John', 'John', 'Sarah']);
    expect(players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  test('migrating is idempotent: running it twice keeps the same player numbers', async () => {
    const conn = await SqlJsTestConnection.create();
    await conn.runAsync(
      'INSERT INTO players (id, player_number, name, initial_score, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
      'p1', 1, 'John', 0, NOW, NOW
    );

    await initializeDatabase(conn);
    await initializeDatabase(conn);

    const players = await conn.getAllAsync<{ player_number: number }>(
      'SELECT player_number FROM players'
    );
    expect(players).toEqual([{ player_number: 1 }]);
  });

  test('the unique index on player_number is enforced after migrating', async () => {
    const conn = await SqlJsTestConnection.create();

    await conn.runAsync(
      'INSERT INTO players (id, player_number, name, initial_score, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
      'p1', 1, 'John', 0, NOW, NOW
    );

    await expect(
      conn.runAsync(
        'INSERT INTO players (id, player_number, name, initial_score, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
        'p2', 1, 'John', 0, NOW, NOW
      )
    ).rejects.toThrow();
  });

  test('a database from a newer app version is refused instead of being downgraded', async () => {
    const conn = await SqlJsTestConnection.createRaw();
    await conn.execAsync(INITIAL_SCHEMA);
    await conn.execAsync(`PRAGMA user_version = ${APP_CONFIG.databaseVersion + 1};`);

    await expect(initializeDatabase(conn)).rejects.toThrow(/newer version/i);
  });
});

describe('Production readiness — backup validation', () => {
  let service: QuizService;
  let validBackup: BackupData;

  beforeEach(async () => {
    service = createQuizServiceWithDb(await SqlJsTestConnection.create());
    validBackup = await service.backup.generateBackupData();
  });

  test('an empty backup is valid', () => {
    expect(validateBackupData(validBackup)).toEqual({ isValid: true });
  });

  test('a real round exports a payload that validates', async () => {
    const player = await service.players.createPlayer('John');
    const round = await service.rounds.createRound('2026-09-26', 2);
    const groups = await service.groups.getGroupsByRoundId(round.id);
    await service.groups.assignPlayerToGroup(round.id, groups[0].id, player.id);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');
    await service.scores.saveGroupScore(round.id, groups[0].id, 35);

    const backup = await service.backup.generateBackupData();
    expect(validateBackupData(backup)).toEqual({ isValid: true });
  });

  test.each([
    ['not an object', (): unknown => 'nope'],
    ['an array', (): unknown => []],
    ['an unsupported version', (b: BackupData): unknown => ({ ...b, version: 2 })],
    ['a missing table', (b: BackupData): unknown => ({ ...b, scores: undefined })],
    ['a non-array table', (b: BackupData): unknown => ({ ...b, rounds: {} })],
    ['a bad export date', (b: BackupData): unknown => ({ ...b, exportedAt: 'yesterday' })],
  ])('rejects %s', (_label, build) => {
    expect(validateBackupData(build(validBackup)).isValid).toBe(false);
  });

  test('rejects duplicate record ids', () => {
    const player = { id: 'p1', player_number: 1, name: 'John', initial_score: 0, active: 1, created_at: NOW, updated_at: NOW };
    const result = validateBackupData({ ...validBackup, players: [player, { ...player }] });
    expect(result).toEqual({ isValid: false, error: expect.stringContaining('duplicate') });
  });

  test('rejects duplicate player numbers', () => {
    const result = validateBackupData({
      ...validBackup,
      players: [
        { id: 'p1', player_number: 1, name: 'John', initial_score: 0, active: 1, created_at: NOW, updated_at: NOW },
        { id: 'p2', player_number: 1, name: 'John', initial_score: 0, active: 1, created_at: NOW, updated_at: NOW },
      ],
    });
    expect(result).toEqual({ isValid: false, error: expect.stringContaining('player numbers') });
  });

  const PLAYER = { id: 'p1', player_number: 1, name: 'John', initial_score: 0, active: 1, created_at: NOW, updated_at: NOW };
  const ROUND = { id: 'r1', round_date: '2026-09-26', group_count: 1, status: 'DRAFT', created_at: NOW, updated_at: NOW };

  test('rejects a negative score', () => {
    const result = validateBackupData({
      ...validBackup,
      players: [PLAYER],
      rounds: [ROUND],
      scores: [
        { id: 's1', round_id: 'r1', player_id: 'p1', points: -5, created_at: NOW, updated_at: NOW },
      ],
    });
    expect(result).toEqual({ isValid: false, error: expect.stringContaining('invalid point total') });
  });

  test('rejects a score that references a player who is not in the backup', () => {
    const result = validateBackupData({
      ...validBackup,
      rounds: [ROUND],
      scores: [
        { id: 's1', round_id: 'r1', player_id: 'ghost', points: 5, created_at: NOW, updated_at: NOW },
      ],
    });
    expect(result).toEqual({ isValid: false, error: expect.stringContaining('player that does not exist') });
  });

  test('rejects two scores for the same player in the same round', () => {
    const result = validateBackupData({
      ...validBackup,
      players: [PLAYER],
      rounds: [ROUND],
      scores: [
        { id: 's1', round_id: 'r1', player_id: 'p1', points: 5, created_at: NOW, updated_at: NOW },
        { id: 's2', round_id: 'r1', player_id: 'p1', points: 9, created_at: NOW, updated_at: NOW },
      ],
    });
    expect(result).toEqual({ isValid: false, error: expect.stringContaining('two scores for one player') });
  });

  test('rejects a group assignment whose group belongs to a different round', () => {
    const base = {
      players: [{ id: 'p1', player_number: 1, name: 'John', initial_score: 0, active: 1, created_at: NOW, updated_at: NOW }],
      rounds: [
        { id: 'r1', round_date: '2026-09-26', group_count: 1, status: 'DRAFT', created_at: NOW, updated_at: NOW },
        { id: 'r2', round_date: '2026-09-27', group_count: 1, status: 'DRAFT', created_at: NOW, updated_at: NOW },
      ],
      groups: [
        { id: 'g1', round_id: 'r2', group_number: 1, name: null, quiz_score: 0, book_count: 0, pen_count: 0, paper_count: 0, book_points: 10, pen_points: 5, paper_points: 5, book_name: 'Book', pen_name: 'Pen', paper_name: 'Paper' },
      ],
      groupMembers: [
        { id: 'm1', round_id: 'r1', group_id: 'g1', player_id: 'p1', created_at: NOW },
      ],
      scores: [],
    };

    const result = validateBackupData({ version: 1, exportedAt: NOW, ...base });
    expect(result).toEqual({ isValid: false, error: expect.stringContaining('wrong round') });
  });

  test('rejects two assignments for the same player in the same round', () => {
    const base = {
      players: [{ id: 'p1', player_number: 1, name: 'John', initial_score: 0, active: 1, created_at: NOW, updated_at: NOW }],
      rounds: [{ id: 'r1', round_date: '2026-09-26', group_count: 2, status: 'DRAFT', created_at: NOW, updated_at: NOW }],
      groups: [
        { id: 'g1', round_id: 'r1', group_number: 1, name: null, quiz_score: 0, book_count: 0, pen_count: 0, paper_count: 0, book_points: 10, pen_points: 5, paper_points: 5, book_name: 'Book', pen_name: 'Pen', paper_name: 'Paper' },
        { id: 'g2', round_id: 'r1', group_number: 2, name: null, quiz_score: 0, book_count: 0, pen_count: 0, paper_count: 0, book_points: 10, pen_points: 5, paper_points: 5, book_name: 'Book', pen_name: 'Pen', paper_name: 'Paper' },
      ],
      groupMembers: [
        { id: 'm1', round_id: 'r1', group_id: 'g1', player_id: 'p1', created_at: NOW },
        { id: 'm2', round_id: 'r1', group_id: 'g2', player_id: 'p1', created_at: NOW },
      ],
      scores: [],
    };

    const result = validateBackupData({ version: 1, exportedAt: NOW, ...base });
    expect(result).toEqual({ isValid: false, error: expect.stringContaining('assigned twice') });
  });
});

describe('Production readiness — restore fidelity', () => {
  test('a restore preserves group quiz scores and the group report', async () => {
    const source = createQuizServiceWithDb(await SqlJsTestConnection.create());

    const alice = await source.players.createPlayer('Alice');
    const bob = await source.players.createPlayer('Bob');
    const round = await source.rounds.createRound('2026-09-30', 2);
    const groups = await source.groups.getGroupsByRoundId(round.id);
    const group1 = groups.find((g) => g.group_number === 1)!;

    await source.groups.assignPlayerToGroup(round.id, group1.id, alice.id);
    await source.groups.assignPlayerToGroup(round.id, group1.id, bob.id);
    await source.rounds.updateRoundStatus(round.id, 'ACTIVE');
    await source.scores.saveGroupScore(round.id, group1.id, 35);
    await source.groups.updateGroupItems(group1.id, { book_count: 2, pen_count: 0, paper_count: 0 });

    const before = await source.groups.getGroupDetails(round.id);
    const beforeGroup = before.find((d) => d.id === group1.id)!;
    expect(beforeGroup.quiz_score).toBe(35);
    expect(beforeGroup.items_bonus).toBe(20);
    expect(beforeGroup.total_score).toBe(55);

    const backup = await source.backup.generateBackupData();

    const target = createQuizServiceWithDb(await SqlJsTestConnection.create());
    await target.backup.restoreFromData(backup);

    const after = await target.groups.getGroupDetails(round.id);
    const afterGroup = after.find((d) => d.id === group1.id)!;

    // Regression: quiz_score used to be dropped by the restore insert.
    expect(afterGroup.quiz_score).toBe(35);
    expect(afterGroup.items_bonus).toBe(20);
    expect(afterGroup.total_score).toBe(55);
    expect(await target.scores.getPlayerTotalScore(alice.id)).toBe(55);
    expect(await target.scores.getPlayerTotalScore(bob.id)).toBe(55);
  });

  test('a rejected backup leaves existing data untouched', async () => {
    const target = createQuizServiceWithDb(await SqlJsTestConnection.create());
    await target.players.createPlayer('Keep Me');

    const corrupt = {
      version: 1,
      exportedAt: NOW,
      players: [{ id: 'p1', player_number: 1, name: 'Intruder', initial_score: 0, active: 1, created_at: NOW, updated_at: NOW }],
      rounds: [],
      groups: [],
      groupMembers: [],
      scores: [{ id: 's1', round_id: 'missing', player_id: 'p1', points: 1, created_at: NOW, updated_at: NOW }],
    };

    await expect(target.backup.restoreFromData(corrupt)).rejects.toThrow(/round that does not exist/);

    const players = await target.players.getAllPlayers();
    expect(players).toHaveLength(1);
    expect(players[0].name).toBe('Keep Me');
  });
});

describe('Production readiness — scoring invariants', () => {
  let service: QuizService;

  beforeEach(async () => {
    service = createQuizServiceWithDb(await SqlJsTestConnection.create());
  });

  test('editing one member score does not double count the group items bonus', async () => {
    const alice = await service.players.createPlayer('Alice');
    const bob = await service.players.createPlayer('Bob');

    const round = await service.rounds.createRound('2026-10-02', 2);
    const groups = await service.groups.getGroupsByRoundId(round.id);
    const group1 = groups.find((g) => g.group_number === 1)!;

    await service.groups.assignPlayerToGroup(round.id, group1.id, alice.id);
    await service.groups.assignPlayerToGroup(round.id, group1.id, bob.id);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    await service.scores.saveScore(round.id, alice.id, 25);
    await service.scores.saveScore(round.id, bob.id, 15);
    await service.groups.updateGroupItems(group1.id, { book_count: 2, pen_count: 0, paper_count: 0 });

    // Group total: quiz 40 + items 20 = 60, and each member carries 60.
    let detail = (await service.groups.getGroupDetails(round.id)).find((d) => d.id === group1.id)!;
    expect(detail.quiz_score).toBe(40);
    expect(detail.total_score).toBe(60);
    expect(await service.scores.getPlayerTotalScore(alice.id)).toBe(60);

    // Editing one member's individual score re-derives the group total.
    await service.scores.saveScore(round.id, alice.id, 30);

    // Carries are now 30 (Alice) and 60 (Bob). The per-member bonus is removed
    // once for each member, so the group quiz total is 30 + 60 - 2*20 = 50.
    // The old behaviour summed the carries directly and returned 90, inflating
    // the group by a full extra copy of the items bonus on every edit.
    detail = (await service.groups.getGroupDetails(round.id)).find((d) => d.id === group1.id)!;
    expect(detail.quiz_score).toBe(50);
    expect(detail.total_score).toBe(70);
  });

  test('a group without items still reports the plain sum of its members', async () => {
    const alice = await service.players.createPlayer('Alice');
    const bob = await service.players.createPlayer('Bob');

    const round = await service.rounds.createRound('2026-10-02', 2);
    const groups = await service.groups.getGroupsByRoundId(round.id);
    const group1 = groups.find((g) => g.group_number === 1)!;

    await service.groups.assignPlayerToGroup(round.id, group1.id, alice.id);
    await service.groups.assignPlayerToGroup(round.id, group1.id, bob.id);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    await service.scores.saveScore(round.id, alice.id, 25);
    await service.scores.saveScore(round.id, bob.id, 15);
    await service.scores.saveScore(round.id, alice.id, 30);

    const detail = (await service.groups.getGroupDetails(round.id)).find((d) => d.id === group1.id)!;
    expect(detail.quiz_score).toBe(45);
    expect(detail.total_score).toBe(45);
  });

  test('moving a player to another group does not rewrite their score', async () => {
    const alice = await service.players.createPlayer('Alice');

    const round = await service.rounds.createRound('2026-10-02', 2);
    const groups = await service.groups.getGroupsByRoundId(round.id);
    const group1 = groups.find((g) => g.group_number === 1)!;
    const group2 = groups.find((g) => g.group_number === 2)!;

    await service.groups.assignPlayerToGroup(round.id, group1.id, alice.id);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');
    await service.scores.saveScore(round.id, alice.id, 40);
    expect(await service.scores.getPlayerTotalScore(alice.id)).toBe(40);

    // Give the destination group a score, then move the player there.
    await service.scores.saveGroupScore(round.id, group2.id, 90);
    await service.groups.assignPlayerToGroup(round.id, group2.id, alice.id);

    // The player's already-recorded score is untouched.
    expect(await service.scores.getPlayerTotalScore(alice.id)).toBe(40);
  });

  test('removing a player from a round re-derives the group total but keeps their score', async () => {
    const alice = await service.players.createPlayer('Alice');
    const bob = await service.players.createPlayer('Bob');

    const round = await service.rounds.createRound('2026-10-02', 2);
    const groups = await service.groups.getGroupsByRoundId(round.id);
    const group1 = groups.find((g) => g.group_number === 1)!;

    await service.groups.assignPlayerToGroup(round.id, group1.id, alice.id);
    await service.groups.assignPlayerToGroup(round.id, group1.id, bob.id);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');
    await service.scores.saveScore(round.id, alice.id, 25);
    await service.scores.saveScore(round.id, bob.id, 15);

    let detail = (await service.groups.getGroupDetails(round.id)).find((d) => d.id === group1.id)!;
    expect(detail.quiz_score).toBe(40);

    await service.groups.removePlayerFromRound(round.id, alice.id);

    detail = (await service.groups.getGroupDetails(round.id)).find((d) => d.id === group1.id)!;
    expect(detail.quiz_score).toBe(15);
    // The score they already earned is part of their permanent history.
    expect(await service.scores.getPlayerTotalScore(alice.id)).toBe(25);
  });
});

describe('Production readiness — error sanitisation', () => {
  test('a user-facing error message is shown verbatim', () => {
    const error = new UserFacingError('This round is locked.');
    expect(getErrorMessage(error, 'fallback', 'test')).toBe('This round is locked.');
  });

  test('an internal error is replaced and its details are not shown', () => {
    const internal = new Error('SQLITE_CONSTRAINT: UNIQUE failed: players.player_number');
    expect(getErrorMessage(internal, 'Something went wrong.', 'test')).toBe(
      'Something went wrong.'
    );
  });

  test('a non-Error value falls back safely', () => {
    expect(getErrorMessage('raw string failure', 'fallback', 'test')).toBe('fallback');
    expect(getErrorMessage(undefined, 'fallback', 'test')).toBe('fallback');
    expect(getErrorMessage(null, 'fallback', 'test')).toBe('fallback');
  });

  test('UserFacingError survives being thrown and caught', async () => {
    const service = createQuizServiceWithDb(await SqlJsTestConnection.create());
    const player = await service.players.createPlayer('John');
    const round = await service.rounds.createRound('2026-10-02', 2);

    await expect(service.scores.saveScore(round.id, player.id, 10)).rejects.toBeInstanceOf(
      UserFacingError
    );
  });
});
