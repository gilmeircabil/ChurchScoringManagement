# Store Listing — Draft Copy

Copy for Google Play and the App Store. Both stores require the privacy policy URL to be live before submission.

**Product name:** Offline Quiz Group & Score Manager
**Application ID:** `com.gilmierdev.quizscore`
**Category:** Productivity
**Contains ads:** No
**In-app purchases:** None
**Target audience:** 13+ (general audience, not directed at children)

## Short description (max 80 characters)

```
Run weekly quiz rounds, track group and individual scores, all offline.
```
(71 of 80 characters)

## Full description (max 4000 characters)

```
Run your quiz night without spreadsheets, and without a signal.

Offline Quiz Group & Score Manager keeps every round, group, and score on
your phone. No account, no sign-in, no internet connection required. Open it
with Airplane Mode on and everything still works.

GROUPS CHANGE, SCORES DON'T

Groups are temporary. Scores belong to the people. A player who is in Group 1
this week and Group 3 next week keeps one continuous total, because the app
adds up their individual round scores. Moving someone between groups never
rewrites the score they already earned.

BUILT FOR REAL QUIZ NIGHTS

- Players with the same name stay distinct. Two people called John each get
  their own number, so #001 and #002 never get confused.
- Grouping is fully manual. No automatic shuffle. Assign people one at a time,
  or move them as the evening changes.
- The app tells you who is unassigned before you start.
- Enter scores fast with large number pad and one-tap increments.
- Edit a score any time and the cumulative total adjusts by the difference,
  never double counting.
- Group item points for books, pens, and papers are distributed to members
  automatically.
- Lock a round when it is done to protect the results. Unlock it if a
  correction is needed.
- Rankings with proper tie handling, so equal scores share a rank.
- See one player's complete round history on their detail screen.
- Import your roster from an Excel or CSV spreadsheet, and export it back
  out.

BACKUP WHEN YOU WANT, NOTHING WHEN YOU DON'T

Export a complete backup to a file you choose, and import it later. Restore
is validated first and applied in a single transaction, so a bad file can
never leave you with a half-restored database. Automatic system backup is
turned off, so your data does not quietly drift into a cloud copy.

BUILT TO STAY OUT OF THE WAY

- Fast numeric entry instead of tiny text fields.
- Clear round states: draft, active, locked.
- Simple ranked reports you can read at a glance.
- Works on phones and tablets.

NO ACCOUNT. NO ADS. NO TRACKING.

There is no account to create, no advertising, and no analytics. The app
does not collect or transmit your data. It is an offline tool that stays on
your device.

A note on your data: because everything is stored locally, uninstalling the
app deletes it. Export a backup first if you plan to reinstall, switch
phones, or let the app go.
```

## Keywords (max 100 characters)

```
quiz,quiz night,score,scorekeeper,quiz score,offline,group,trivia,no wifi,round
```
(79 of 100 characters)

## Privacy policy URL

```
https://github.com/gilmierdev/ChurchScoringManagement/blob/main/PRIVACY.md
```

Requirements to check before submitting:

- `PRIVACY.md` is committed and the repository, or the file, is publicly reachable without signing in.
- The repository is public, or the policy is copied to a public location such as GitHub Pages.
- The URL opens in a browser without authentication.

The app's Settings screen links to the same URL, so the two must agree.

## Data safety declaration

Both stores ask what the app collects. For this app:

| Question | Answer |
|---|---|
| Does your app collect or share user data? | No |
| Is all user data encrypted in transit? | Not applicable; no data is transmitted |
| Do you provide a way for users to request data deletion? | Not applicable; no data is collected. Local data is deleted by uninstalling the app |
| Is the data used for tracking? | No |

Google Play's Data safety form asks about the app's permissions as well. Only Internet access is present, and it comes from the operating system's file providers used for share and import. No runtime permissions are requested, and `MANAGE_EXTERNAL_STORAGE`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, and `SYSTEM_ALERT_WINDOW` are explicitly blocked.

## Store-specific notes

**Google Play.** Submit the App Bundle (`.aab`) from the `production` EAS profile. The app is free with no purchases, so the Play Console paid/free choice should be set to free. Target API level requirements change over time; check the current policy before each release and build against a supported target.

**App Store.** Submit the iOS build from the `production` EAS profile. The privacy answers are the same as above. Each upload needs a strictly increasing build number, which `npm run version:set` handles.

**Both.** The listing claims the app works offline. That claim is verifiable in the manual test pass in `RELEASE.md`, so check it on a real device before submitting.
