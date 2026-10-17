# Privacy Policy

**Quiz Manager**
Last updated: 28 September 2026

## Summary

This app keeps your data on your device. It has no account system, no server, and no analytics. It does not collect, transmit, or sell any personal information. The only data it stores is the quiz information you enter yourself, and that data stays in the app's private storage on your device unless you export it yourself.

## What data the app stores

The app stores the information you enter in order to run a quiz:

- **Players** — player names and an internal player number used to tell players with the same name apart.
- **Rounds** — the round date, the number of groups, and whether the round is a draft, active, or locked.
- **Groups and assignments** — which players are in which group for a given round.
- **Scores** — the points recorded for a player in a round, and group item points such as books, pens, and papers.

No other data is collected. There is no usage tracking, no crash reporting, and no advertising identifier.

## Where data is stored

All data is stored in a local SQLite database inside the app's private storage on your device. It is not uploaded to any server by the app.

On **Android**, automatic system backup is turned off, so the database is not copied into Google device backups.

On **iOS**, the app itself does not upload data, but your operating system may include local app data in your own iCloud or computer backups. That is controlled by the operating system, not by this app.

Deleting the app removes its local data. Because data is not stored on a server, it cannot be recovered by the developer after uninstalling. **Export a backup before deleting the app or switching devices.**

## When data leaves your device

Only when you choose to:

- **Export / share a backup** — you choose the destination through your device's share sheet or save the file yourself. Once you share or save it, that copy is governed by wherever you sent it.
- **Import a backup** — reading a file you selected.
- **Import a spreadsheet** — reading an `.xlsx` or `.csv` file you selected.
- **Export a spreadsheet** — writing a file you chose to save or share.

The app makes no network requests on its own and sends nothing to the developer.

## Permissions

The app requests no runtime permissions. Where unnecessary Android permissions such as `MANAGE_EXTERNAL_STORAGE`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, and `SYSTEM_ALERT_WINDOW` would otherwise be merged in from dependencies, they are explicitly blocked in the app configuration. Internet access exists only because shared file and spreadsheet operations go through the operating system's file providers; the app code performs no network calls.

## Third-party components

The app bundles open-source libraries, including React Native, Expo, and SheetJS. These run locally. None of them transmit your quiz data, because the app makes no network requests.

## Children

The app is not directed at children under 13. It collects no personal information from anyone, online or offline.

## Changes to this policy

If this policy changes, the updated version will be committed to this repository and the "last updated" date above will change. The version shipped in an app store is the version of this policy that applied when that build was published.

## Contact

Questions about this policy can be raised as an issue in the project's public repository:

<https://github.com/gilmierdev/ChurchScoringManagement/issues>
