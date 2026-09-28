/**
 * Static, non-versioned application identity.
 *
 * The release version is deliberately NOT stored here: it lives in
 * `app-version.json` and reaches the app through the native application
 * configuration. See `src/utils/appVersion.ts`.
 */
export const APP_IDENTITY = {
  /** Full product name, as shown in the app and in the store listings. */
  name: 'Offline Quiz Group & Score Manager',
  /** Short name used where space is limited (e.g. the Android launcher). */
  shortName: 'Quiz Manager',
  /** Application identifier. Must match `android.package` / `ios.bundleIdentifier`. */
  applicationId: 'com.gilmierdev.quizscore',
  developer: 'GilmierDev',
  copyright: '© 2026 GilmierDev',
  license: 'MIT License',
  repositoryUrl: 'https://github.com/gilmierdev/ChurchScoringManagement',
  issuesUrl: 'https://github.com/gilmierdev/ChurchScoringManagement/issues',
  /**
   * Privacy Policy URL shown in Settings.
   *
   * NOTE: `PRIVACY.md` in this repository is the authoritative policy text.
   * Host it at this address before submitting to a store; both stores reject
   * submissions whose listing has no reachable, public privacy policy.
   */
  privacyPolicyUrl: 'https://github.com/gilmierdev/ChurchScoringManagement/blob/main/PRIVACY.md',
} as const;
