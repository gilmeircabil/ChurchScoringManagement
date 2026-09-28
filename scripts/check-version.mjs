#!/usr/bin/env node
/**
 * Fails when `app-version.json` and `package.json` disagree.
 * Run before building or releasing so a mismatched version can never ship.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(rootDir, 'app-version.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));

const problems = [];

if (manifest.version !== pkg.version) {
  problems.push(
    `app-version.json version "${manifest.version}" does not match package.json version "${pkg.version}"`
  );
}

if (!Number.isInteger(manifest.androidVersionCode) || manifest.androidVersionCode < 1) {
  problems.push('androidVersionCode must be an integer >= 1');
}

if (!/^\d+$/.test(String(manifest.iosBuildNumber))) {
  problems.push('iosBuildNumber must be a positive integer string');
}

if (problems.length > 0) {
  console.error('Version check failed:');
  problems.forEach((problem) => console.error(`  - ${problem}`));
  console.error('\nRun "npm run version:set -- <major|minor|patch>" to fix this.');
  process.exit(1);
}

console.log(
  `Version check passed: ${manifest.version} (android ${manifest.androidVersionCode}, ios ${manifest.iosBuildNumber})`
);
