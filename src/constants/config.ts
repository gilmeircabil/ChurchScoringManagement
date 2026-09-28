import { APP_IDENTITY } from './appIdentity';

/**
 * Application-wide tunables and limits.
 *
 * The release version is intentionally absent: it is read from the native
 * application configuration with `getAppVersionInfo()` so the About screen
 * always matches the installed binary. See `app-version.json` for the value
 * that gets compiled into a build.
 */
export const APP_CONFIG = {
  appName: APP_IDENTITY.name,
  developer: APP_IDENTITY.developer,
  copyright: APP_IDENTITY.copyright,

  databaseName: 'quiz_score_manager.db',

  /**
   * Schema version the migration runner must reach.
   *
   * Bump this only when appending a migration to `src/database/migrations.ts`,
   * and make both changes together. Never edit an already-shipped migration.
   */
  databaseVersion: 2,

  defaultGroupCount: 4,
  minGroupCount: 2,
  maxGroupCount: 12,
  maxScorePerRound: 100000,
  exportFileNamePrefix: 'quiz_score_backup',
  defaultItemPoints: {
    book: 10,
    pen: 5,
    paper: 5,
  },
  defaultItemNames: {
    book: 'Book',
    pen: 'Pen',
    paper: 'Paper',
  },
} as const;
