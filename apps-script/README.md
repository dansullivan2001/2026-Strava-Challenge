# Strava challenge: Apps Script backend

Replaces the Pipedream workflows (closing 31 March 2027). One Apps Script project bound to the Google Sheet does:

| What | How |
|---|---|
| Invite link: friend enters name + email, authorises Strava | `Web.gs` web app |
| Daily activity sync (~21:00 London) | `syncActivities` → `Activities` tab (same columns as before, so `index.html` is unchanged) |
| Weekly email (Sunday ~21:00 London) | `sendWeeklyEmail` via Gmail (MailApp) |
| Celebrations | Weekly email becomes a celebration when the group reaches **athletes × year km** (5 × 2,027 = 10,135 for 2027), and a banner appears for each athlete who reaches **year km** individually. Each is sent once. |

Private data (Strava tokens, emails, secrets, celebration flags) is in **Script Properties**, never in the public sheet.

## Setup

1. **Sheet**: open the Google Sheet (a new one for 2027, shared "Anyone with the link can view" so the dashboard can read it). *Extensions → Apps Script*.
2. **Code**: create one script file per `.gs` file here and paste in the contents. *Project Settings → Show "appsscript.json"* and replace it with `appsscript.json`.
3. **Config**: edit `Config.gs` (`YEAR`, `DASHBOARD_URL`, `STRAVA_SCOPE`).
4. **Script Properties** (*Project Settings → Script Properties*):

   | Property | Value |
   |---|---|
   | `STRAVA_CLIENT_ID` | from Strava API settings |
   | `STRAVA_CLIENT_SECRET` | from Strava API settings |
   | `STRAVA_REDIRECT_URI` | `https://stride-pink.vercel.app/challenge-callback` |
   | `INVITE_KEY` | a long random string (anyone with the invite link has it) |

5. **Deploy**: *Deploy → New deployment → Web app*, execute as **Me**, access **Anyone**. Copy the `/exec` URL.
6. **Vercel (RunCoach project)**: add the route from `vercel/` (pick the variant for your framework), set env var `CHALLENGE_APPS_SCRIPT_URL` to the `/exec` URL, redeploy. **Do not change the Strava callback domain** (`stride-pink.vercel.app` stays). Easiest: give Claude Code in the RunCoach repo the prompt in `vercel/RUNCOACH-CLAUDE-CODE-PROMPT.md`; it adds the route, checks the middleware and documents it in `CLAUDE.md`.
7. **Run `setup()`** once from the editor (grants permissions, creates the sheets and triggers, logs the invite link).
8. **Test**: use the invite link yourself, then run `syncActivities` and `sendWeeklyEmailTestToMe` (emails only you, records nothing).
9. Send the invite link to friends.

## Cutting over from Pipedream

Disable the Pipedream workflows **before** `setup()` creates the triggers. Both write to the sheet and Pipedream does not know about rows the script added, so running both duplicates rows. Friends re-authorise through the new invite link (this also collects their email).

## Things to know

- **Scope**: `activity:read` (public activities). Strava's docs, as I recall them, say this also covers "Followers"-visibility activities and excludes only "Only You"; that is not verified. Activities set to "Only You" are never read.
- **Year**: `Config.gs` defaults to 2027. Set `YEAR = 2026` if you cut over before the 2026 challenge ends.
- **Group target** counts every registered athlete, so a late joiner raises it. A celebration already sent is not repeated.
- **Route**: landmarks are defined for 10,130 km and scaled so the finish line equals the group target.
- **Public functions**: Apps Script exposes functions without a trailing underscore to pages it serves. Only people holding the invite key (or completing a Strava callback) are ever served an HTML page. Rotate `INVITE_KEY` if the link leaks. `sendWeeklyEmail` refuses to run twice within 5 days.
- **Revoked tokens**: the sync marks the athlete, emails you once, and the invite link re-authorises them.
- **Strava rotating refresh tokens** are saved on every refresh.
- **Dashboard**: `index.html` still hardcodes names, colours, targets and milestones. The `Challenge` tab (year, targets, participant count) is written for it to read; that change is separate.

## Not yet verified in a live deployment

- Strava accepting a different path on `stride-pink.vercel.app` as the `redirect_uri` (it should only check the domain).
- The invite form's redirect to Strava from inside the Apps Script page (a "Continue to Strava" link is shown as a fallback).
- Trigger timing: `atHour(21)` fires at some point within that hour.

## Tests

```
node apps-script/test/logic.test.js
```

Covers the date, stats, celebration and email logic (`Logic.gs`). Anything that calls Google or Strava services can only be tested in a real deployment.
