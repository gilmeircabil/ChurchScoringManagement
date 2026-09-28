import { describe, test, expect } from '@jest/globals';
import { DEFAULT_WHEEL_ITEMS, DEFAULT_WHEEL_NAME } from '../src/utils/wheelStorage';

// Wheel winner slice calculation helper matching WheelScreen
function calculateWinnerIndex(totalAngle: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  const sliceAngle = 360 / itemCount;
  const normalized = (360 - (totalAngle % 360)) % 360;
  return Math.min(itemCount - 1, Math.floor(normalized / sliceAngle));
}

describe('Random Wheel — Physics, Math and Logic', () => {
  test('Wheel math: Index 0 at 0 degrees rotation with 4 items', () => {
    // 4 items: [0-90): index 0, [90-180): index 1, [180-270): index 2, [270-360): index 3
    const winner = calculateWinnerIndex(0, 4);
    expect(winner).toBe(0);
  });

  test('Wheel math: Pointer accurately selects index 3 when rotated clockwise by 30 degrees', () => {
    // Rotating clockwise by 30° brings angle 330° under the pointer (which is in [270, 360) -> index 3)
    const winner = calculateWinnerIndex(30, 4);
    expect(winner).toBe(3);
  });

  test('Wheel math: Pointer accurately selects index 2 when rotated clockwise by 100 degrees', () => {
    // Rotating clockwise by 100° brings angle 260° under the pointer (which is in [180, 270) -> index 2)
    const winner = calculateWinnerIndex(100, 4);
    expect(winner).toBe(2);
  });

  test('Wheel math: Multiple full 360 rotations do not affect winning slice', () => {
    const singleTurnWinner = calculateWinnerIndex(45, 8);
    const multiTurnWinner = calculateWinnerIndex(45 + 360 * 10, 8);
    expect(multiTurnWinner).toBe(singleTurnWinner);
  });

  test('Wheel items removal: Removing chosen winner decreases count and excludes winner', () => {
    const originalItems = ['Team Alpha', 'Team Beta', 'Team Gamma', 'Team Delta'];
    const chosenIndex = 1; // Team Beta
    const chosenWinner = originalItems[chosenIndex];

    const remainingItems = originalItems.filter((_, idx) => idx !== chosenIndex);
    expect(remainingItems.length).toBe(3);
    expect(remainingItems).not.toContain(chosenWinner);
    expect(remainingItems).toEqual(['Team Alpha', 'Team Gamma', 'Team Delta']);
  });

  test('Wheel reset: Restoring initial items recovers all removed items', () => {
    const initial = ['Group 1', 'Group 2', 'Group 3', 'Group 4'];
    let current = [...initial];

    // Simulate 2 removals
    current.splice(1, 1); // remove Group 2
    current.splice(1, 1); // remove Group 3
    expect(current).toEqual(['Group 1', 'Group 4']);

    // Reset restores initial items
    current = [...initial];
    expect(current).toEqual(initial);
    expect(current.length).toBe(4);
  });

  test('Default wheel config constants are valid numbers 1 to 10', () => {
    expect(DEFAULT_WHEEL_NAME).toBe('Random Wheel');
    expect(DEFAULT_WHEEL_ITEMS).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect(DEFAULT_WHEEL_ITEMS.length).toBe(10);
  });
});
