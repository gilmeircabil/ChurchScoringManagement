import { IDatabaseConnection } from '../database/types';
import { Group } from '../types';
import { generateId } from '../utils/idGenerator';

/**
 * Shared scoring helpers.
 *
 * ## Data model
 *
 * `scores.points` is the authoritative per-player total for a round. It is a
 * *carry*: in group-entry mode it holds `quiz_score + items_bonus`, and in
 * individual-entry mode it holds that player's own quiz points (picked up by the
 * group's bonus later). Cumulative player totals are always the sum of these
 * rows, which is why an edit must replace a row rather than add to it.
 *
 * `groups.quiz_score` is the group's own quiz total, *excluding* the item
 * bonus. The two are kept consistent by {@link recomputeGroupQuizScore}:
 *
 *   quiz_score = MAX(0, SUM(member carries) - memberCount * items_bonus)
 *
 * Every member's carry already contains the group's item bonus, so summing
 * `N` members counts that bonus `N` times; subtracting it `N` times recovers
 * the group's net quiz total. When a group has no items the term vanishes and
 * the formula degrades to a plain sum.
 */

type GroupScoringColumns = Pick<
  Group,
  | 'quiz_score'
  | 'book_count'
  | 'pen_count'
  | 'paper_count'
  | 'bible_count'
  | 'book_points'
  | 'pen_points'
  | 'paper_points'
  | 'bible_points'
>;

export function computeItemsBonus(group: GroupScoringColumns | null | undefined): number {
  if (!group) return 0;
  const book = (group.book_count ?? 0) * (group.book_points ?? 0);
  const pen = (group.pen_count ?? 0) * (group.pen_points ?? 0);
  const paper = (group.paper_count ?? 0) * (group.paper_points ?? 0);
  const bible = (group.bible_count ?? 0) * (group.bible_points ?? 0);
  return book + pen + paper + bible;
}

/** Total a member of this group carries for the round: quiz score plus items bonus. */
export function computeMemberCarry(group: GroupScoringColumns | null | undefined): number {
  if (!group) return 0;
  return (group.quiz_score ?? 0) + computeItemsBonus(group);
}

/**
 * Atomically inserts or replaces a player's score for a round.
 *
 * Uses a single `ON CONFLICT` statement so a concurrent save cannot observe a
 * stale read and lose an update, which the previous read-then-write sequence
 * allowed. Preserves any existing individual bonus_points.
 */
export async function upsertScore(
  db: IDatabaseConnection,
  roundId: string,
  playerId: string,
  points: number,
  now: string = new Date().toISOString()
): Promise<void> {
  await db.runAsync(
    `INSERT INTO scores (id, round_id, player_id, points, bonus_points, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(round_id, player_id) DO UPDATE SET
       points = excluded.points,
       updated_at = excluded.updated_at`,
    generateId(),
    roundId,
    playerId,
    points,
    now,
    now
  );
}

/**
 * Updates an individual player's bonus round points for a round.
 * Does NOT alter the group's quiz score or any other member's score.
 */
export async function upsertIndividualBonus(
  db: IDatabaseConnection,
  roundId: string,
  playerId: string,
  bonusPoints: number,
  now: string = new Date().toISOString()
): Promise<void> {
  const safeBonus = Math.max(0, bonusPoints || 0);
  await db.runAsync(
    `INSERT INTO scores (id, round_id, player_id, points, bonus_points, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?, ?)
     ON CONFLICT(round_id, player_id) DO UPDATE SET
       bonus_points = excluded.bonus_points,
       updated_at = excluded.updated_at`,
    generateId(),
    roundId,
    playerId,
    safeBonus,
    now,
    now
  );
}

/**
 * Creates a zero score row for a round if the player does not already have one.
 *
 * Deliberately does nothing when a row exists: this is used when a player joins
 * a group, and joining a group must never overwrite a score that has already
 * been recorded.
 */
export async function ensureScoreRow(
  db: IDatabaseConnection,
  roundId: string,
  playerId: string,
  now: string = new Date().toISOString()
): Promise<void> {
  await db.runAsync(
    `INSERT INTO scores (id, round_id, player_id, points, bonus_points, created_at, updated_at)
     VALUES (?, ?, ?, 0, 0, ?, ?)
     ON CONFLICT(round_id, player_id) DO NOTHING`,
    generateId(),
    roundId,
    playerId,
    now,
    now
  );
}

/**
 * Recomputes and stores `groups.quiz_score` from the group's current members.
 * See the module comment for the formula and why it is needed.
 */
export async function recomputeGroupQuizScore(
  db: IDatabaseConnection,
  roundId: string,
  groupId: string
): Promise<void> {
  const aggregate = await db.getFirstAsync<{ member_count: number; total: number | null }>(
    `SELECT COUNT(gm.player_id) AS member_count,
            COALESCE(SUM(s.points), 0) AS total
     FROM group_members gm
     LEFT JOIN scores s
            ON s.round_id = gm.round_id AND s.player_id = gm.player_id
     WHERE gm.round_id = ? AND gm.group_id = ?`,
    roundId,
    groupId
  );

  const group = await db.getFirstAsync<GroupScoringColumns>(
    `SELECT quiz_score, book_count, pen_count, paper_count, bible_count, book_points, pen_points, paper_points, bible_points
     FROM groups WHERE id = ?`,
    groupId
  );
  if (!group) return;

  const memberCount = aggregate?.member_count ?? 0;
  const total = aggregate?.total ?? 0;
  const itemsBonus = computeItemsBonus(group);
  const quizScore = Math.max(0, total - memberCount * itemsBonus);

  await db.runAsync('UPDATE groups SET quiz_score = ? WHERE id = ?', quizScore, groupId);
}

/**
 * Pushes the group's current carry (`quiz_score + items_bonus`) onto every
 * member's score row, creating rows that do not exist yet.
 */
export async function syncMemberScoresToGroupCarry(
  db: IDatabaseConnection,
  roundId: string,
  groupId: string
): Promise<void> {
  const group = await db.getFirstAsync<GroupScoringColumns>(
    `SELECT quiz_score, book_count, pen_count, paper_count, bible_count, book_points, pen_points, paper_points, bible_points
     FROM groups WHERE id = ?`,
    groupId
  );
  if (!group) return;

  const members = await db.getAllAsync<{ player_id: string }>(
    'SELECT player_id FROM group_members WHERE round_id = ? AND group_id = ?',
    roundId,
    groupId
  );

  const carry = computeMemberCarry(group);
  const now = new Date().toISOString();
  for (const member of members) {
    await upsertScore(db, roundId, member.player_id, carry, now);
  }
}
