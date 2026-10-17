import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Production application configuration.
 *
 * Static, non-versioned settings live in `app.json`. This dynamic layer owns
 * everything that must be bumped for a release and reads it from
 * `app-version.json` (the single source of truth), so a version string is
 * never hard-coded twice.
 *
 * Bump a release with: `npm run version:set -- patch` (or `minor` / `major`).
 */

type AppVersionManifest = {
  version: string;
  androidVersionCode: number;
  iosBuildNumber: string;
};

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

function readAppVersion(): AppVersionManifest {
  const manifestPath = join(__dirname, 'app-version.json');
  let manifest: AppVersionManifest;

  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as AppVersionManifest;
  } catch (error) {
    throw new Error(
      `Unable to read ${manifestPath}. Version information must be present and valid. ` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!SEMVER_PATTERN.test(manifest.version)) {
    throw new Error(
      `app-version.json: "version" must be a plain MAJOR.MINOR.PATCH string, received "${manifest.version}".`
    );
  }

  if (!Number.isInteger(manifest.androidVersionCode) || manifest.androidVersionCode < 1) {
    throw new Error(
      `app-version.json: "androidVersionCode" must be an integer >= 1, received ${String(
        manifest.androidVersionCode
      )}.`
    );
  }

  if (!/^\d+$/.test(String(manifest.iosBuildNumber)) || Number(manifest.iosBuildNumber) < 1) {
    throw new Error(
      `app-version.json: "iosBuildNumber" must be a positive integer string, received "${String(
        manifest.iosBuildNumber
      )}".`
    );
  }

  return {
    version: manifest.version,
    androidVersionCode: manifest.androidVersionCode,
    iosBuildNumber: String(manifest.iosBuildNumber),
  };
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const appVersion = readAppVersion();

  return {
    ...config,
    name: 'Quiz Manager',
    slug: 'quiz-score-manager',
    platforms: ['android', 'ios', 'web'],
    version: appVersion.version,
    // Each released app version gets its own JS runtime, so an OTA update can
    // never be applied to a binary it was not built for.
    runtimeVersion: { policy: 'appVersion' },
    android: {
      ...config.android,
      package: 'com.gilmierdev.quizscore',
      versionCode: appVersion.androidVersionCode,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.gilmierdev.quizscore',
      buildNumber: appVersion.iosBuildNumber,
    },
  };
};
