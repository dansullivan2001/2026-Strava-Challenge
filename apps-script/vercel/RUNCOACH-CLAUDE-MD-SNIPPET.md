<!--
Paste the section below into the RunCoach repo's CLAUDE.md.
Source of truth: https://github.com/dansullivan2001/2026-Strava-Challenge (apps-script/)
-->

## Strava challenge callback forwarder (not part of RunCoach)

`app/challenge-callback/route.ts` exists for a **separate project**, the friends' distance challenge
(repo: `dansullivan2001/2026-Strava-Challenge`, backend in its `apps-script/` folder). It is not
RunCoach functionality.

**Why it is here:** RunCoach and the challenge share one Strava API application (Strava lets this
account have only one). Strava allows a single Authorization Callback Domain per application, and it
is `stride-pink.vercel.app`. The challenge's Strava login therefore has to return to this domain.
The route does one thing: it redirects the browser to a Google Apps Script web app
(`CHALLENGE_APPS_SCRIPT_URL`), passing on only `code`, `state`, `scope` and `error`. The Apps Script
does the token exchange and stores everything; nothing is stored or exchanged here.

**Rules when working in this repo:**
- Do not change the Strava app's callback domain, client ID or client secret without updating the
  challenge's Apps Script properties (`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`,
  `STRAVA_REDIRECT_URI`). Both projects use the same app.
- Keep the route publicly reachable. Visitors returning from Strava are not logged in to RunCoach,
  so `middleware.ts` must not redirect `/challenge-callback` to a login page.
- Keep the parameter allow-list and the fixed destination. The destination must only ever come from
  the env var, never from the request (it would otherwise be an open redirect).
- Do not add RunCoach logic, Supabase access or token handling to this route.
- `CHALLENGE_APPS_SCRIPT_URL` is a Vercel environment variable (the web app's `.../exec` URL).

**Removing it:** if the challenge ends, delete the route and the env var. Nothing in RunCoach
depends on it.
