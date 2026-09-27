import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export interface ParsedPlayerRow {
  rowNumber: number;
  name: string;
  initialScore: number;
  isValid: boolean;
  error?: string;
  isDuplicateInFile?: boolean;
}

export interface ExcelParseResult {
  success: boolean;
  fileName: string;
  totalRows: number;
  validRows: ParsedPlayerRow[];
  invalidRows: ParsedPlayerRow[];
  duplicateCount: number;
  error?: string;
}

const NAME_HEADER_ALIASES = [
  'name',
  'player',
  'player name',
  'player_name',
  'fullname',
  'full name',
  'member',
  'member name',
  'student',
  'student name',
  'participant',
];

const SCORE_HEADER_ALIASES = [
  'initial score',
  'initial_score',
  'score',
  'points',
  'starting score',
  'starting_score',
  'initial points',
  'initial_points',
  'pts',
  'point',
];

function normalizeHeader(val: any): string {
  if (typeof val !== 'string') return '';
  return val.trim().toLowerCase().replace(/[_-]/g, ' ');
}

/**
 * Parses an Excel or CSV file content into validated player rows.
 * @param data Base64 string (native) or ArrayBuffer / binary string (web/node)
 * @param fileName The name of the imported file
 * @param type Format type for XLSX reader
 */
export function parseExcelOrCsv(
  data: any,
  fileName: string,
  type: 'base64' | 'array' | 'binary' | 'string' = 'base64'
): ExcelParseResult {
  try {
    const workbook = XLSX.read(data, { type });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        success: false,
        fileName,
        totalRows: 0,
        validRows: [],
        invalidRows: [],
        duplicateCount: 0,
        error: 'The uploaded Excel file does not contain any sheets.',
      };
    }

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: any[][] = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    if (!rawData || rawData.length === 0) {
      return {
        success: false,
        fileName,
        totalRows: 0,
        validRows: [],
        invalidRows: [],
        duplicateCount: 0,
        error: 'The spreadsheet is empty. Please add player rows.',
      };
    }

    // Find header row (first non-empty row)
    let headerRowIndex = -1;
    let nameColIndex = -1;
    let scoreColIndex = -1;

    for (let i = 0; i < Math.min(rawData.length, 5); i++) {
      const row = rawData[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      for (let j = 0; j < row.length; j++) {
        const norm = normalizeHeader(row[j]);
        if (nameColIndex === -1 && NAME_HEADER_ALIASES.includes(norm)) {
          nameColIndex = j;
          headerRowIndex = i;
        }
        if (scoreColIndex === -1 && SCORE_HEADER_ALIASES.includes(norm)) {
          scoreColIndex = j;
          headerRowIndex = i;
        }
      }

      if (nameColIndex !== -1) {
        break;
      }
    }

    // If no explicit "Name" header was found, assume column 0 is Name and column 1 is Score
    const hasHeader = nameColIndex !== -1;
    if (!hasHeader) {
      nameColIndex = 0;
      scoreColIndex = 1;
      headerRowIndex = -1; // start from row 0
    }

    const dataRows = rawData.slice(headerRowIndex + 1);
    const validRows: ParsedPlayerRow[] = [];
    const invalidRows: ParsedPlayerRow[] = [];
    const seenNames = new Set<string>();
    let duplicateCount = 0;

    dataRows.forEach((row, idx) => {
      const rowNumber = headerRowIndex + 2 + idx;
      if (!Array.isArray(row) || row.length === 0) return;

      const rawName = row[nameColIndex] !== undefined ? String(row[nameColIndex]).trim() : '';
      const rawScore = scoreColIndex !== -1 && row[scoreColIndex] !== undefined ? row[scoreColIndex] : 0;

      // Skip completely blank rows
      const isCompletelyEmpty = row.every((c) => c === undefined || String(c).trim() === '');
      if (isCompletelyEmpty) return;

      // Validate name
      if (!rawName) {
        invalidRows.push({
          rowNumber,
          name: '(Empty)',
          initialScore: 0,
          isValid: false,
          error: 'Player name is missing or blank.',
        });
        return;
      }

      if (rawName.length > 60) {
        invalidRows.push({
          rowNumber,
          name: rawName,
          initialScore: 0,
          isValid: false,
          error: 'Name cannot exceed 60 characters.',
        });
        return;
      }

      // Parse score
      let parsedScore = 0;
      if (typeof rawScore === 'number') {
        parsedScore = isNaN(rawScore) ? 0 : Math.round(rawScore);
      } else if (typeof rawScore === 'string' && rawScore.trim()) {
        const num = parseFloat(rawScore.trim().replace(/[^0-9.-]/g, ''));
        parsedScore = isNaN(num) ? 0 : Math.round(num);
      }

      if (parsedScore < 0) {
        invalidRows.push({
          rowNumber,
          name: rawName,
          initialScore: parsedScore,
          isValid: false,
          error: 'Initial score cannot be negative.',
        });
        return;
      }

      const lowerName = rawName.toLowerCase();
      let isDuplicateInFile = false;
      if (seenNames.has(lowerName)) {
        isDuplicateInFile = true;
        duplicateCount++;
      } else {
        seenNames.add(lowerName);
      }

      validRows.push({
        rowNumber,
        name: rawName,
        initialScore: Math.min(100000, parsedScore),
        isValid: true,
        isDuplicateInFile,
      });
    });

    if (validRows.length === 0 && invalidRows.length === 0) {
      return {
        success: false,
        fileName,
        totalRows: 0,
        validRows: [],
        invalidRows: [],
        duplicateCount: 0,
        error: 'No player rows found in the file. Check your header and columns.',
      };
    }

    return {
      success: true,
      fileName,
      totalRows: validRows.length + invalidRows.length,
      validRows,
      invalidRows,
      duplicateCount,
    };
  } catch (err: any) {
    return {
      success: false,
      fileName,
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      duplicateCount: 0,
      error: `Failed to parse spreadsheet: ${err.message || 'Unknown file format error'}`,
    };
  }
}

/**
 * Generates sample Excel template structure data.
 */
export function getSampleExcelRows(): { Name: string; 'Initial Score': number }[] {
  return [
    { Name: 'John Doe', 'Initial Score': 25 },
    { Name: 'Sarah Smith', 'Initial Score': 15 },
    { Name: 'Michael Brown', 'Initial Score': 0 },
    { Name: 'David Lee', 'Initial Score': 10 },
    { Name: 'Mary Johnson', 'Initial Score': 5 },
  ];
}

/**
 * Generates an Excel (.xlsx) template file and downloads or shares it.
 */
export async function downloadExcelTemplate(): Promise<{ success: boolean; filePath?: string }> {
  try {
    const wb = XLSX.utils.book_new();
    const data = [
      ['Name', 'Initial Score'],
      ['John Doe', 25],
      ['Sarah Smith', 15],
      ['Michael Brown', 0],
      ['David Lee', 10],
      ['Mary Johnson', 5],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    // Set column widths for friendly Excel editing
    ws['!cols'] = [{ wch: 25 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Players');

    const fileName = 'Quiz_Players_Template.xlsx';

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const byteCharacters = atob(b64);
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

    // Native mobile: Save to FileSystem and share
    const base64Content = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (baseDir) {
      const filePath = `${baseDir}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, base64Content, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Save Excel Template',
          UTI: 'com.microsoft.excel.xlsx',
        });
      }
      return { success: true, filePath };
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to export Excel template:', err);
    return { success: false };
  }
}

/**
 * Returns plain CSV text template for easy copy/paste.
 */
export function getSampleCsvTemplate(): string {
  return `Name,Initial Score\nJohn Doe,25\nSarah Smith,15\nMichael Brown,0\nDavid Lee,10\nMary Johnson,5\n`;
}

/**
 * Reads an asset picked from DocumentPicker into data ready for parseExcelOrCsv.
 */
export async function readUploadedSpreadsheet(file: {
  uri: string;
  name: string;
  file?: any;
}): Promise<ExcelParseResult> {
  try {
    if (typeof window !== 'undefined' && (file.file || file.uri?.startsWith('blob:') || file.uri?.startsWith('data:'))) {
      if (file.file && typeof file.file.arrayBuffer === 'function') {
        const arrayBuffer = await file.file.arrayBuffer();
        return parseExcelOrCsv(arrayBuffer, file.name, 'array');
      }
      const res = await fetch(file.uri);
      const blob = await res.blob();
      const arrayBuffer = await blob.arrayBuffer();
      return parseExcelOrCsv(arrayBuffer, file.name, 'array');
    }

    // Native mobile: read as base64
    const base64 = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return parseExcelOrCsv(base64, file.name, 'base64');
  } catch (err: any) {
    return {
      success: false,
      fileName: file.name,
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      duplicateCount: 0,
      error: `Failed to read spreadsheet file: ${err.message || 'Unknown file error'}`,
    };
  }
}
