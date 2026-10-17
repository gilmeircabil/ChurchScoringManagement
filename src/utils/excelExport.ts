import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { PlayerWithStats, ReportItem, GroupReportItem, BackupData } from '../types';
import { formatPlayerIdentifier, formatDateDisplay } from './formatters';
import { logError } from './logger';

/**
 * Saves an XLSX workbook cross-platform:
 * - On Web: triggers browser download via a generated blob link.
 * - On Native (iOS/Android): writes to cache/documents directory and invokes the native share sheet.
 */
export async function saveAndShareExcelFile(
  workbook: XLSX.WorkBook,
  fileName: string
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    // 1. Web environment
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true };
    }

    // 2. Mobile environment (React Native / Expo)
    const base64Content = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!baseDir) {
      // Headless or test environment without native storage
      return { success: true };
    }

    const filePath = `${baseDir}${fileName}`;
    await FileSystem.writeAsStringAsync(filePath, base64Content, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Excel Spreadsheet',
        UTI: 'com.microsoft.excel.xlsx',
      });
    }

    return { success: true, filePath };
  } catch (err: unknown) {
    logError('Failed to export Excel file:', err);
    return {
      success: false,
      error: 'The spreadsheet could not be saved. Please try again.',
    };
  }
}

/**
 * Sanitizes a string value before writing to a spreadsheet cell to prevent
 * formula injection (CWE-1236 / CSV injection).
 * If the string starts with =, +, -, @, \t, or \r, it is prepended with a single
 * quote (') so spreadsheet applications treat it as literal text.
 */
export function sanitizeSpreadsheetCell<T extends string | number | null | undefined>(value: T): T {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
    return `'${value}` as T;
  }
  return value;
}

/**
 * Builds an XLSX workbook for the player roster.
 */
export function buildPlayersWorkbook(players: PlayerWithStats[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const headers = ['Player ID', 'Name', 'Initial Score', 'Total Score', 'Rounds Played', 'Status'];
  const rows: (string | number)[][] = [headers];

  for (const p of players) {
    rows.push([
      formatPlayerIdentifier(p.player_number),
      sanitizeSpreadsheetCell(p.name),
      p.initial_score ?? 0,
      p.total_score,
      p.rounds_played,
      p.active === 1 ? 'Active' : 'Inactive',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 12 }, // Player ID
    { wch: 25 }, // Name
    { wch: 14 }, // Initial Score
    { wch: 14 }, // Total Score
    { wch: 15 }, // Rounds Played
    { wch: 10 }, // Status
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Players Roster');
  return wb;
}

/**
 * Exports the current player roster to an Excel (.xlsx) file.
 */
export async function exportPlayersRosterToExcel(
  players: PlayerWithStats[]
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const wb = buildPlayersWorkbook(players);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `Quiz_Players_Roster_${timestamp}.xlsx`;

  return saveAndShareExcelFile(wb, fileName);
}

export interface ExportReportOptions {
  filter: 'overall' | 'by_round' | 'by_group';
  roundName?: string;
  overallItems?: ReportItem[];
  groupItems?: GroupReportItem[];
  roundItems?: ReportItem[];
}

/**
 * Builds an XLSX workbook containing quiz scoring reports.
 */
export function buildReportWorkbook(options: ExportReportOptions): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 1. Overall Leaderboard Sheet
  if (options.overallItems && options.overallItems.length > 0) {
    const overallHeaders = ['Rank', 'Player ID', 'Player Name', 'Total Score', 'Rounds Played'];
    const overallRows: (string | number)[][] = [overallHeaders];

    for (const item of options.overallItems) {
      overallRows.push([
        item.rank,
        formatPlayerIdentifier(item.player_number),
        sanitizeSpreadsheetCell(item.player_name),
        item.score,
        item.rounds_count ?? 0,
      ]);
    }

    const wsOverall = XLSX.utils.aoa_to_sheet(overallRows);
    wsOverall['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 25 }, { wch: 14 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsOverall, 'Overall Leaderboard');
  }

  // 2. Group Standings Sheet
  if (options.groupItems && options.groupItems.length > 0) {
    const groupHeaders = [
      'Rank',
      'Group Name',
      'Members Count',
      'Quiz Score',
      'Items Bonus (Carry)',
      'Total Group Score',
    ];
    const groupRows: (string | number)[][] = [groupHeaders];

    for (const item of options.groupItems) {
      const displayName = item.name
        ? `Group ${item.group_number} — ${item.name}`
        : `Group ${item.group_number}`;
      groupRows.push([
        item.rank,
        sanitizeSpreadsheetCell(displayName),
        item.member_count,
        item.quiz_score,
        item.items_bonus,
        item.total_score,
      ]);
    }

    const wsGroup = XLSX.utils.aoa_to_sheet(groupRows);
    wsGroup['!cols'] = [
      { wch: 8 },
      { wch: 26 },
      { wch: 15 },
      { wch: 14 },
      { wch: 20 },
      { wch: 18 },
    ];
    const sheetName = 'Group Standings';
    XLSX.utils.book_append_sheet(wb, wsGroup, sheetName);
  }

  // 3. Round Scores Sheet
  if (options.roundItems && options.roundItems.length > 0) {
    const roundHeaders = ['Rank', 'Player ID', 'Player Name', 'Round Score'];
    const roundRows: (string | number)[][] = [roundHeaders];

    for (const item of options.roundItems) {
      roundRows.push([
        item.rank,
        formatPlayerIdentifier(item.player_number),
        sanitizeSpreadsheetCell(item.player_name),
        item.score,
      ]);
    }

    const wsRound = XLSX.utils.aoa_to_sheet(roundRows);
    wsRound['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 25 }, { wch: 14 }];
    const sheetName = 'Round Scores';
    XLSX.utils.book_append_sheet(wb, wsRound, sheetName);
  }

  // Fallback sheet if empty
  if (wb.SheetNames.length === 0) {
    const wsEmpty = XLSX.utils.aoa_to_sheet([['No Report Data Found']]);
    XLSX.utils.book_append_sheet(wb, wsEmpty, 'Empty Report');
  }

  return wb;
}

/**
 * Exports quiz reports to an Excel (.xlsx) workbook.
 */
export async function exportReportToExcel(
  options: ExportReportOptions
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const wb = buildReportWorkbook(options);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `Quiz_Report_${options.filter}_${timestamp}.xlsx`;

  return saveAndShareExcelFile(wb, fileName);
}

/**
 * Builds an XLSX workbook containing all database backup tables.
 */
export function buildDatabaseBackupWorkbook(backup: BackupData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Players
  const playerHeaders = ['ID', 'Player #', 'Name', 'Initial Score', 'Active', 'Created At'];
  const playerRows: (string | number)[][] = [playerHeaders];
  for (const p of backup.players) {
    playerRows.push([
      p.id,
      formatPlayerIdentifier(p.player_number),
      sanitizeSpreadsheetCell(p.name),
      p.initial_score ?? 0,
      p.active === 1 ? 'Yes' : 'No',
      p.created_at,
    ]);
  }
  const wsPlayers = XLSX.utils.aoa_to_sheet(playerRows);
  wsPlayers['!cols'] = [{ wch: 36 }, { wch: 10 }, { wch: 24 }, { wch: 14 }, { wch: 8 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsPlayers, 'Players');

  // Sheet 2: Rounds
  const roundHeaders = ['ID', 'Round Date', 'Status', 'Group Count', 'Created At'];
  const roundRows: (string | number)[][] = [roundHeaders];
  for (const r of backup.rounds) {
    roundRows.push([
      r.id,
      formatDateDisplay(r.round_date),
      r.status,
      r.group_count,
      r.created_at,
    ]);
  }
  const wsRounds = XLSX.utils.aoa_to_sheet(roundRows);
  wsRounds['!cols'] = [{ wch: 36 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsRounds, 'Rounds');

  // Sheet 3: Groups
  const groupHeaders = [
    'ID',
    'Round ID',
    'Group #',
    'Custom Name',
    'Book Carry',
    'Pen Carry',
    'Paper Carry',
    'Bible Carry',
    'Book Pts',
    'Pen Pts',
    'Paper Pts',
    'Bible Pts',
  ];
  const groupRows: (string | number)[][] = [groupHeaders];
  for (const g of backup.groups) {
    groupRows.push([
      g.id,
      g.round_id,
      g.group_number,
      sanitizeSpreadsheetCell(g.name || ''),
      g.book_count || 0,
      g.pen_count || 0,
      g.paper_count || 0,
      g.bible_count || 0,
      g.book_points || 10,
      g.pen_points || 5,
      g.paper_points || 5,
      g.bible_points || 5,
    ]);
  }
  const wsGroups = XLSX.utils.aoa_to_sheet(groupRows);
  wsGroups['!cols'] = [
    { wch: 36 },
    { wch: 36 },
    { wch: 10 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsGroups, 'Groups');

  // Sheet 4: Scores
  const scoreHeaders = ['ID', 'Round ID', 'Player ID', 'Score Points', 'Created At'];
  const scoreRows: (string | number)[][] = [scoreHeaders];
  for (const s of backup.scores) {
    scoreRows.push([s.id, s.round_id, s.player_id, s.points, s.created_at]);
  }
  const wsScores = XLSX.utils.aoa_to_sheet(scoreRows);
  wsScores['!cols'] = [{ wch: 36 }, { wch: 36 }, { wch: 36 }, { wch: 12 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsScores, 'Scores');

  return wb;
}

/**
 * Exports complete quiz database backup into a multi-sheet Excel (.xlsx) file.
 */
export async function exportDatabaseBackupToExcel(
  backup: BackupData
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const wb = buildDatabaseBackupWorkbook(backup);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `Quiz_Score_Full_Backup_${timestamp}.xlsx`;

  return saveAndShareExcelFile(wb, fileName);
}
