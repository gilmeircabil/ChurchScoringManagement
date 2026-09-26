import { describe, test, expect, beforeEach } from '@jest/globals';
import { SqlJsTestConnection } from './testDbAdapter';
import { QuizService, createQuizServiceWithDb } from '../src/services/quizService';
import { formatPlayerIdentifier } from '../src/utils/formatters';
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

    expect(formatPlayerIdentifier(john1.player_number)).toBe('#001');
    expect(formatPlayerIdentifier(john2.player_number)).toBe('#002');

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

  // TEST 14 — searchPlayersWithStats returns cumulative score and rounds played
  test('Test 14 — searchPlayersWithStats returns cumulative score and rounds played for each player', async () => {
    const john = await service.players.createPlayer('John');
    const sarah = await service.players.createPlayer('Sarah');

    // Initially 0 scores
    let playersWithStats = await service.players.searchPlayersWithStats('');
    expect(playersWithStats).toHaveLength(2);
    expect(playersWithStats.find((p) => p.id === john.id)?.total_score).toBe(0);
    expect(playersWithStats.find((p) => p.id === john.id)?.rounds_played).toBe(0);

    // Create round, start it, then score John 30, Sarah 40
    const round = await service.rounds.createRound('2026-09-26', 2);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');
    await service.scores.saveScore(round.id, john.id, 30);
    await service.scores.saveScore(round.id, sarah.id, 40);

    playersWithStats = await service.players.searchPlayersWithStats('');
    expect(playersWithStats.find((p) => p.id === john.id)?.total_score).toBe(30);
    expect(playersWithStats.find((p) => p.id === john.id)?.rounds_played).toBe(1);
    expect(playersWithStats.find((p) => p.id === sarah.id)?.total_score).toBe(40);
    expect(playersWithStats.find((p) => p.id === sarah.id)?.rounds_played).toBe(1);
  });

  // TEST 15 — Scores are blocked in DRAFT, editable once ACTIVE, with quick stepper increments/decrements
  test('Test 15 — Scores blocked in DRAFT, editable once ACTIVE, quick stepper increments/decrements', async () => {
    const john = await service.players.createPlayer('John');
    const round = await service.rounds.createRound('2026-09-26', 2);
    expect(round.status).toBe('DRAFT');

    // Scoring is not allowed before the round starts
    await expect(service.scores.saveScore(round.id, john.id, 10)).rejects.toThrow(
      /has not started/i
    );
    expect(await service.scores.getPlayerTotalScore(john.id)).toBe(0);

    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    // Score can be saved once the round is started
    await service.scores.saveScore(round.id, john.id, 10);
    expect(await service.scores.getPlayerTotalScore(john.id)).toBe(10);

    // Quick step +5 -> 15
    await service.scores.saveScore(round.id, john.id, 15);
    expect(await service.scores.getPlayerTotalScore(john.id)).toBe(15);

    // Quick step -5 -> 10
    await service.scores.saveScore(round.id, john.id, 10);
    expect(await service.scores.getPlayerTotalScore(john.id)).toBe(10);

    // Score cannot be negative
    const nonNegative = Math.max(0, 10 - 20);
    await service.scores.saveScore(round.id, john.id, nonNegative);
    expect(await service.scores.getPlayerTotalScore(john.id)).toBe(0);

    // Locking the round blocks scoring again
    await service.rounds.updateRoundStatus(round.id, 'LOCKED');
    await expect(service.scores.saveScore(round.id, john.id, 25)).rejects.toThrow(/locked/i);
    expect(await service.scores.getPlayerTotalScore(john.id)).toBe(0);
  });

  // TEST 16 — Adding player with default score and cumulative calculation
  test('Test 16 — Adding player with default score and cumulative calculation', async () => {
    // Add player with default score = 25
    const david = await service.players.createPlayer('David', 25);
    expect(david.initial_score).toBe(25);

    // Initial total score is 25 even with 0 rounds played
    let stats = await service.players.getPlayerWithStats(david.id);
    expect(stats?.initial_score).toBe(25);
    expect(stats?.total_score).toBe(25);
    expect(stats?.rounds_played).toBe(0);
    expect(await service.scores.getPlayerTotalScore(david.id)).toBe(25);

    // Plays round 1, earns 15 points
    const round = await service.rounds.createRound('2026-09-26', 2);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');
    await service.scores.saveScore(round.id, david.id, 15);

    // Total score becomes 25 + 15 = 40
    expect(await service.scores.getPlayerTotalScore(david.id)).toBe(40);
    stats = await service.players.getPlayerWithStats(david.id);
    expect(stats?.total_score).toBe(40);
    expect(stats?.rounds_played).toBe(1);

    // Update player default score to 30
    await service.players.updatePlayer(david.id, 'David', 30);
    expect(await service.scores.getPlayerTotalScore(david.id)).toBe(45);
    stats = await service.players.getPlayerWithStats(david.id);
    expect(stats?.initial_score).toBe(30);
    expect(stats?.total_score).toBe(45);

    // Check overall report
    const overall = await service.reports.getOverallReport();
    const davidReport = overall.find((r) => r.player_id === david.id);
    expect(davidReport?.score).toBe(45);
  });

  // TEST 17 — Clear history wipes rounds and scores but keeps players
  test('Test 17 — Clear history erases rounds and scores but preserves players', async () => {
    const john = await service.players.createPlayer('John', 20);
    const sara = await service.players.createPlayer('Sara', 15);

    // Two finished rounds with groups and scores
    const roundA = await service.rounds.createRound('2026-09-19', 2);
    const groupsA = await service.groups.getGroupsByRoundId(roundA.id);
    await service.rounds.updateRoundStatus(roundA.id, 'ACTIVE');
    await service.groups.assignPlayerToGroup(roundA.id, groupsA[0].id, john.id);
    await service.groups.assignPlayerToGroup(roundA.id, groupsA[1].id, sara.id);
    await service.scores.saveScore(roundA.id, john.id, 30);
    await service.scores.saveScore(roundA.id, sara.id, 25);
    await service.rounds.updateRoundStatus(roundA.id, 'LOCKED');

    const roundB = await service.rounds.createRound('2026-09-26', 2);
    await service.rounds.updateRoundStatus(roundB.id, 'ACTIVE');
    await service.scores.saveScore(roundB.id, john.id, 10);
    await service.rounds.updateRoundStatus(roundB.id, 'LOCKED');

    expect(await service.rounds.getRoundHistoryList()).toHaveLength(2);

    // Blocked while a round is in progress
    const roundC = await service.rounds.createRound('2026-10-03', 2);
    await service.rounds.updateRoundStatus(roundC.id, 'ACTIVE');
    await expect(service.rounds.clearHistory()).rejects.toThrow(/in progress/i);
    expect(await service.rounds.getRoundHistoryList()).toHaveLength(3);

    // Allowed once nothing is ACTIVE
    await service.rounds.updateRoundStatus(roundC.id, 'LOCKED');
    const removed = await service.rounds.clearHistory();
    expect(removed).toBe(3);

    // Rounds, groups, assignments and scores are gone
    expect(await service.rounds.getRoundHistoryList()).toHaveLength(0);
    expect(await service.groups.getGroupsByRoundId(roundA.id)).toHaveLength(0);
    expect(await service.groups.getAssignedMembers(roundA.id)).toHaveLength(0);
    expect(await service.scores.getScore(roundA.id, john.id)).toBeNull();
    expect(await service.rounds.getCurrentWorkingRound()).toBeNull();

    // Players survive, and their score history is reset to starting scores
    const players = await service.players.getAllPlayers();
    expect(players).toHaveLength(2);
    expect(await service.scores.getPlayerTotalScore(john.id)).toBe(20);
    expect(await service.scores.getPlayerTotalScore(sara.id)).toBe(15);
    expect(await service.players.getPlayerWithStats(john.id)).toMatchObject({
      total_score: 20,
      rounds_played: 0,
    });
  });
});
