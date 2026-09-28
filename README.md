# Quiz Score Manager

> **Offline Android Quiz Group & Individual Score Management App**  
> Built for recurring Saturday quizzes, youth game rounds, church activity clubs, and team competitions.

---

## 1. Project Overview

**Quiz Score Manager** is a production-ready, Android-first, 100% offline mobile application for managing players, assigning them manually to temporary groups for weekly rounds, recording individual scores, maintaining cumulative lifetime scores, generating reports ranked from highest to lowest, and creating local backups.

### Core Architectural Principle

> **Groups change every round, but scores belong permanently to individual players.**

A player's score **never** belongs to a group. Groups are temporary round-level organizational units.
* If **John** plays in **Group 1** during Round 1 and scores **+20**, his total is **20**.
* If **John** plays in **Group 3** during Round 2 and scores **+15**, his cumulative total is **35**.
* The cumulative score is dynamically computed from individual score records:
  $$\text{Total Score} = \sum \text{Round Scores for Player ID}$$

---

## 2. Key Features

1. **Player Management & Distinguishable Identifiers**
   * Minimal player schema (name, internal UUID, sequential player number).
   * **Duplicate Names Allowed**: If multiple players share the name "John", each has a distinct UUID and UI identifier tag (e.g. `John — #001`, `John — #002`, `John — #005`). Player names are never forcibly renamed.
   * **Duplicate Name Confirmation**: When adding or editing a player with an existing name, the app presents an explicit confirmation dialog: `[ Add Another John ]`, `[ Change Name ]`, or `[ Cancel ]`.
   * **Editing Names Without Losing Data**: Changing a name updates the existing player record; existing score history and cumulative totals remain intact.

2. **Weekly Round Creation & Manual Grouping**
   * Configurable date (defaults to today/Saturday, with any date selectable).
   * Configurable number of groups ($2$ to $N$).
   * **Completely Manual Grouping**: No random auto-distribution. The user maintains full control.
   * **Fast Search-Based Group Assignment**:
     $$\text{Search Player} \longrightarrow \text{Tap Player} \longrightarrow \text{Select Group 1..N} \longrightarrow \text{Assign}$$
   * **Single Group Rule Enforcement**: A player can belong to only one group per round. If an assigned player is selected, the app prompts to **Change Group** or **Remove From Round**.
   * **Unassigned Players Tracking**: Instant summary of unassigned players with a dedicated modal and pre-start warning: `4 players are not assigned to a group. Continue anyway?`.

3. **Manual Score Entry & Editing**
   * Round states: `DRAFT` $\rightarrow$ `ACTIVE` $\rightarrow$ `LOCKED`.
   * Displays the player's score for the **current round** on the scoring screen.
   * Fast numeric modal with whole-number validation and quick-increment presets ($+5, +10, +15, +20, +25$).
   * In-place score editing: Updating a round score from $15 \rightarrow 25$ correctly increases cumulative total by $+10$, never appending on top.

4. **Locking & Unlocking Protection**
   * Lock rounds after completion to protect historical integrity.
   * Locked rounds prevent accidental changes to groups or scores.
   * Easy administrator unlocking confirmation if corrections are required.

5. **Reports & Competition Rankings**
   * **Overall Report**: All-time cumulative score sorted from **Highest $\rightarrow$ Lowest**.
   * **By Round Report**: Individual scores for a selected round ranked from **Highest $\rightarrow$ Lowest**.
   * **Competition Tie Handling**: Equal scores share the same rank (e.g., $1, 2, 2, 4$) without modifying player names.

6. **Local Backup & Restore**
   * Versioned JSON backup format (`version: 1`).
   * Backs up players, rounds, groups, assignments, and scores.
   * Export to file and trigger Android native share sheet.
   * Import via file picker or direct JSON paste.
   * Strict validation before database modification, executed in an atomic SQLite transaction.

7. **100% Offline by Design**
   * Powered by local SQLite.
   * Zero cloud dependencies, zero external network requests.
   * Fully functional with Airplane Mode enabled.

---

## 3. Technology Stack

* **Platform:** React Native (Android-first)
* **Framework:** Expo SDK 57 (Continuous Native Generation - CNG)
* **Language:** TypeScript (Strict mode enabled)
* **Local Database:** `expo-sqlite` (SQLite 3 with WAL mode, foreign keys, transactions, and indexes)
* **File & Sharing:** `expo-file-system`, `expo-sharing`, `expo-document-picker`
* **Icons & UI:** `@expo/vector-icons` (Ionicons), `react-native-safe-area-context`
* **Testing:** Jest, `ts-jest`, `sql.js` (in-memory SQLite test adapter)

---

## 4. Project Structure

```text
ChurchScoringManagement/
├── app-version.json           # Single source of truth: version, versionCode, buildNumber
├── app.config.ts              # Dynamic Expo config: reads app-version.json, forces IDs
├── app.json                   # Static Expo config: assets, splash, permissions
├── eas.json                   # EAS build profiles
├── scripts/
│   ├── set-version.mjs        # Bump version and both build numbers, sync package.json
│   └── check-version.mjs      # Verify the three version sources agree
├── assets/                    # App icons, adaptive icons, splash screen
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── Header.tsx         # Top app bar
│   │   ├── TabBar.tsx         # Bottom navigation bar
│   │   ├── PlayerBadge.tsx    # Player name + #001 UI badge
│   │   ├── ScoreModal.tsx     # Fast numeric score entry dialog
│   │   ├── DuplicateConfirmModal.tsx # Duplicate name confirmation dialog
│   │   ├── AssignGroupModal.tsx      # Group assignment & movement modal
│   │   ├── ConfirmationModal.tsx     # Action confirmations (Lock, Unlock, Restore)
│   │   ├── UnassignedListModal.tsx   # Unassigned players modal
│   │   ├── GroupItemsModal.tsx       # Book/pen/paper point configuration
│   │   ├── ExcelImportModal.tsx      # Spreadsheet import preview
│   │   ├── SearchBar.tsx
│   │   ├── AppIntroScreen.tsx
│   │   └── EmptyState.tsx
│   ├── constants/
│   │   ├── colors.ts          # Material 3 inspired color palette
│   │   ├── config.ts          # Limits and the database schema version
│   │   └── appIdentity.ts     # Product name, developer, repo, license, privacy URL
│   ├── database/
│   │   ├── database.ts        # Database connection manager (expo-sqlite)
│   │   ├── migrations.ts      # Ordered migrations, indexes, PRAGMA user_version
│   │   └── types.ts           # IDatabaseConnection abstraction
│   ├── repositories/          # Data Access Layer
│   │   ├── playerRepository.ts# Player CRUD, search, duplicate detection
│   │   ├── roundRepository.ts # Round management, status transitions
│   │   ├── groupRepository.ts # Group queries, assignments, moves, unassigned
│   │   ├── groupScoring.ts    # Shared carry/items/recompute rules
│   │   ├── scoreRepository.ts # Score entry, upserts, cumulative SUM calculation
│   │   ├── reportRepository.ts# Overall, by-round, and by-group rankings
│   │   └── backupRepository.ts# JSON export/import and atomic restore
│   ├── screens/
│   │   ├── HomeScreen.tsx     # Dashboard with current round & leader
│   │   ├── PlayersScreen.tsx  # Players list, search, add, detail modal
│   │   ├── PlayerDetailModal.tsx # Player stats & historical scores
│   │   ├── RoundScreen.tsx    # Round manager (Grouping, Scoring, Lock/Unlock)
│   │   ├── RoundDetailModal.tsx  # Round review modal
│   │   ├── ReportsScreen.tsx  # Highest-to-lowest rankings with filters
│   │   ├── HistoryScreen.tsx  # Past rounds list
│   │   └── SettingsScreen.tsx # Backup export, import, app information
│   ├── services/
│   │   └── quizService.ts     # Central service coordinating repositories
│   ├── types/
│   │   └── index.ts           # Core TypeScript domain models & view types
│   └── utils/
│       ├── backupValidation.ts# Structural + referential validation of backup JSON
│       ├── errors.ts          # UserFacingError and safe message extraction
│       ├── logger.ts          # Development-only logging
│       ├── appVersion.ts      # Native version/build reader
│       ├── excelExport.ts     # XLSX export
│       ├── excelImport.ts     # XLSX/CSV import
│       ├── formatters.ts      # Date, #001 identifier, ranking helpers
│       ├── idGenerator.ts     # Collision-free UUID generator
│       └── validation.ts      # Name, score, and group count validation
├── tests/
│   ├── businessRules.test.ts  # Core product scenarios
│   ├── productionReadiness.test.ts # Migrations, backup, scoring, error handling
│   ├── wheel.test.ts          # Wheel/spinner feature
│   ├── testDbAdapter.ts       # sql.js in-memory database test connection
│   └── mocks/                 # Jest native mocks
├── App.tsx                    # Root component with tabs & SQLite initialization
├── jest.config.js             # Jest test configuration
├── package.json               # Dependencies and scripts
├── tsconfig.json              # App TypeScript configuration
└── tsconfig.node.json         # Node-side config typechecking (app.config.ts, scripts)
```

`android/` and `ios/` are generated at build time and are git-ignored.

---

## 5. Database Architecture & Schema

The application uses local SQLite with foreign keys and WAL mode enabled.

```text
       ┌──────────────┐
       │   PLAYERS    │
       └──────┬───────┘
              │
      ┌───────┴────────┐
      ▼                ▼
┌──────────────┐ ┌──────────────┐
│GROUP_MEMBERS │ │    SCORES    │
└──────┬───────┘ └──────┬───────┘
       │                │
       ▼                ▼
┌──────────────┐ ┌──────────────┐
│    GROUPS    │ │    ROUNDS    │
└──────┬───────┘ └──────────────┘
       │
       ▼
┌──────────────┐
│    ROUNDS    │
└──────────────┘
```

### Table Definitions

```sql
-- 1. Players
CREATE TABLE players (
    id TEXT PRIMARY KEY,
    player_number INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 2. Rounds
CREATE TABLE rounds (
    id TEXT PRIMARY KEY,
    round_date TEXT NOT NULL,
    group_count INTEGER NOT NULL,
    status TEXT NOT NULL, -- 'DRAFT', 'ACTIVE', 'LOCKED'
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 3. Groups (belong strictly to a specific round)
CREATE TABLE groups (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL,
    group_number INTEGER NOT NULL,
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
);

-- 4. Group Members (temporary assignment for a specific round)
CREATE TABLE group_members (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(round_id, player_id),
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- 5. Scores (belong permanently to individual players)
CREATE TABLE scores (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(round_id, player_id),
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Indexes for fast queries
CREATE INDEX idx_players_name ON players(name);
CREATE INDEX idx_scores_player_id ON scores(player_id);
CREATE INDEX idx_scores_round_id ON scores(round_id);
CREATE INDEX idx_group_members_player_id ON group_members(player_id);
CREATE INDEX idx_group_members_round_id ON group_members(round_id);
CREATE INDEX idx_groups_round_id ON groups(round_id);
```

### Calculating Cumulative Scores

To guarantee data consistency, cumulative total scores are calculated from individual score records:

```sql
SELECT
    player_id,
    COALESCE(SUM(points), 0) AS total_score
FROM scores
GROUP BY player_id
ORDER BY total_score DESC;
```

---

## 6. Development Setup & Running the App

### Prerequisites

* Node.js $\ge$ 18 (Node.js 24 LTS verified)
* npm $\ge$ 9
* Java Development Kit (JDK 17 or JDK 21)

### Installation

```bash
# Clone the repository and install dependencies
git clone https://github.com/gilmierdev/ChurchScoringManagement.git
cd ChurchScoringManagement
npm install
```

### Verify Everything

```bash
npm run verify
```

This runs the version consistency check, both TypeScript projects, ESLint, and the full test suite in order.

Individual steps:

```bash
npm run version:check   # app-version.json matches app config and package.json
npm run typecheck       # app code + Node-side Expo config
npm run lint            # expo lint
npm test                # Jest, in-memory SQLite
```

### Start Development Server

#### Running in Browser (Localhost)

```bash
npm run web
# Or: npx expo start --web
```

* Opens automatically at `http://localhost:8081` in your web browser.
* Powered by Expo's Metro bundler with WebAssembly (WASM) SQLite support (`wa-sqlite`) and COEP/COOP HTTP headers for multi-threading.
* Features a clean, centered desktop layout frame (max 680px width) with native-style mobile responsiveness.
* Supports full browser backup downloads and file imports.

#### Running on Android Device or Emulator

```bash
npx expo start
```

Press `a` in the terminal to launch the app on a connected Android phone or Android emulator.

> The app uses `expo-sqlite`, which is a native module and is **not** included in Expo Go. Run `npm run android` (or `npm run eas:dev:android`) to install a development build on a device before testing on hardware. The web target works in Expo Go.

---

## 7. Building the App

This project uses **Continuous Native Generation**: there is no committed `android/` or `ios/` directory. Everything native is generated from `app.json` and `app.config.ts` during the build, so the git-ignored native folders are disposable.

### Version and Build Numbers

`app-version.json` is the single source of truth for the release version and both build numbers. `app.config.ts` reads it, and `package.json` is kept in sync.

```bash
npm run version:check   # verify the three agree
npm run version:set     # bump version, versionCode, and buildNumber together
```

Release versions and builds always increase, including the iOS build number, which matters for App Store review. Set `runtimeVersion.policy` in `app.config.ts` to control Expo Updates compatibility.

### Option A: Cloud Build with EAS (recommended)

EAS runs the native generation and signing for you, so no local Android Studio or Xcode is required.

```bash
npx --yes eas-cli@latest login
npx --yes eas-cli@latest build:configure   # one-time project linking
```

Convenience scripts are already defined in `package.json`:

```bash
npm run eas:dev:android       # internal debug build
npm run eas:preview:android   # internal release-signed APK
npm run eas:preview:ios       # internal iOS build
npm run eas:production:android
npm run eas:production:ios
```

Profiles live in `eas.json`:

| Profile | Android artifact | Distribution | Purpose |
|---|---|---|---|
| `development` | APK | internal | Fast iteration on a device |
| `preview` | APK | internal | Release-signed testing, closer to production |
| `production` | App Bundle (`.aab`) | store | Play Store / App Store submission |

> `expo-dev-client` is intentionally not installed, so the `development` profile is a standard build rather than a dev client. Add it later only if you need in-app dev menus.

### Option B: Local Native Build

Requires the Android SDK (or Xcode) and a local JDK 17 or 21.

```bash
npm run android   # expo run:android — generates android/ and installs a debug build
npm run ios       # expo run:ios
```

After a local generation you can also drive Gradle directly:

```powershell
cd android
.\gradlew assembleDebug
.\gradlew assembleRelease
```

The native folders are git-ignored. If they ever drift from the config, regenerate rather than hand-editing:

```bash
npm run prebuild   # expo prebuild --clean
```

---

## 8. Customization & Rebranding

### How to Change the Application Name

The display name lives in `app.json`:

```json
{ "expo": { "name": "My Quiz Manager" } }
```

Rebranding the app also means updating the static identity shown in Settings and in store listings:

```typescript
// src/constants/appIdentity.ts
export const APP_IDENTITY = {
  name: 'My Quiz Manager',
  developer: 'GilmierDev',
  copyright: '© 2026 GilmierDev',
  repositoryUrl: 'https://github.com/gilmierdev/ChurchScoringManagement',
  license: 'MIT',
};
```

The application IDs live in `app.config.ts` and `app.json`. Changing an application ID after a store release creates a **new** app in the store, so treat it as a permanent decision.

### How to Change the Application Icon

1. Replace the icon files in `./assets/`:
   * `./assets/icon.png` (1024x1024 PNG)
   * `./assets/android-icon-foreground.png` (432x432 PNG)
   * `./assets/android-icon-background.png` (432x432 PNG)
   * `./assets/android-icon-monochrome.png` (432x432 PNG, themed icons)
   * `./assets/splash-icon.png`
2. Regenerate the native assets:
   ```bash
   npm run prebuild
   ```

### How to Sign Release Builds

EAS manages signing automatically and stores credentials in its servers, so no keystore is committed. For a first production build, EAS will offer to generate one:

```bash
npx --yes eas-cli@latest credentials --platform android
```

If you prefer a locally held key, generate one and keep it **outside** the repository — `.gitignore` already excludes `*.keystore`, `*.jks`, `*.p12`, and `*.key`:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore quiz-release-key.keystore \
  -alias quiz-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

Back the keystore up somewhere separate. Losing it means you can no longer update the app on the store.

---

## 9. Backup & Restore Specification

Backups are exported in versioned JSON format:

```json
{
  "version": 1,
  "exportedAt": "2026-09-26T09:42:00.000Z",
  "players": [
    {
      "id": "e95adcf2-570a-41be-8ca0-6e4744d03612",
      "player_number": 1,
      "name": "John",
      "initial_score": 0,
      "active": 1,
      "created_at": "2026-09-26T09:40:00.000Z",
      "updated_at": "2026-09-26T09:40:00.000Z"
    }
  ],
  "rounds": [],
  "groups": [],
  "groupMembers": [],
  "scores": []
}
```

* **Safety:** The payload is fully validated *before* a transaction opens, so an invalid file is rejected while the existing database is untouched.
* **Confirmation:** The user is always prompted before existing records are overwritten.
* **Atomicity:** The restore runs inside a transaction. If any record fails to insert, everything rolls back.
* **Fidelity:** Group item points, counts, and `quiz_score` are preserved, not just the raw score rows.

Validation rejects: unsupported versions, missing or non-array tables, duplicate record ids, duplicate player numbers, negative points, dangling references, group assignments whose group belongs to a different round, a player assigned twice in one round, and duplicate per-round scores.

### Device Backup Behaviour

On **Android**, `allowBackup` is `false`, so the database is not copied into Google device backups.

On **iOS**, the app never uploads anything itself, but iOS may include local app data in the user's iCloud or computer backups. That behaviour is controlled by the operating system, not by the app. Anyone moving data between devices should use an exported backup file.

---

## 10. Tests

70 tests run in Jest against an in-memory SQLite database (`sql.js`), so no emulator is needed.

```bash
npm test
```

### Core business rules

`tests/businessRules.test.ts` covers the product's fundamental guarantees:

| # | Scenario |
|---|---|
| 1 | Add player "John" and verify appearance |
| 2 | Allow duplicate name "John" with unique ID and sequence (`#002`) |
| 3 | Case-insensitive search finds both Johns independently |
| 4 | Create 4 groups; assign John #001 → Group 1, John #002 → Group 3 |
| 5 | Prevent duplicate assignment; moving player updates group correctly |
| 6 | Assign score `+20`; verify total score `= 20` |
| 7 | Create next round, assign to Group 3, score `+15`; verify total `= 35` |
| 8 | Edit round 2 score (`15 → 25`); verify total `= 45` (not `60`) |
| 9 | Reports sort players from highest to lowest |
| 10 | Equal scores share rank (`1, 2, 2, 4`) without altering names |
| 11 | Editing player name preserves ID and all historical scores |
| 12 | Locked rounds reject score edits; unlocking allows edits |
| 13 | Backup export and atomic restore reproduces exact database state |
| 14 | Input validation for names, scores, and group counts |

### Production readiness

`tests/productionReadiness.test.ts` guards the data-integrity and privacy work:

* **Migrations** — a fresh database reaches the configured schema version; a legacy v1 database containing duplicate player numbers is repaired instead of rejected; migrating twice is idempotent; the unique index is enforced; a database from a newer app version is refused rather than downgraded.
* **Backup validation** — malformed payloads, wrong versions, duplicate ids, duplicate player numbers, negative scores, dangling references, cross-round group assignments, double assignments, and duplicate per-round scores are all rejected.
* **Restore fidelity** — a restore preserves `groups.quiz_score` and the derived group total, and a rejected backup leaves existing data untouched.
* **Scoring invariants** — editing one member's score does not double count the items bonus; moving a player between groups never rewrites their score; removing a player re-derives the group total while keeping the score they already earned.
* **Error sanitisation** — `UserFacingError` messages reach the user, while internal details such as SQL constraint text never do.

See `TESTING.md` for the full release checklist.
