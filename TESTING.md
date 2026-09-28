# Testing

## Commands

```bash
npm test              # Jest, all suites
npm run typecheck     # app code + Node-side config
npm run lint          # expo lint
npm run version:check # app-version.json matches app config and package.json
npm run verify        # all of the above, in order
```

Tests run against an in-memory SQLite database provided by `sql.js`, so no emulator, device, or Metro server is needed. The `IDatabaseConnection` interface in `src/database/types.ts` is what makes this possible: production code talks to `expo-sqlite`, tests talk to `sql.js`, and neither knows about the other.

## Suites

### `tests/businessRules.test.ts`

The product's core guarantees: duplicate names with distinct identities, search, manual grouping, single-group-per-round enforcement, score entry and editing, cumulative totals, rankings and tie handling, lock and unlock, backup round-trips, and input validation.

### `tests/productionReadiness.test.ts`

Data integrity and privacy behaviour.

**Migrations**

- A fresh database reaches the version in `APP_CONFIG.databaseVersion`.
- A legacy v1 database containing duplicate player numbers is repaired, not rejected. All rows survive, duplicates are reassigned to unique positive numbers, and the unique index is then enforced.
- Running migrations twice is idempotent.
- A database stamped with a newer schema version is refused rather than silently downgraded.

`SqlJsTestConnection.createRaw()` skips initialization, which is how a test can stage an old schema and then migrate it explicitly. `getUserVersion()` reads the `PRAGMA user_version` stamp.

**Backup validation**

Rejects unsupported versions, missing or non-array tables, malformed dates, duplicate record ids, duplicate player numbers, negative points, scores pointing at a missing player or round, group assignments whose group belongs to a different round, a player assigned twice in one round, and duplicate per-round scores.

**Restore fidelity**

- A restore reproduces group item points, item counts, `quiz_score`, and the derived group total. This guards a real regression where `quiz_score` was silently dropped during restore.
- A rejected backup leaves existing data untouched.

**Scoring invariants**

- Editing one member's score does not add an extra copy of the group items bonus to the group total.
- Moving a player between groups never overwrites a score they already earned. This guards `ensureScoreRow`, which inserts a zero row only when none exists.
- Removing a player from a round re-derives the group total while keeping the score they already earned.
- A group with no items reports the plain sum of its members.

**Error sanitisation**

`UserFacingError` messages reach the user verbatim. Internal failures, including SQL constraint text, are replaced with a generic message. Non-`Error` throws fall back safely. The logger is silenced under `NODE_ENV=test` so expected error-path output does not bury real failures; set `LOG_ERRORS_IN_TESTS=1` to re-enable it.

### `tests/wheel.test.ts`

The wheel/spinner feature.

## Writing a test

Create a service bound to a fresh in-memory database:

```ts
import { SqlJsTestConnection } from './testDbAdapter';
import { createQuizServiceWithDb } from '../src/services/quizService';

const service = createQuizServiceWithDb(await SqlJsTestConnection.create());
```

Then drive it through the public API. Prefer real repositories over hand-written SQL: a test that inserts rows directly only proves the SQL works, while one that calls `assignPlayerToGroup` proves the rule works.

Follow the existing pattern of stating the invariant in the test name, then asserting the observable value:

```ts
test('moving a player to another group does not rewrite their score', async () => {
  // ...arrange, act...
  expect(await service.scores.getPlayerTotalScore(alice.id)).toBe(40);
});
```

## What tests cannot cover

These need a device or emulator and belong in the manual pass in `RELEASE.md`:

- SQLite behaviour differences between the in-memory `sql.js` build and the real Android and iOS SQLite libraries.
- File picking, sharing, and the spreadsheet import/export round trip.
- Layout, fonts, and device-specific rendering.
- Real device performance with a large number of players and rounds.
