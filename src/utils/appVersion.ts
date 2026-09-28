import * as Application from 'expo-application';

/**
 * Release information read from the native application configuration
 * (`Info.plist` on iOS, `AndroidManifest.xml` on Android).
 *
 * These values are baked in at build time from `app-version.json`, so the About
 * screen can never drift from the binary that is actually running.
 */
export type AppVersionInfo = {
  /** User-facing version, e.g. `1.0.0`. */
  version: string;
  /** Store-facing build number: Android `versionCode`, iOS `CFBundleVersion`. */
  buildNumber: string;
  /** Installed application identifier. */
  applicationId: string;
  /** True when running inside Expo Go, where these values describe Expo Go. */
  isManagedDevelopmentClient: boolean;
};

const UNKNOWN = 'Unavailable';

function readNativeValue(value: string | null, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

export function getAppVersionInfo(): AppVersionInfo {
  const version = Application.nativeApplicationVersion;
  const buildNumber = Application.nativeBuildVersion;

  return {
    version: readNativeValue(version, UNKNOWN),
    buildNumber: readNativeValue(buildNumber, UNKNOWN),
    applicationId: readNativeValue(Application.applicationId, UNKNOWN),
    // In Expo Go the native values describe Expo Go itself, so never present
    // them as this app's release version.
    isManagedDevelopmentClient: version === null || version.trim().length === 0,
  };
}

/** Formatted for display, e.g. `1.0.0 (build 1)`. */
export function formatAppVersion(info: AppVersionInfo = getAppVersionInfo()): string {
  if (info.isManagedDevelopmentClient) {
    return 'Development build';
  }
  return `${info.version} (build ${info.buildNumber})`;
}
