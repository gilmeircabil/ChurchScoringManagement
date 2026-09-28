# Release Guide

Everything needed to produce a store-ready build. The app is **not** published by this process; the final store submission is a manual step.

## Before you build

```bash
npm install
npm run verify
```

`verify` runs, in order: version consistency, both TypeScript projects, ESLint, and the full Jest suite. All four must pass.

A release build is only worth attempting once all of these are true:

- [ ] `npm run verify` passes with no errors
- [ ] `npx expo-doctor` shows only the known Jest major-version advisory, or you have decided how to handle it
- [ ] `npx expo config --type public` resolves the config
- [ ] `git diff --check` reports no whitespace errors
- [ ] No secrets, keystores, or `.env` files are staged

## Version and build numbers

`app-version.json` is the single source of truth.

```json
{
  "version": "1.0.0",
  "android": { "versionCode": 1 },
  "ios": { "buildNumber": "1" }
}
```

Bump everything together:

```bash
npm run version:set
npm run version:check
```

`set-version` increments the Android version code and the iOS build number, updates `package.json`, and refuses to move any value backwards. iOS requires a strictly increasing build number for every upload, including a resubmission after a rejection, which is why it is bumped automatically.

If the app identity, repository, or license changes, update `src/constants/appIdentity.ts` too. That file is what the Settings screen shows.

## Building

| Purpose | Command | Output |
|---|---|---|
| Device testing | `npm run eas:dev:android` | Internal APK |
| Release-signing test | `npm run eas:preview:android` | Internal signed APK |
| iOS test | `npm run eas:preview:ios` | Internal signed build |
| Play Store | `npm run eas:production:android` | App Bundle (`.aab`) |
| App Store | `npm run eas:production:ios` | Signed archive |

First-time setup:

```bash
npx --yes eas-cli@latest login
npx --yes eas-cli@latest build:configure
```

`build:configure` links the project to your Expo account and sets the project ID. It requires an account and cannot be done in advance of it.

## Signing

EAS holds signing credentials in its own servers, so nothing sensitive belongs in the repository. If you would rather manage a key yourself, generate it and store it **outside** the working tree:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore quiz-release-key.keystore \
  -alias quiz-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

`.gitignore` excludes `*.keystore`, `*.jks`, `*.p12`, `*.p8`, `*.pem`, and `*.key`. Back up the keystore separately: losing it means the app can no longer be updated on the store.

## Privacy policy must be live

`APP_IDENTITY.privacyPolicyUrl` points at `PRIVACY.md` in this repository. Both Google Play and the App Store require a publicly reachable URL, so `PRIVACY.md` must be committed and pushed to a public location **before** submission. See `PRIVACY.md` and `STORE_LISTING/`.

## Manual test pass

Automated tests cover data integrity and business rules. These need a real device or emulator.

- [ ] Create a player, edit the name, confirm score history is intact
- [ ] Add two players with the same name; confirm they get distinct numbers and both are searchable
- [ ] Create a round, assign a player, move them to another group, confirm only the assignment changed
- [ ] Record a score, edit it, confirm the cumulative total changes by the difference
- [ ] Lock a round; confirm edits are rejected and unlocking restores editing
- [ ] Add group item points and confirm the group total and each member's carry update
- [ ] Export a backup, delete everything, re-import, confirm the state matches including group scores
- [ ] Export a spreadsheet and re-import it
- [ ] Verify the app works in Airplane Mode throughout
- [ ] Confirm the version, build number, and application ID in Settings match this release

## Post-build checks

For an Android App Bundle:

```bash
npx --yes eas-cli@latest build:list
```

Use the artifact listing to confirm the build used the `production` profile and the expected version. Install the internal `preview` artifact on a real device before submitting the production bundle, since the store build is not directly installable.

## Known non-blocking advisories

**Expo Doctor: jest major version.** `npx expo-doctor` reports one failing check:

```
package      expected  found
@types/jest  29.5.14   30.0.0
jest         ~29.7.0   30.5.2
```

The project is on Jest 30, which the full suite passes under. This affects only the test runner, never the shipped app, and the mismatch predates the release work. Expo expects `~29.7.0` because that is what its own template pins. Either outcome is defensible:

- Stay on Jest 30 and silence the check by adding `"jest"` and `"@types/jest"` to `expo.install.exclude` in `package.json`.
- Align with Expo by running `npx expo install jest @types/jest` and re-running `npm test`.

Do not do this casually as part of a release; it is a deliberate decision about test tooling, not a release blocker.

**npm audit.** `npm install` reports transitive advisories in the dependency tree (mostly moderate, one high at the time of writing). They come from development tooling and transitive packages rather than app code paths. Review with `npm audit` before each release. Do **not** run `npm audit fix --force`; it performs breaking major-version upgrades of Expo and React Native, which are managed with `npx expo install --fix` and manual verification instead.
