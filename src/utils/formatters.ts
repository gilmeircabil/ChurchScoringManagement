/**
 * Pads player sequence number into 3-digit UI identifier like #001, #002, #010.
 */
export function formatPlayerIdentifier(playerNumber: number): string {
  const padded = Math.max(1, playerNumber).toString().padStart(3, '0');
  return `#${padded}`;
}

/**
 * Returns formatted display name with identifier, e.g. "John — #001"
 */
export function formatPlayerWithId(name: string, playerNumber: number): string {
  return `${name} — ${formatPlayerIdentifier(playerNumber)}`;
}

/**
 * Formats a date string like '2026-09-26' into 'September 26, 2026'
 */
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  try {
    // Handle 'YYYY-MM-DD'
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  } catch {
    // Fallback to raw string
  }
  return dateStr;
}

/**
 * Returns YYYY-MM-DD for today's local date.
 */
export function getTodayISODate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates competition rankings (1, 2, 2, 4...) for items sorted by score descending.
 */
export function assignCompetitionRanks<T extends { score: number }>(items: T[]): (T & { rank: number })[] {
  if (items.length === 0) return [];

  // Sort descending by score
  const sorted = [...items].sort((a, b) => b.score - a.score);

  const result: (T & { rank: number })[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].score < sorted[i - 1].score) {
      currentRank = i + 1;
    }
    result.push({
      ...sorted[i],
      rank: currentRank,
    });
  }

  return result;
}
