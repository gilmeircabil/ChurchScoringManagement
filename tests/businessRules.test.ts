import { describe, test, expect, beforeEach } from '@jest/globals';
import { SqlJsTestConnection } from './testDbAdapter';
import { QuizService, createQuizServiceWithDb } from '../src/services/quizService';
import { formatPlayerWithId, formatPlayerIdentifier, assignCompetitionRanks } from '../src/utils/formatters';
import { validatePlayerName, validateScore, validateGroupCount } from '../src/utils/validation';

describe('Quiz Score Manager — Business Rules and Scenarios', () => {
  let service: QuizService;

  beforeEach(async () => {
    const conn = await SqlJsTestConnection.create();
    service = createQuizServiceWithDb(conn);
  });

  // TEST 1 — Add Player
  test('Test 1 — Add player "John" and verify it appears', async () => {
    const player = await service.players.createPlayer('John');
    expect(player).toBeDefined();
    expect(player.name).toBe('John');
    expect(player.player_number).toBe(1);
    expect(formatPlayerIdentifier(player.player_number)).toBe('#001');

    const all = await service.players.getAllPlayers();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('John');
  });

  // TEST 2 — Duplicate Player
  test('Test 2 — Duplicate player: Allow second John after confirmation with distinct ID and sequence', async () => {
    const john1 = await service.players.createPlayer('John');
    
    // Check duplicate detection
    const duplicates = await service.players.findDuplicateNames('John');
    expect(duplicates).toHaveLength(1);

    // Add second John
    const john2 = await service.players.createPlayer('John');
    expect(john2.id).not.toBe(john1.id);
    expect(john2.name).toBe('John');
    expect(john2.player_number).toBe(2);

    expect(formatPlayerWithId(john1.name, john1.player_number)).toBe('John — #001');
    expect(formatPlayerWithId(john2.name, john2.player_number)).toBe('John — #002');

    const all = await service.players.getAllPlayers();
    expect(all).toHaveLength(2);
  });

  // TEST 3 — Search Duplicate
  test('Test 3 — Case-insensitive search finds multiple Johns independently', async () => {
    await service.players.createPlayer('John');
    await service.players.createPlayer('Sarah');
    await service.players.createPlayer('John');

    const results = await service.players.searchPlayers('john');
    expect(results).toHaveLength(2);
    expect(results[0].id).not.toBe(results[1].id);

    const uppercaseResults = await service.players.searchPlayers('JOHN');
    expect(uppercaseResults).toHaveLength(2);
  });

  // TEST 4 — Group Assignment
  test('Test 4 — Create 4 groups, assign John #001 to Group 1 and John #002 to Group 3', async () => {
    const john1 = await service.players.createPlayer('John');
    const john2 = await service.players.createPlayer('John');

    const round = await service.rounds.createRound('2026-09-26', 4);
    expect(round.group_count).toBe(4);

    const groups = await service.groups.getGroupsByRoundId(round.id);
    expect(groups).toHaveLength(4);

    const group1 = groups.find((g) => g.group_number === 1)!;
    const group3 = groups.find((g) => g.group_number === 3)!;

    await service.groups.assignPlayerToGroup(round.id, group1.id, john1.id);
    await service.groups.assignPlayerToGroup(round.id, group3.id, john2.id);

    const assigned = await service.groups.getAssignedMembers(round.id);
    expect(assigned).toHaveLength(2);

    const assignedJohn1 = assigned.find((a) => a.player_id === john1.id);
    const assignedJohn2 = assigned.find((a) => a.player_id === john2.id);

    expect(assignedJohn1?.group_number).toBe(1);
    expect(assignedJohn2?.group_number).toBe(3);
  });

  // TEST 5 — Prevent Duplicate Assignment (One player per round)
  test('Test 5 — Moving player from Group 1 to Group 2 updates assignment and does not create duplicate', async () => {
    const john1 = await service.players.createPlayer('John');
    const round = await service.rounds.createRound('2026-09-26', 4);
    const groups = await service.groups.getGroupsByRoundId(round.id);

    const group1 = groups.find((g) => g.group_number === 1)!;
    const group2 = groups.find((g) => g.group_number === 2)!;

    // Assign to Group 1
    await service.groups.assignPlayerToGroup(round.id, group1.id, john1.id);
    let assigned = await service.groups.getAssignedMembers(round.id);
    expect(assigned).toHaveLength(1);
    expect(assigned[0].group_number).toBe(1);

    // Reassign to Group 2
    await service.groups.assignPlayerToGroup(round.id, group2.id, john1.id);
    assigned = await service.groups.getAssignedMembers(round.id);
    expect(assigned).toHaveLength(1);
    expect(assigned[0].group_number).toBe(2);
  });

  // TEST 6 — Score
  test('Test 6 — Score: Give John #001 +20. Verify total = 20', async () => {
    const john1 = await service.players.createPlayer('John');
    const round = await service.rounds.createRound('2026-09-26', 4);
    const groups = await service.groups.getGroupsByRoundId(round.id);

    await service.groups.assignPlayerToGroup(round.id, groups[0].id, john1.id);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    await service.scores.saveScore(round.id, john1.id, 20);

    const total = await service.scores.getPlayerTotalScore(john1.id);
    expect(total).toBe(20);
  });

  // TEST 7 — Next Round & Cumulative Score
  test('Test 7 — Next round: Create another round, assign John #001 to Group 3, give +15. Verify total = 35', async () => {
    const john1 = await service.players.createPlayer('John');

    // Round 1
    const round1 = await service.rounds.createRound('2026-09-19', 4);
    const groupsR1 = await service.groups.getGroupsByRoundId(round1.id);
    await service.groups.assignPlayerToGroup(round1.id, groupsR1[0].id, john1.id);
    await service.rounds.updateRoundStatus(round1.id, 'ACTIVE');
    await service.scores.saveScore(round1.id, john1.id, 20);
    await service.rounds.updateRoundStatus(round1.id, 'LOCKED');

    // Round 2
    const round2 = await service.rounds.createRound('2026-09-26', 4);
    const groupsR2 = await service.groups.getGroupsByRoundId(round2.id);
    await service.groups.assignPlayerToGroup(round2.id, groupsR2[2].id, john1.id); // Group 3
    await service.rounds.updateRoundStatus(round2.id, 'ACTIVE');
    await service.scores.saveScore(round2.id, john1.id, 15);

    const total = await service.scores.getPlayerTotalScore(john1.id);
    expect(total).toBe(35);
  });

  // TEST 8 — Edit Score
  test('Test 8 — Edit score: Change 15 to 25. Total becomes 45 and not 60', async () => {
    const john1 = await service.players.createPlayer('John');

    // Round 1 (+20)
    const round1 = await service.rounds.createRound('2026-09-19', 4);
    const groupsR1 = await service.groups.getGroupsByRoundId(round1.id);
    await service.groups.assignPlayerToGroup(round1.id, groupsR1[0].id, john1.id);
    await service.rounds.updateRoundStatus(round1.id, 'ACTIVE');
    await service.scores.saveScore(round1.id, john1.id, 20);

    // Round 2 (initially +15)
    const round2 = await service.rounds.createRound('2026-09-26', 4);
    const groupsR2 = await service.groups.getGroupsByRoundId(round2.id);
    await service.groups.assignPlayerToGroup(round2.id, groupsR2[0].id, john1.id);
    await service.rounds.updateRoundStatus(round2.id, 'ACTIVE');
    await service.scores.saveScore(round2.id, john1.id, 15);

    expect(await service.scores.getPlayerTotalScore(john1.id)).toBe(35);

    // Edit round 2 score: 15 -> 25
    await service.scores.saveScore(round2.id, john1.id, 25);

    const newTotal = await service.scores.getPlayerTotalScore(john1.id);
    expect(newTotal).toBe(45);
    expect(newTotal).not.toBe(60);
  });

  // TEST 9 — Reports Ranking
  test('Test 9 — Reports sort individual players from Highest to Lowest', async () => {
    const sarah = await service.players.createPlayer('Sarah');
    const john = await service.players.createPlayer('John');
    const mark = await service.players.createPlayer('Mark');

    const round = await service.rounds.createRound('2026-09-26', 4);
    const groups = await service.groups.getGroupsByRoundId(round.id);

    await service.groups.assignPlayerToGroup(round.id, groups[0].id, sarah.id);
    await service.groups.assignPlayerToGroup(round.id, groups[1].id, john.id);
    await service.groups.assignPlayerToGroup(round.id, groups[2].id, mark.id);

    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    await service.scores.saveScore(round.id, sarah.id, 120);
    await service.scores.saveScore(round.id, john.id, 105);
    await service.scores.saveScore(round.id, mark.id, 98);

    const report = await service.reports.getOverallReport();
    expect(report).toHaveLength(3);
    expect(report[0].player_name).toBe('Sarah');
    expect(report[0].score).toBe(120);
    expect(report[1].player_name).toBe('John');
    expect(report[1].score).toBe(105);
    expect(report[2].player_name).toBe('Mark');
    expect(report[2].score).toBe(98);
  });

  // TEST 10 — Equal Scores
  test('Test 10 — Equal scores share competition rank and preserve individual player identities', async () => {
    const sarah = await service.players.createPlayer('Sarah');
    const john = await service.players.createPlayer('John');
    const mark = await service.players.createPlayer('Mark');
    const anna = await service.players.createPlayer('Anna');

    const round = await service.rounds.createRound('2026-09-26', 4);
    const groups = await service.groups.getGroupsByRoundId(round.id);

    await service.groups.assignPlayerToGroup(round.id, groups[0].id, sarah.id);
    await service.groups.assignPlayerToGroup(round.id, groups[1].id, john.id);
    await service.groups.assignPlayerToGroup(round.id, groups[2].id, mark.id);
    await service.groups.assignPlayerToGroup(round.id, groups[3].id, anna.id);

    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    await service.scores.saveScore(round.id, sarah.id, 120);
    await service.scores.saveScore(round.id, john.id, 105);
    await service.scores.saveScore(round.id, mark.id, 105);
    await service.scores.saveScore(round.id, anna.id, 87);

    const report = await service.reports.getOverallReport();
    expect(report[0].rank).toBe(1);
    expect(report[0].player_name).toBe('Sarah');

    expect(report[1].rank).toBe(2);
    expect(report[2].rank).toBe(2);

    expect(report[3].rank).toBe(4);
    expect(report[3].player_name).toBe('Anna');
  });

  // TEST 11 — Editing Player Name Preserves ID and Score History
  test('Test 11 — Editing player name does not create a new player or affect score history', async () => {
    const player = await service.players.createPlayer('John');
    const round = await service.rounds.createRound('2026-09-26', 2);
    const groups = await service.groups.getGroupsByRoundId(round.id);

    await service.groups.assignPlayerToGroup(round.id, groups[0].id, player.id);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');
    await service.scores.saveScore(round.id, player.id, 50);

    // Edit name
    await service.players.updatePlayerName(player.id, 'Jonathan');

    const updated = await service.players.getPlayerById(player.id);
    expect(updated?.name).toBe('Jonathan');
    expect(updated?.id).toBe(player.id);

    const stats = await service.players.getPlayerWithStats(player.id);
    expect(stats?.total_score).toBe(50);
  });

  // TEST 12 — Locking and Unlocking Rounds
  test('Test 12 — Locked rounds reject modifications; unlocking allows updates', async () => {
    const player = await service.players.createPlayer('John');
    const round = await service.rounds.createRound('2026-09-26', 2);
    const groups = await service.groups.getGroupsByRoundId(round.id);

    await service.groups.assignPlayerToGroup(round.id, groups[0].id, player.id);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');
    await service.scores.saveScore(round.id, player.id, 30);

    // Lock round
    await service.rounds.updateRoundStatus(round.id, 'LOCKED');

    // Attempting to modify locked score should reject
    await expect(service.scores.saveScore(round.id, player.id, 40)).rejects.toThrow(
      'This round is locked'
    );

    // Unlock round
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');
    await service.scores.saveScore(round.id, player.id, 40);

    const total = await service.scores.getPlayerTotalScore(player.id);
    expect(total).toBe(40);
  });

  // TEST 13 — Backup and Atomic Restore
  test('Test 13 — Backup export and restore reproduces exact database state', async () => {
    const john = await service.players.createPlayer('John');
    const sarah = await service.players.createPlayer('Sarah');

    const round = await service.rounds.createRound('2026-09-26', 2);
    const groups = await service.groups.getGroupsByRoundId(round.id);

    await service.groups.assignPlayerToGroup(round.id, groups[0].id, john.id);
    await service.groups.assignPlayerToGroup(round.id, groups[1].id, sarah.id);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    await service.scores.saveScore(round.id, john.id, 25);
    await service.scores.saveScore(round.id, sarah.id, 35);

    // Export backup
    const backupData = await service.backup.generateBackupData();
    expect(backupData.version).toBe(1);
    expect(backupData.players).toHaveLength(2);
    expect(backupData.rounds).toHaveLength(1);
    expect(backupData.scores).toHaveLength(2);

    // In a fresh database
    const freshConn = await SqlJsTestConnection.create();
    const freshService = createQuizServiceWithDb(freshConn);

    await freshService.backup.restoreFromData(backupData);

    const restoredPlayers = await freshService.players.getAllPlayers();
    expect(restoredPlayers).toHaveLength(2);

    const johnTotal = await freshService.scores.getPlayerTotalScore(john.id);
    const sarahTotal = await freshService.scores.getPlayerTotalScore(sarah.id);

    expect(johnTotal).toBe(25);
    expect(sarahTotal).toBe(35);
  });

  // Validation unit tests
  test('Validation — Input validation rules for player names, scores, and groups', () => {
    // Player name
    expect(validatePlayerName('').isValid).toBe(false);
    expect(validatePlayerName('   ').isValid).toBe(false);
    expect(validatePlayerName('  John  ').isValid).toBe(true);
    expect(validatePlayerName('  John  ').trimmedName).toBe('John');

    // Score validation
    expect(validateScore('25').isValid).toBe(true);
    expect(validateScore('0').isValid).toBe(true);
    expect(validateScore('-5').isValid).toBe(false);
    expect(validateScore('abc').isValid).toBe(false);
    expect(validateScore('').isValid).toBe(false);

    // Group count
    expect(validateGroupCount(1).isValid).toBe(false);
    expect(validateGroupCount(4).isValid).toBe(true);
    expect(validateGroupCount(2).isValid).toBe(true);
  });
});
