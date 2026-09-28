#!/usr/bin/env node
/**
 * Bumps the application version in `app-version.json` (single source of truth)
 * and keeps `package.json` in sync.
 *
 * Usage:
 *   npm run version:set -- patch      # 1.0.0 -> 1.0.1
 *   npm run version:set -- minor      # 1.0.1 -> 1.1.0
 *   npm run version:set -- major      # 1.1.0 -> 2.0.0
 *   npm run version:set -- 1.2.3      # explicit version
 *
 * Android `versionCode` and iOS `buildNumber` are always incremented by one,
 * because both stores require them to strictly increase for every upload.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const versionFile = join(rootDir, 'app-version.json');
const packageFile = join(rootDir, 'package.json');

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

const current = readJson(versionFile);
const match = SEMVER.exec(String(current.version));

if (!match) {
  console.error(`app-version.json has an invalid version: ${current.version}`);
  process.exit(1);
}

const [, major, minor, patch] = match.map(Number);
const next = String(process.argv[2] ?? '').trim();

let version;
if (next === 'major') {
  version = `${major + 1}.0.0`;
} else if (next === 'minor') {
  version = `${major}.${minor + 1}.0`;
} else if (next === 'patch') {
  version = `${major}.${minor}.${patch + 1}`;
} else if (SEMVER.test(next)) {
  version = next;
} else {
  console.error('Provide one of: major, minor, patch, or an explicit MAJOR.MINOR.PATCH version.');
  process.exit(1);
}

const manifest = {
  ...current,
  version,
  androidVersionCode: Number(current.androidVersionCode) + 1,
  iosBuildNumber: String(Number(current.iosBuildNumber) + 1),
};

writeJson(versionFile, manifest);

const pkg = readJson(packageFile);
pkg.version = version;
writeJson(packageFile, pkg);

console.log(`Version set to ${version}`);
console.log(`  android.versionCode = ${manifest.androidVersionCode}`);
console.log(`  ios.buildNumber      = ${manifest.iosBuildNumber}`);
console.log(`  package.json version = ${pkg.version}`);
