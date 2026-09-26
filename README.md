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
ChurchManageQuiz/
├── android/                   # Generated Android native project (Gradle, AndroidManifest, Keystore)
├── assets/                    # App icons, adaptive icons, splash screen
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── Header.tsx         # Android top app bar
│   │   ├── TabBar.tsx         # Android bottom navigation bar
│   │   ├── PlayerBadge.tsx    # Player name + #001 UI badge
│   │   ├── ScoreModal.tsx     # Fast numeric score entry dialog
│   │   ├── DuplicateConfirmModal.tsx # Duplicate name confirmation dialog
│   │   ├── AssignGroupModal.tsx      # Group assignment & movement modal
│   │   ├── ConfirmationModal.tsx     # Action confirmations (Lock, Unlock, Restore)
│   │   ├── UnassignedListModal.tsx   # Unassigned players modal
│   │   └── EmptyState.tsx            # Illustrated empty states
│   ├── constants/
│   │   ├── colors.ts          # Material 3 inspired color palette
│   │   └── config.ts          # Application name, version, and defaults
│   ├── database/
│   │   ├── database.ts        # Database connection manager (expo-sqlite)
│   │   ├── migrations.ts      # Schema, indexes, foreign keys, PRAGMA user_version
│   │   └── types.ts           # IDatabaseConnection abstraction
│   ├── repositories/          # Data Access Layer
│   │   ├── playerRepository.ts# Player CRUD, search, duplicate detection
│   │   ├── roundRepository.ts # Round management, status transitions
│   │   ├── groupRepository.ts # Group queries, assignments, moves, unassigned
│   │   ├── scoreRepository.ts # Score entry, upserts, cumulative SUM calculation
│   │   ├── reportRepository.ts# Overall, by-round, and by-group rankings
│   │   └── backupRepository.ts# JSON export/import and atomic restore
│   ├── screens/               # Main screens
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
│       ├── formatters.ts      # Date, #001 identifier, ranking helpers
│       ├── idGenerator.ts     # Collision-free UUID generator
│       └── validation.ts      # Name, score, and group count validation
├── tests/                     # Automated Test Suite
│   ├── businessRules.test.ts  # Verification for all 12 core scenarios
│   ├── testDbAdapter.ts       # sql.js in-memory database test connection
│   └── mocks/                 # Jest native mocks
├── App.tsx                    # Root component with tabs & SQLite initialization
├── app.json                   # Expo / Android configuration
├── jest.config.js             # Jest test configuration
├── package.json               # Dependencies and scripts
└── tsconfig.json              # TypeScript configuration
```

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
git clone https://github.com/your-username/ChurchManageQuiz.git
cd ChurchManageQuiz
npm install
```

### Run Type Checking

```bash
npm run typecheck
```

### Run Automated Tests

Execute the 14-test suite covering all 12 required scenarios and business rules:

```bash
npm test
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

Press `a` in the terminal to launch the app on a connected Android phone or Android emulator via Expo Go or a development build.

---

## 7. Android Build & APK Generation

The Android native project is pre-configured with Gradle, AndroidManifest, and debug signing.

### Option A: Local Build with Gradle (Generates APK)

Make sure `ANDROID_HOME` is set to your Android SDK directory (e.g., `%LOCALAPPDATA%\Android\Sdk` on Windows).

#### 1. Build Debug APK

```powershell
cd android
.\gradlew assembleDebug
```

The resulting APK will be located at:
`android/app/build/outputs/apk/debug/app-debug.apk`

You can install it directly onto any connected Android device using:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

#### 2. Build Release APK

To create an optimized release APK:

```powershell
cd android
.\gradlew assembleRelease
```

The resulting release APK will be located at:
`android/app/build/outputs/apk/release/app-release.apk`

---

### Option B: Cloud Build with EAS (No Local Android SDK Needed)

If you don't have Android Studio or the Android SDK installed locally, you can build the APK in the cloud with EAS CLI:

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```
2. Log in or configure EAS:
   ```bash
   eas login
   eas build:configure
   ```
3. Generate standalone Android APK:
   ```bash
   eas build --platform android --profile preview
   ```

---

## 8. Customization & Rebranding

### How to Change the Application Name

The application name is centrally configured:

1. Open `src/constants/config.ts` and update `appName`:
   ```typescript
   export const APP_CONFIG = {
     appName: 'My Custom Quiz Manager',
     // ...
   };
   ```
2. Update `app.json`:
   ```json
   {
     "expo": {
       "name": "My Custom Quiz Manager"
     }
   }
   ```
3. Update `android/app/src/main/res/values/strings.xml`:
   ```xml
   <resources>
       <string name="app_name">My Custom Quiz Manager</string>
   </resources>
   ```

### How to Change the Application Icon

1. Replace the icon files located in `./assets/`:
   * `./assets/icon.png` (1024x1024 PNG)
   * `./assets/android-icon-foreground.png` (432x432 PNG)
   * `./assets/android-icon-background.png` (432x432 PNG)
   * `./assets/splash-icon.png` (Splash screen icon)
2. Re-run prebuild to regenerate native mipmap assets:
   ```bash
   npx expo prebuild --platform android
   ```

### How to Create a Production Keystore for Release

To generate a custom private signing key:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore quiz-release-key.keystore -alias quiz-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

Place `quiz-release-key.keystore` in `android/app/` and update `android/app/build.gradle`:

```groovy
signingConfigs {
    release {
        storeFile file('quiz-release-key.keystore')
        storePassword System.getenv("KEYSTORE_PASSWORD") ?: "your_password"
        keyAlias 'quiz-key-alias'
        keyPassword System.getenv("KEY_PASSWORD") ?: "your_password"
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        // ...
    }
}
```

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

* **Safety:** When importing, the JSON format is validated before opening a database transaction.
* **Confirmation:** The user is always prompted before existing records are overwritten.
* **Atomicity:** The restore operation is wrapped in a database transaction (`withTransactionAsync`). If any record fails insertion, all changes are rolled back automatically.

---

## 10. Automated Tests & Acceptance Verification

All 12 required verification scenarios are covered in `tests/businessRules.test.ts`:

| # | Scenario | Status |
|---|---|---|
| 1 | Add player "John" and verify appearance | ✅ PASSED |
| 2 | Allow duplicate name "John" with unique ID and sequence (`#002`) | ✅ PASSED |
| 3 | Case-insensitive search finds both Johns independently | ✅ PASSED |
| 4 | Create 4 groups; assign John #001 $\rightarrow$ Group 1, John #002 $\rightarrow$ Group 3 | ✅ PASSED |
| 5 | Prevent duplicate assignment; moving player updates group correctly | ✅ PASSED |
| 6 | Assign score $+20$; verify total score $= 20$ | ✅ PASSED |
| 7 | Create next round, assign to Group 3, score $+15$; verify total $= 35$ | ✅ PASSED |
| 8 | Edit round 2 score ($15 \rightarrow 25$); verify total $= 45$ (not $60$) | ✅ PASSED |
| 9 | Reports sort players from Highest $\rightarrow$ Lowest | ✅ PASSED |
| 10 | Equal scores share competition rank ($1, 2, 2, 4$) without altering names | ✅ PASSED |
| 11 | Editing player name preserves ID and all historical scores | ✅ PASSED |
| 12 | Locked rounds reject score edits; unlocking allows edits | ✅ PASSED |
| 13 | Backup export and atomic restore reproduces exact database state | ✅ PASSED |
| 14 | Input validation rules for names, scores, and group counts | ✅ PASSED |

Run the test suite anytime with:
```bash
npm test
```
