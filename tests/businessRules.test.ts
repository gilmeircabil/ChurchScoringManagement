import { describe, test, expect, beforeEach } from '@jest/globals';
import { SqlJsTestConnection } from './testDbAdapter';
import { QuizService, createQuizServiceWithDb } from '../src/services/quizService';
import { formatPlayerIdentifier } from '../src/utils/formatters';
import { validatePlayerName, validateScore, validateGroupCount } from '../src/utils/validation';
import { parseExcelOrCsv } from '../src/utils/excelImport';
import {
  buildPlayersWorkbook,
  buildReportWorkbook,
  buildDatabaseBackupWorkbook,
  exportPlayersRosterToExcel,
  exportReportToExcel,
  exportDatabaseBackupToExcel,
  sanitizeSpreadsheetCell,
} from '../src/utils/excelExport';
import * as XLSX from 'xlsx';
import { GROUP_COLORS, PRIMARY_COLORS, SECONDARY_COLORS } from '../src/utils/groupColors';

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

  // TEST 18 — Group Items Carry Rules (Book, Pen, Paper) Auto Total & Group Score
  test('Test 18 — Auto total book, pen, and paper carry bonus and add into group score', async () => {
    const round = await service.rounds.createRound('2026-09-27', 2);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    const john = await service.players.createPlayer('John');
    const sara = await service.players.createPlayer('Sara');

    const groups = await service.groups.getGroupsByRoundId(round.id);
    const group1 = groups.find((g) => g.group_number === 1)!;

    await service.groups.assignPlayerToGroup(round.id, group1.id, john.id);
    await service.groups.assignPlayerToGroup(round.id, group1.id, sara.id);

    // Enter quiz scores for players
    await service.scores.saveScore(round.id, john.id, 25);
    await service.scores.saveScore(round.id, sara.id, 15);

    // Group quiz subtotal = 25 + 15 = 40
    let details = await service.groups.getGroupDetails(round.id);
    let g1Detail = details.find((d) => d.id === group1.id)!;
    expect(g1Detail.quiz_score).toBe(40);
    expect(g1Detail.items_bonus).toBe(0);
    expect(g1Detail.total_score).toBe(40);

    // Now scoring round is finish: add carried items
    // Group 1 carried: 3 books (10 pts each), 2 pens (5 pts each), 4 papers (5 pts each)
    await service.groups.updateGroupItems(group1.id, {
      book_count: 3,
      pen_count: 2,
      paper_count: 4,
    });

    details = await service.groups.getGroupDetails(round.id);
    g1Detail = details.find((d) => d.id === group1.id)!;

    // Auto total items: 3*10 + 2*5 + 4*5 = 30 + 10 + 20 = 60
    expect(g1Detail.book_count).toBe(3);
    expect(g1Detail.pen_count).toBe(2);
    expect(g1Detail.paper_count).toBe(4);
    expect(g1Detail.items_bonus).toBe(60);

    // Group Total Score = Quiz (40) + Items Bonus (60) = 100
    expect(g1Detail.total_score).toBe(100);
  });

  // TEST 19 — Make Editable Points of Things
  test('Test 19 — Editable points of things (book, pen, paper) auto totals accurately', async () => {
    const round = await service.rounds.createRound('2026-09-27', 2);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    const groups = await service.groups.getGroupsByRoundId(round.id);
    const group1 = groups.find((g) => g.group_number === 1)!;

    // Custom points: Book = 15 pts, Pen = 10 pts, Paper = 2 pts
    await service.groups.updateGroupItems(group1.id, {
      book_count: 4, // 4 * 15 = 60
      pen_count: 3,  // 3 * 10 = 30
      paper_count: 5,// 5 * 2  = 10
      book_points: 15,
      pen_points: 10,
      paper_points: 2,
    });

    const details = await service.groups.getGroupDetails(round.id);
    const g1Detail = details.find((d) => d.id === group1.id)!;

    expect(g1Detail.book_points).toBe(15);
    expect(g1Detail.pen_points).toBe(10);
    expect(g1Detail.paper_points).toBe(2);
    // Auto total = 60 + 30 + 10 = 100
    expect(g1Detail.items_bonus).toBe(100);
    expect(g1Detail.total_score).toBe(100);
  });

  // TEST 20 — Update round item points across all groups in round
  test('Test 20 — updateRoundItemPoints applies custom points across all groups in round', async () => {
    const round = await service.rounds.createRound('2026-09-27', 3);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    // Change round rules: Book = 20 pts, Pen = 8 pts, Paper = 3 pts
    await service.groups.updateRoundItemPoints(round.id, {
      book_points: 20,
      pen_points: 8,
      paper_points: 3,
    });

    const details = await service.groups.getGroupDetails(round.id);
    for (const g of details) {
      expect(g.book_points).toBe(20);
      expect(g.pen_points).toBe(8);
      expect(g.paper_points).toBe(3);
    }
  });

  // TEST 21 — Group Leaderboard Report (Highest to Lowest)
  test('Test 21 — By Group report ranks groups by total score descending with items carry', async () => {
    const round = await service.rounds.createRound('2026-09-27', 2);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    const p1 = await service.players.createPlayer('Player 1');
    const p2 = await service.players.createPlayer('Player 2');

    const groups = await service.groups.getGroupsByRoundId(round.id);
    const g1 = groups.find((g) => g.group_number === 1)!;
    const g2 = groups.find((g) => g.group_number === 2)!;

    await service.groups.assignPlayerToGroup(round.id, g1.id, p1.id);
    await service.groups.assignPlayerToGroup(round.id, g2.id, p2.id);

    // Group 1: 50 quiz pts + 10 items (1 book) = 60 pts
    await service.scores.saveScore(round.id, p1.id, 50);
    await service.groups.updateGroupItems(g1.id, {
      book_count: 1,
      pen_count: 0,
      paper_count: 0,
    });

    // Group 2: 20 quiz pts + 60 items (4 books = 40, 4 pens = 20) = 80 pts
    await service.scores.saveScore(round.id, p2.id, 20);
    await service.groups.updateGroupItems(g2.id, {
      book_count: 4,
      pen_count: 4,
      paper_count: 0,
    });

    const report = await service.reports.getGroupReport(round.id);
    expect(report).toHaveLength(2);

    // Group 2 has 80 pts -> Rank 1
    expect(report[0].group_number).toBe(2);
    expect(report[0].total_score).toBe(80);
    expect(report[0].rank).toBe(1);

    // Group 1 has 60 pts -> Rank 2
    expect(report[1].group_number).toBe(1);
    expect(report[1].total_score).toBe(60);
    expect(report[1].rank).toBe(2);
  });

  // TEST 22 — Locked Round Item Protection
  test('Test 22 — Locked round rejects modifying group items until unlocked', async () => {
    const round = await service.rounds.createRound('2026-09-27', 2);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    const groups = await service.groups.getGroupsByRoundId(round.id);
    const g1 = groups[0];

    await service.rounds.updateRoundStatus(round.id, 'LOCKED');

    await expect(
      service.groups.updateGroupItems(g1.id, {
        book_count: 2,
        pen_count: 1,
        paper_count: 1,
      })
    ).rejects.toThrow(/locked/i);

    // Unlocking allows updates
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');
    await service.groups.updateGroupItems(g1.id, {
      book_count: 2,
      pen_count: 1,
      paper_count: 1,
    });

    const details = await service.groups.getGroupDetails(round.id);
    expect(details[0].book_count).toBe(2);
  });

  // TEST 23 — Custom Item Names & Custom Group Name
  test('Test 23 — Edit item names (e.g. Bible, Pen, Notebook) and custom group name with auto-total', async () => {
    const round = await service.rounds.createRound('2026-09-27', 2);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    const p1 = await service.players.createPlayer('Alice');
    const groups = await service.groups.getGroupsByRoundId(round.id);
    const g1 = groups[0];

    await service.groups.assignPlayerToGroup(round.id, g1.id, p1.id);
    await service.scores.saveScore(round.id, p1.id, 40); // 40 quiz pts

    // Rename items and set group name
    await service.groups.updateGroupItems(g1.id, {
      name: 'Team David',
      book_name: 'Bible',
      pen_name: 'Blue Pen',
      paper_name: 'Notebook',
      book_points: 15,
      pen_points: 5,
      paper_points: 10,
      book_count: 2,   // 2 * 15 = 30
      pen_count: 3,    // 3 * 5 = 15
      paper_count: 1,  // 1 * 10 = 10 -> items bonus = 55
    });

    const details = await service.groups.getGroupDetails(round.id);
    const g1Detail = details.find((d) => d.id === g1.id)!;

    expect(g1Detail.name).toBe('Team David');
    expect(g1Detail.book_name).toBe('Bible');
    expect(g1Detail.pen_name).toBe('Blue Pen');
    expect(g1Detail.paper_name).toBe('Notebook');
    expect(g1Detail.quiz_score).toBe(40);
    expect(g1Detail.items_bonus).toBe(55);
    expect(g1Detail.total_score).toBe(95);

    // Verify report includes the custom group name and item names
    const report = await service.reports.getGroupReport(round.id);
    const g1Report = report.find((r) => r.group_id === g1.id)!;
    expect(g1Report.name).toBe('Team David');
    expect(g1Report.book_name).toBe('Bible');
    expect(g1Report.pen_name).toBe('Blue Pen');
    expect(g1Report.paper_name).toBe('Notebook');
    expect(g1Report.total_score).toBe(95);
  });

  // TEST 24 — Bulk update item rules across all groups in round
  test('Test 24 — updateRoundItemRules applies customized item names and points to all groups', async () => {
    const round = await service.rounds.createRound('2026-09-27', 3);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    await service.groups.updateRoundItemRules(round.id, {
      book_name: 'Scripture',
      pen_name: 'Marker',
      paper_name: 'Pad',
      book_points: 25,
      pen_points: 8,
      paper_points: 4,
    });

    const details = await service.groups.getGroupDetails(round.id);
    expect(details).toHaveLength(3);
    for (const g of details) {
      expect(g.book_name).toBe('Scripture');
      expect(g.pen_name).toBe('Marker');
      expect(g.paper_name).toBe('Pad');
      expect(g.book_points).toBe(25);
      expect(g.pen_points).toBe(8);
      expect(g.paper_points).toBe(4);
    }
  });

  // TEST 25 — Parse Excel/CSV player roster and batch import players with initial scores
  test('Test 25 — Parse Excel/CSV player roster and batch import players with initial scores', async () => {
    // Generate an in-memory workbook with Name and Initial Score headers
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['Name', 'Initial Score'],
      ['Abraham', 50],
      ['Sarah', 30],
      ['Isaac', 15],
      ['Jacob', 0],
      ['', 10], // Invalid empty name row (should be skipped)
      ['Joseph', '25 pts'], // String with points units (should parse 25)
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Roster');
    const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    const parseResult = parseExcelOrCsv(base64, 'roster.xlsx', 'base64');
    expect(parseResult.success).toBe(true);
    expect(parseResult.validRows).toHaveLength(5);
    expect(parseResult.invalidRows).toHaveLength(1); // the empty name row

    expect(parseResult.validRows[0]).toMatchObject({ name: 'Abraham', initialScore: 50 });
    expect(parseResult.validRows[1]).toMatchObject({ name: 'Sarah', initialScore: 30 });
    expect(parseResult.validRows[2]).toMatchObject({ name: 'Isaac', initialScore: 15 });
    expect(parseResult.validRows[3]).toMatchObject({ name: 'Jacob', initialScore: 0 });
    expect(parseResult.validRows[4]).toMatchObject({ name: 'Joseph', initialScore: 25 });

    // Batch create into database
    const batchResult = await service.players.createPlayersBatch(
      parseResult.validRows.map((r) => ({ name: r.name, initialScore: r.initialScore }))
    );

    expect(batchResult.createdCount).toBe(5);
    expect(batchResult.players[0].name).toBe('Abraham');
    expect(batchResult.players[0].player_number).toBe(1);
    expect(batchResult.players[0].initial_score).toBe(50);

    expect(batchResult.players[4].name).toBe('Joseph');
    expect(batchResult.players[4].player_number).toBe(5);
    expect(batchResult.players[4].initial_score).toBe(25);

    // Verify stats & total score reflect initial scores
    const abrahamStats = await service.players.getPlayerWithStats(batchResult.players[0].id);
    expect(abrahamStats?.total_score).toBe(50);
  });

  // TEST 26 — Batch player creation assigns sequential numbers and preserves initial scores
  test('Test 26 — Batch player creation assigns sequential numbers following existing players', async () => {
    // Add existing player first (#001)
    const existing = await service.players.createPlayer('Moses', 10);
    expect(existing.player_number).toBe(1);

    // Batch insert 2 new players (#002, #003)
    const batch = await service.players.createPlayersBatch([
      { name: 'Aaron', initialScore: 20 },
      { name: 'Miriam', initialScore: 15 },
    ]);

    expect(batch.createdCount).toBe(2);
    expect(batch.players[0].player_number).toBe(2);
    expect(batch.players[0].name).toBe('Aaron');
    expect(batch.players[0].initial_score).toBe(20);

    expect(batch.players[1].player_number).toBe(3);
    expect(batch.players[1].name).toBe('Miriam');
    expect(batch.players[1].initial_score).toBe(15);

    const all = await service.players.getAllPlayers();
    expect(all).toHaveLength(3);
  });

  // TEST 27 — Export player roster to Excel (.xlsx) workbook
  test('Test 27 — Export player roster to Excel (.xlsx) workbook with correct headers and player stats', async () => {
    // Setup players
    await service.players.createPlayer('Elijah', 25);
    await service.players.createPlayer('Elisha', 15);

    const playersWithStats = await service.players.searchPlayersWithStats('', true);
    expect(playersWithStats).toHaveLength(2);

    // Build workbook
    const wb = buildPlayersWorkbook(playersWithStats);
    expect(wb.SheetNames).toContain('Players Roster');

    const ws = wb.Sheets['Players Roster'];
    const sheetData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Verify Headers
    expect(sheetData[0]).toEqual([
      'Player ID',
      'Name',
      'Initial Score',
      'Total Score',
      'Rounds Played',
      'Status',
    ]);

    // Verify Rows
    expect(sheetData[1]).toEqual(['#001', 'Elijah', 25, 25, 0, 'Active']);
    expect(sheetData[2]).toEqual(['#002', 'Elisha', 15, 15, 0, 'Active']);

    // Verify export caller executes without throwing
    const res = await exportPlayersRosterToExcel(playersWithStats);
    expect(res.success).toBe(true);
  });

  // TEST 28 — Export scoring reports to multi-sheet Excel (.xlsx) workbook
  test('Test 28 — Export scoring reports to multi-sheet Excel (.xlsx) workbook with group rules & bonuses', async () => {
    const round = await service.rounds.createRound('2026-09-27', 2);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    const p1 = await service.players.createPlayer('Peter', 0);
    const p2 = await service.players.createPlayer('Paul', 0);

    const groups = await service.groups.getGroupsByRoundId(round.id);
    await service.groups.assignPlayerToGroup(round.id, groups[0].id, p1.id);
    await service.groups.assignPlayerToGroup(round.id, groups[1].id, p2.id);

    // Scores
    await service.scores.saveScore(round.id, p1.id, 40);
    await service.scores.saveScore(round.id, p2.id, 50);

    // Group items: Group 1 has 3 books (30 pts), 2 pens (10 pts) -> 40 bonus
    await service.groups.updateGroupItems(groups[0].id, {
      book_count: 3,
      pen_count: 2,
      paper_count: 1,
      book_points: 10,
      pen_points: 5,
      paper_points: 5,
    });

    const overallReport = await service.reports.getOverallReport();
    const groupReport = await service.reports.getGroupReport(round.id);
    const roundReport = await service.reports.getRoundReport(round.id);

    // Build workbook
    const wb = buildReportWorkbook({
      filter: 'overall',
      roundName: 'Round 1 (2026-09-27)',
      overallItems: overallReport,
      groupItems: groupReport,
      roundItems: roundReport,
    });

    expect(wb.SheetNames).toContain('Overall Leaderboard');
    expect(wb.SheetNames).toContain('Group Standings');
    expect(wb.SheetNames).toContain('Round Scores');

    // Verify Overall Leaderboard
    const wsOverall = wb.Sheets['Overall Leaderboard'];
    const overallData: any[][] = XLSX.utils.sheet_to_json(wsOverall, { header: 1 });
    expect(overallData[0]).toEqual(['Rank', 'Player ID', 'Player Name', 'Total Score', 'Rounds Played']);
    // Peter has 40 quiz + 45 carry items bonus = 85, Paul has 50 quiz + 0 carry = 50
    expect(overallData[1]).toEqual([1, '#001', 'Peter', 85, 1]);
    expect(overallData[2]).toEqual([2, '#002', 'Paul', 50, 1]);

    // Verify Group Standings with items bonus carry
    const wsGroup = wb.Sheets['Group Standings'];
    const groupData: any[][] = XLSX.utils.sheet_to_json(wsGroup, { header: 1 });
    expect(groupData[0]).toEqual([
      'Rank',
      'Group Name',
      'Members Count',
      'Quiz Score',
      'Items Bonus (Carry)',
      'Total Group Score',
    ]);
    // Group 1: Quiz = 40, Items Bonus = 30 + 10 + 5 = 45, Total = 85
    // Group 2: Quiz = 50, Items Bonus = 0, Total = 50
    // Group 1 is Rank 1 with 85 total!
    expect(groupData[1][0]).toBe(1);
    expect(groupData[1][1]).toContain('Group 1');
    expect(groupData[1][4]).toBe(45);
    expect(groupData[1][5]).toBe(85);

    // Verify export caller executes without throwing
    const res = await exportReportToExcel({
      filter: 'overall',
      overallItems: overallReport,
      groupItems: groupReport,
      roundItems: roundReport,
    });
    expect(res.success).toBe(true);
  });

  // TEST 29 — Export full database backup into multi-sheet Excel (.xlsx) workbook
  test('Test 29 — Export full database backup into multi-sheet Excel workbook with all 4 core tables', async () => {
    // Generate backup
    const backupData = await service.backup.generateBackupData();
    const wb = buildDatabaseBackupWorkbook(backupData);

    expect(wb.SheetNames).toEqual(['Players', 'Rounds', 'Groups', 'Scores']);

    const wsPlayers = wb.Sheets['Players'];
    const playersData: any[][] = XLSX.utils.sheet_to_json(wsPlayers, { header: 1 });
    expect(playersData[0]).toEqual(['ID', 'Player #', 'Name', 'Initial Score', 'Active', 'Created At']);

    const wsRounds = wb.Sheets['Rounds'];
    const roundsData: any[][] = XLSX.utils.sheet_to_json(wsRounds, { header: 1 });
    expect(roundsData[0]).toEqual(['ID', 'Round Date', 'Status', 'Group Count', 'Created At']);

    const wsGroups = wb.Sheets['Groups'];
    const groupsData: any[][] = XLSX.utils.sheet_to_json(wsGroups, { header: 1 });
    expect(groupsData[0]).toContain('Book Carry');
    expect(groupsData[0]).toContain('Pen Carry');

    const res = await exportDatabaseBackupToExcel(backupData);
    expect(res.success).toBe(true);
  });

  // TEST 30 — Group-level scoring: Score is added per group and synchronizes all group members
  test('Test 30 — Adding score per group sets group quiz_score and synchronizes member scores', async () => {
    const round = await service.rounds.createRound('2026-09-30', 2);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    const alice = await service.players.createPlayer('Alice');
    const bob = await service.players.createPlayer('Bob');
    const charlie = await service.players.createPlayer('Charlie');

    const groups = await service.groups.getGroupsByRoundId(round.id);
    const group1 = groups.find((g) => g.group_number === 1)!;
    const group2 = groups.find((g) => g.group_number === 2)!;

    await service.groups.assignPlayerToGroup(round.id, group1.id, alice.id);
    await service.groups.assignPlayerToGroup(round.id, group1.id, bob.id);
    await service.groups.assignPlayerToGroup(round.id, group2.id, charlie.id);

    // Save group-level score: 35 points for Group 1
    await service.scores.saveGroupScore(round.id, group1.id, 35);

    // Verify group details
    let details = await service.groups.getGroupDetails(round.id);
    let g1 = details.find((d) => d.id === group1.id)!;
    expect(g1.quiz_score).toBe(35);
    expect(g1.total_score).toBe(35);

    // Verify both Alice and Bob received 35 points in the round
    expect(g1.members).toHaveLength(2);
    expect(g1.members.find((m) => m.player_id === alice.id)?.round_score).toBe(35);
    expect(g1.members.find((m) => m.player_id === bob.id)?.round_score).toBe(35);

    // Verify player leaderboard / cumulative stats reflect group score
    const playersWithStats = await service.players.searchPlayersWithStats('');
    const aliceStats = playersWithStats.find((p) => p.id === alice.id)!;
    const bobStats = playersWithStats.find((p) => p.id === bob.id)!;
    expect(aliceStats.total_score).toBe(35);
    expect(bobStats.total_score).toBe(35);

    // Add items bonus to Group 1 (e.g. 2 books @ 10 pts = 20 pts)
    await service.groups.updateGroupItems(group1.id, {
      book_count: 2,
      pen_count: 0,
      paper_count: 0,
    });

    details = await service.groups.getGroupDetails(round.id);
    g1 = details.find((d) => d.id === group1.id)!;
    expect(g1.quiz_score).toBe(35);
    expect(g1.items_bonus).toBe(20);
    expect(g1.total_score).toBe(55);

    // Carry total is added to the players also: Alice and Bob now have 55 (35 quiz + 20 carry)
    const updatedStats = await service.players.searchPlayersWithStats('');
    const aliceUpdated = updatedStats.find((p) => p.id === alice.id)!;
    const bobUpdated = updatedStats.find((p) => p.id === bob.id)!;
    expect(aliceUpdated.total_score).toBe(55);
    expect(bobUpdated.total_score).toBe(55);
    expect(g1.members.find((m) => m.player_id === alice.id)?.round_score).toBe(55);
    expect(g1.members.find((m) => m.player_id === bob.id)?.round_score).toBe(55);
  });

  // TEST 31 — Group-level scoring rejects updates when round is LOCKED or DRAFT
  test('Test 31 — Group-level scoring enforces round status constraints', async () => {
    const draftRound = await service.rounds.createRound('2026-10-01', 2);
    const groups = await service.groups.getGroupsByRoundId(draftRound.id);
    const g1 = groups[0];

    // Cannot score in DRAFT
    await expect(
      service.scores.saveGroupScore(draftRound.id, g1.id, 20)
    ).rejects.toThrow('This round has not started');

    // Activate round
    await service.rounds.updateRoundStatus(draftRound.id, 'ACTIVE');
    await service.scores.saveGroupScore(draftRound.id, g1.id, 20);

    // Lock round
    await service.rounds.updateRoundStatus(draftRound.id, 'LOCKED');

    // Cannot score in LOCKED
    await expect(
      service.scores.saveGroupScore(draftRound.id, g1.id, 30)
    ).rejects.toThrow('This round is locked');
  });

  // TEST 32 — Centralized item rules: Custom names and points apply to new rounds and sync across unlocked rounds
  test('Test 32 — Centralized item rules apply to new rounds and sync across active unlocked rounds', async () => {
    // Create an unlocked round with custom default rules (as configured from Settings)
    const customRules = {
      book_name: 'Bible',
      book_points: 15,
      pen_name: 'Marker',
      pen_points: 8,
      paper_name: 'Journal',
      paper_points: 6,
    };

    const round = await service.rounds.createRound('2026-10-05', 2, customRules);
    const groups = await service.groups.getGroupsByRoundId(round.id);
    expect(groups[0].book_name).toBe('Bible');
    expect(groups[0].book_points).toBe(15);
    expect(groups[0].pen_name).toBe('Marker');
    expect(groups[0].pen_points).toBe(8);
    expect(groups[0].paper_name).toBe('Journal');
    expect(groups[0].paper_points).toBe(6);

    // Give items bonus to Group 1 (2 Bibles, 1 Marker, 1 Journal)
    // 2*15 + 1*8 + 1*6 = 30 + 8 + 6 = 44
    await service.groups.updateGroupItems(groups[0].id, {
      book_count: 2,
      pen_count: 1,
      paper_count: 1,
    });

    let details = await service.groups.getGroupDetails(round.id);
    expect(details[0].items_bonus).toBe(44);

    // Now update settings globally to new points (e.g. Bible: 10, Marker: 5, Journal: 5)
    // and sync to unlocked round
    await service.groups.updateRoundItemRules(round.id, {
      book_name: 'Book',
      book_points: 10,
      pen_name: 'Pen',
      pen_points: 5,
      paper_name: 'Paper',
      paper_points: 5,
    });

    // Verify auto-total recalculated: 2*10 + 1*5 + 1*5 = 30
    details = await service.groups.getGroupDetails(round.id);
    expect(details[0].book_name).toBe('Book');
    expect(details[0].book_points).toBe(10);
    expect(details[0].items_bonus).toBe(30);
  });

  // TEST 35 — Group Color Defaults & Group Name Update
  test('Test 35 — Groups have default color names and allow updating group name directly', async () => {
    const round = await service.rounds.createRound('2026-10-16', 5);
    const groups = await service.groups.getGroupsByRoundId(round.id);

    expect(groups).toHaveLength(5);
    expect(groups[0].name).toBe('Red');
    expect(groups[1].name).toBe('Blue');
    expect(groups[2].name).toBe('Green');
    expect(groups[3].name).toBe('Yellow');
    expect(groups[4].name).toBe('Orange');

    // Update group name directly
    await service.groups.updateGroupName(groups[0].id, 'Red Warriors');
    const updated = await service.groups.getGroupsByRoundId(round.id);
    expect(updated[0].name).toBe('Red Warriors');
  });

  // TEST 36 — Single Round Deletion in History
  test('Test 36 — Deleting a single round erases its groups, assignments, and scores without touching players', async () => {
    const p1 = await service.players.createPlayer('Gideon');
    const r1 = await service.rounds.createRound('2026-10-10', 2);
    const r2 = await service.rounds.createRound('2026-10-17', 2);

    const groups = await service.groups.getGroupsByRoundId(r1.id);
    await service.groups.assignPlayerToGroup(r1.id, groups[0].id, p1.id);
    await service.rounds.updateRoundStatus(r1.id, 'ACTIVE');
    await service.scores.saveScore(r1.id, p1.id, 20);

    // Delete r1
    await service.rounds.deleteRound(r1.id);

    const history = await service.rounds.getRoundHistoryList();
    expect(history.some((h) => h.id === r1.id)).toBe(false);
    expect(history.some((h) => h.id === r2.id)).toBe(true);

    // Player still survives
    const p = await service.players.getPlayerById(p1.id);
    expect(p?.name).toBe('Gideon');
  });

  // TEST 37 — Individual Player Scoring within Group
  test('Test 37 — Individual player scores update player totals and group quiz score', async () => {
    const p1 = await service.players.createPlayer('Alice');
    const p2 = await service.players.createPlayer('Bob');

    const round = await service.rounds.createRound('2026-10-16', 2);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    const groups = await service.groups.getGroupsByRoundId(round.id);
    const g1 = groups[0];

    await service.groups.assignPlayerToGroup(round.id, g1.id, p1.id);
    await service.groups.assignPlayerToGroup(round.id, g1.id, p2.id);

    // Alice answers a 10-point question
    await service.scores.saveScore(round.id, p1.id, 10);

    // Bob answers a 15-point question
    await service.scores.saveScore(round.id, p2.id, 15);

    const members = await service.groups.getAssignedMembers(round.id);
    const aliceMember = members.find((m) => m.player_id === p1.id);
    const bobMember = members.find((m) => m.player_id === p2.id);

    expect(aliceMember?.round_score).toBe(10);
    expect(bobMember?.round_score).toBe(15);

    const details = await service.groups.getGroupDetails(round.id);
    const g1Detail = details.find((d) => d.id === g1.id);

    // Group quiz score is the sum of members' individual quiz scores
    expect(g1Detail?.quiz_score).toBe(25);
    expect(g1Detail?.total_score).toBe(25);
  });

  // TEST 38 — 9 group colors categorized into Primary and Secondary choices
  test('Test 38 — Exactly 9 colors available, properly categorized into Primary and Secondary choices', () => {
    expect(GROUP_COLORS).toHaveLength(9);
    expect(PRIMARY_COLORS).toHaveLength(3);
    expect(SECONDARY_COLORS).toHaveLength(6);

    const primaryNames = PRIMARY_COLORS.map((c) => c.name);
    expect(primaryNames).toEqual(['Red', 'Blue', 'Yellow']);

    const secondaryNames = SECONDARY_COLORS.map((c) => c.name);
    expect(secondaryNames).toEqual(['Green', 'Orange', 'Purple', 'Pink', 'Teal', 'Brown']);

    // Every color has hex, lightHex, borderHex, textHex, and category
    for (const c of GROUP_COLORS) {
      expect(c.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.lightHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.borderHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.textHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(['primary', 'secondary']).toContain(c.category);
    }
  });

  // TEST 39 — Item 4 (Bible) carry bonus, editable points, custom names, and round rules propagation
  test('Test 39 — Item 4 (Bible) defaults, custom points/names, and round propagation calculate bonus properly', async () => {
    const round = await service.rounds.createRound('2026-10-17', 2);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    const groups = await service.groups.getGroupsByRoundId(round.id);
    const g1 = groups[0];
    const g2 = groups[1];

    // Check defaults: bible_count = 0, bible_points = 5, bible_name = 'Bible'
    let details = await service.groups.getGroupDetails(round.id);
    let g1Detail = details.find((d) => d.id === g1.id)!;
    expect(g1Detail.bible_count).toBe(0);
    expect(g1Detail.bible_points).toBe(5);
    expect(g1Detail.bible_name).toBe('Bible');

    // Group 1 carries 2 Bibles (2 * 5 = 10 pts) + 1 Book (10 pts) = 20 pts items bonus
    await service.groups.updateGroupItems(g1.id, {
      book_count: 1,
      pen_count: 0,
      paper_count: 0,
      bible_count: 2,
    });

    details = await service.groups.getGroupDetails(round.id);
    g1Detail = details.find((d) => d.id === g1.id)!;
    expect(g1Detail.bible_count).toBe(2);
    expect(g1Detail.items_bonus).toBe(20);

    // Apply custom rules to all groups in round: Item 4 named "Songbook" with 8 points
    await service.groups.updateRoundItemRules(round.id, {
      book_points: 10,
      pen_points: 5,
      paper_points: 5,
      bible_points: 8,
      book_name: 'Book',
      pen_name: 'Pen',
      paper_name: 'Paper',
      bible_name: 'Songbook',
    });

    details = await service.groups.getGroupDetails(round.id);
    for (const g of details) {
      expect(g.bible_points).toBe(8);
      expect(g.bible_name).toBe('Songbook');
    }

    // Now Group 1 with 2 Songbooks (2 * 8 = 16) + 1 Book (10) = 26 items bonus
    const g1Updated = details.find((d) => d.id === g1.id)!;
    expect(g1Updated.items_bonus).toBe(26);
  });

  // TEST 40 — Item 4 (Bible) included in Group Leaderboard report
  test('Test 40 — Group report includes bible_count, bible_points, and bible_name in totals', async () => {
    const round = await service.rounds.createRound('2026-10-17', 1);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    const groups = await service.groups.getGroupsByRoundId(round.id);
    const g1 = groups[0];

    await service.scores.saveGroupScore(round.id, g1.id, 50);
    await service.groups.updateGroupItems(g1.id, {
      book_count: 2,  // 2 * 10 = 20
      pen_count: 1,   // 1 * 5 = 5
      paper_count: 3, // 3 * 5 = 15
      bible_count: 4, // 4 * 5 = 20
    });

    const report = await service.reports.getGroupReport(round.id);
    expect(report).toHaveLength(1);
    expect(report[0].quiz_score).toBe(50);
    expect(report[0].book_count).toBe(2);
    expect(report[0].pen_count).toBe(1);
    expect(report[0].paper_count).toBe(3);
    expect(report[0].bible_count).toBe(4);
    // items bonus = 20 + 5 + 15 + 20 = 60
    expect(report[0].items_bonus).toBe(60);
    // total score = 50 + 60 = 110
    expect(report[0].total_score).toBe(110);
  });

  // TEST 41 — Individual Bonus Round points only add to individual player, NOT group score
  test('Test 41 — Individual bonus points awarded after round lock only increase player score, never group score', async () => {
    const round = await service.rounds.createRound('2026-10-18', 2);
    await service.rounds.updateRoundStatus(round.id, 'ACTIVE');

    const alice = await service.players.createPlayer('Alice');
    const bob = await service.players.createPlayer('Bob');
    const charlie = await service.players.createPlayer('Charlie');

    const groups = await service.groups.getGroupsByRoundId(round.id);
    const g1 = groups[0];
    const g2 = groups[1];

    await service.groups.assignPlayerToGroup(round.id, g1.id, alice.id);
    await service.groups.assignPlayerToGroup(round.id, g1.id, bob.id);
    await service.groups.assignPlayerToGroup(round.id, g2.id, charlie.id);

    // Group 1: 40 quiz score + 10 items carry (1 book) = 50 total score
    await service.scores.saveGroupScore(round.id, g1.id, 40);
    await service.groups.updateGroupItems(g1.id, { book_count: 1, pen_count: 0, paper_count: 0, bible_count: 0 });

    // Group 2: 60 quiz score + 0 items = 60 total score
    await service.scores.saveGroupScore(round.id, g2.id, 60);

    // Round is finished and LOCKED
    await service.rounds.updateRoundStatus(round.id, 'LOCKED');

    let gDetails = await service.groups.getGroupDetails(round.id);
    expect(gDetails.find((g) => g.id === g1.id)!.total_score).toBe(50);
    expect(gDetails.find((g) => g.id === g2.id)!.total_score).toBe(60);

    // POST-ROUND: Individual Bonus Round!
    // Alice wins 15 bonus points in the individual bonus round
    await service.scores.saveIndividualBonus(round.id, alice.id, 15);

    // 1. Group 1 total score MUST REMAIN 50 (NEVER changes to 65)
    gDetails = await service.groups.getGroupDetails(round.id);
    const g1After = gDetails.find((g) => g.id === g1.id)!;
    expect(g1After.quiz_score).toBe(40);
    expect(g1After.items_bonus).toBe(10);
    expect(g1After.total_score).toBe(50);

    // 2. Bob's score MUST REMAIN 50
    const members = await service.groups.getAssignedMembers(round.id);
    const bobMember = members.find((m) => m.player_id === bob.id)!;
    expect(bobMember.group_score).toBe(50);
    expect(bobMember.bonus_points).toBe(0);
    expect(bobMember.round_score).toBe(50);

    // 3. Alice's score is now 65 (50 group baseline + 15 individual bonus)
    const aliceMember = members.find((m) => m.player_id === alice.id)!;
    expect(aliceMember.group_score).toBe(50);
    expect(aliceMember.bonus_points).toBe(15);
    expect(aliceMember.round_score).toBe(65);

    // 4. By Group Leaderboard: Group 2 remains Rank 1 (60 pts), Group 1 remains Rank 2 (50 pts)
    const groupReport = await service.reports.getGroupReport(round.id);
    expect(groupReport[0].group_id).toBe(g2.id);
    expect(groupReport[0].total_score).toBe(60);
    expect(groupReport[1].group_id).toBe(g1.id);
    expect(groupReport[1].total_score).toBe(50);

    // 5. By Player Leaderboard: Alice is Rank 1 (65 pts), Charlie Rank 2 (60 pts), Bob Rank 3 (50 pts)
    const playerReport = await service.reports.getRoundReport(round.id);
    expect(playerReport[0].player_id).toBe(alice.id);
    expect(playerReport[0].score).toBe(65);
    expect(playerReport[0].bonus_points).toBe(15);
    expect(playerReport[1].player_id).toBe(charlie.id);
    expect(playerReport[1].score).toBe(60);
    expect(playerReport[2].player_id).toBe(bob.id);
    expect(playerReport[2].score).toBe(50);

    // 6. Overall cumulative report: Alice has 65 all-time total score
    const overallReport = await service.reports.getOverallReport();
    const aliceOverall = overallReport.find((p) => p.player_id === alice.id)!;
    expect(aliceOverall.score).toBe(65);
  });

  // TEST 39 — Security: Spreadsheet formula injection prevention (CWE-1236)
  test('Test 39 — Security: sanitizeSpreadsheetCell neutralizes formula injection payloads starting with =, +, -, @, \\t, \\r', async () => {
    // Normal text is untouched
    expect(sanitizeSpreadsheetCell('John Doe')).toBe('John Doe');
    expect(sanitizeSpreadsheetCell('Group 1 — Champions')).toBe('Group 1 — Champions');
    expect(sanitizeSpreadsheetCell(100)).toBe(100);
    expect(sanitizeSpreadsheetCell(0)).toBe(0);
    expect(sanitizeSpreadsheetCell(null)).toBe(null);
    expect(sanitizeSpreadsheetCell(undefined)).toBe(undefined);

    // Dangerous formula prefixes get prepended with a single quote (')
    expect(sanitizeSpreadsheetCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(sanitizeSpreadsheetCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(sanitizeSpreadsheetCell('-2+5')).toBe("'-2+5");
    expect(sanitizeSpreadsheetCell('@HYPERLINK("http://evil.com","Click")')).toBe("'@HYPERLINK(\"http://evil.com\",\"Click\")");
    expect(sanitizeSpreadsheetCell('\tLeadingTab')).toBe("'\tLeadingTab");
    expect(sanitizeSpreadsheetCell('\rLeadingCR')).toBe("'\rLeadingCR");

    // Integration check: Workbook rows with malicious player names are safely escaped
    const p1 = await service.players.createPlayer('=cmd|calc', 0);
    const p2 = await service.players.createPlayer('+malicious', 0);
    const p3 = await service.players.createPlayer('Safe Player', 0);

    const playersWithStats = await service.players.searchPlayersWithStats('', true);
    const wb = buildPlayersWorkbook(playersWithStats);
    const ws = wb.Sheets['Players Roster'];
    const sheetData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    const p1Row = sheetData.find((row) => row[0] === formatPlayerIdentifier(p1.player_number));
    const p2Row = sheetData.find((row) => row[0] === formatPlayerIdentifier(p2.player_number));
    const p3Row = sheetData.find((row) => row[0] === formatPlayerIdentifier(p3.player_number));

    expect(p1Row?.[1]).toBe("'=cmd|calc");
    expect(p2Row?.[1]).toBe("'+malicious");
    expect(p3Row?.[1]).toBe("Safe Player");
  });
});

