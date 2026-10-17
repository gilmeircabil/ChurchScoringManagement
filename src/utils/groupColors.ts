export type ColorCategory = 'primary' | 'secondary';

export interface GroupColor {
  id: string;
  name: string;
  hex: string;
  lightHex: string;
  borderHex: string;
  textHex: string;
  category: ColorCategory;
}

export const GROUP_COLORS: readonly GroupColor[] = [
  { id: 'red', name: 'Red', hex: '#DC2626', lightHex: '#FEE2E2', borderHex: '#FCA5A5', textHex: '#991B1B', category: 'primary' },
  { id: 'blue', name: 'Blue', hex: '#2563EB', lightHex: '#DBEAFE', borderHex: '#93C5FD', textHex: '#1E40AF', category: 'primary' },
  { id: 'green', name: 'Green', hex: '#16A34A', lightHex: '#DCFCE7', borderHex: '#86EFAC', textHex: '#14532D', category: 'secondary' },
  { id: 'yellow', name: 'Yellow', hex: '#EAB308', lightHex: '#FEF9C3', borderHex: '#FDE047', textHex: '#854D0E', category: 'primary' },
  { id: 'orange', name: 'Orange', hex: '#EA580C', lightHex: '#FFEDD5', borderHex: '#FDBA74', textHex: '#9A3412', category: 'secondary' },
  { id: 'purple', name: 'Purple', hex: '#9333EA', lightHex: '#F3E8FF', borderHex: '#D8B4FE', textHex: '#6B21A8', category: 'secondary' },
  { id: 'pink', name: 'Pink', hex: '#DB2777', lightHex: '#FCE7F3', borderHex: '#F9A8D4', textHex: '#9D174D', category: 'secondary' },
  { id: 'teal', name: 'Teal', hex: '#0891B2', lightHex: '#CFFAFE', borderHex: '#67E8F9', textHex: '#155E75', category: 'secondary' },
  { id: 'brown', name: 'Brown', hex: '#78350F', lightHex: '#F5EBE0', borderHex: '#D4B996', textHex: '#451A03', category: 'secondary' },
];

export const PRIMARY_COLORS: readonly GroupColor[] = GROUP_COLORS.filter((c) => c.category === 'primary');
export const SECONDARY_COLORS: readonly GroupColor[] = GROUP_COLORS.filter((c) => c.category === 'secondary');

/**
 * Derives a group color from its assigned color name or fallback to its group number.
 */
export function getGroupColor(groupNumber: number, groupName?: string | null): GroupColor {
  if (groupName && groupName.trim().length > 0) {
    const cleanName = groupName.trim().toLowerCase();
    const matched = GROUP_COLORS.find(
      (c) => cleanName === c.name.toLowerCase() || cleanName.includes(c.name.toLowerCase())
    );
    if (matched) return matched;
    // Backwards-compat: if group was previously named 'cyan', map to teal
    if (cleanName.includes('cyan')) {
      const teal = GROUP_COLORS.find((c) => c.id === 'teal');
      if (teal) return teal;
    }
    // Backwards-compat: if group was previously named 'indigo', map to brown
    if (cleanName.includes('indigo')) {
      const brown = GROUP_COLORS.find((c) => c.id === 'brown');
      if (brown) return brown;
    }
  }

  const index = Math.max(0, (groupNumber - 1) % GROUP_COLORS.length);
  return GROUP_COLORS[index];
}
