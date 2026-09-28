import { APP_CONFIG } from '../constants/config';

/**
 * Validates player name input.
 * - Name cannot be empty
 * - Trim unnecessary spaces
 * - Prevent completely blank names
 */
export function validatePlayerName(name: string): {
  isValid: boolean;
  trimmedName: string;
  error?: string;
} {
  const trimmed = (name || '').trim();
  if (trimmed.length === 0) {
    return {
      isValid: false,
      trimmedName: '',
      error: 'Player name cannot be empty.',
    };
  }
  if (trimmed.length > 50) {
    return {
      isValid: false,
      trimmedName: trimmed,
      error: 'Player name cannot exceed 50 characters.',
    };
  }
  return {
    isValid: true,
    trimmedName: trimmed,
  };
}

/**
 * Validates score input.
 * - Whole numbers
 * - Zero allowed
 * - Disallow empty values, negative values, and non-numeric characters
 */
export function validateScore(scoreInput: string | number): {
  isValid: boolean;
  points: number;
  error?: string;
} {
  const str = String(scoreInput).trim();
  if (str === '') {
    return {
      isValid: false,
      points: 0,
      error: 'Please enter a valid number of points.',
    };
  }

  // Check if string contains only digits
  if (!/^\d+$/.test(str)) {
    return {
      isValid: false,
      points: 0,
      error: 'Please enter a valid whole number (no decimals or negative values).',
    };
  }

  const parsed = parseInt(str, 10);
  if (isNaN(parsed) || parsed < 0) {
    return {
      isValid: false,
      points: 0,
      error: 'Please enter a valid number of points.',
    };
  }

  if (parsed > APP_CONFIG.maxScorePerRound) {
    return {
      isValid: false,
      points: 0,
      error: `Score is too large (maximum ${APP_CONFIG.maxScorePerRound.toLocaleString()} points per round).`,
    };
  }

  return {
    isValid: true,
    points: parsed,
  };
}

/**
 * Validates round group count against the bounds declared in APP_CONFIG.
 */
export function validateGroupCount(count: number): {
  isValid: boolean;
  error?: string;
} {
  if (!Number.isInteger(count) || count < APP_CONFIG.minGroupCount) {
    return {
      isValid: false,
      error: `Number of groups must be at least ${APP_CONFIG.minGroupCount}.`,
    };
  }
  if (count > APP_CONFIG.maxGroupCount) {
    return {
      isValid: false,
      error: `Maximum number of groups is ${APP_CONFIG.maxGroupCount}.`,
    };
  }
  return { isValid: true };
}
