I need you to add one small forwarding route to this repo for a separate project, and document why. Do not change any existing RunCoach behaviour.

## Context
- This repo is RunCoach (Next.js App Router, Supabase, Vercel). I also run a friends' Strava distance challenge (repo: dansullivan2001/2026-Strava-Challenge, backend in its `apps-script/` folder). It is a separate project.
- Both use the same Strava API application (Strava allows me only one). Strava allows a single Authorization Callback Domain per application, and it is `stride-pink.vercel.app`. So the challenge's Strava login must return to this domain.
- The challenge's backend is a Google Apps Script web app. This repo only needs a route that redirects the browser there. The Apps Script does the token exchange and storage. Nothing is stored or exchanged in this repo.

## Tasks
1. **Inspect first, change nothing yet.** Report:
   - Where RunCoach's own Strava OAuth callback lives (search for `strava`) and how it is structured.
   - What `middleware.ts` does: its `matcher`, and whether it redirects unauthenticated visitors (for example to a login page) or has a list of public paths.
2. **Add `app/challenge-callback/route.ts`** (or in `src/app/` if the repo uses `src/`) with exactly this behaviour:

```ts
// NOT RunCoach functionality. This belongs to the friends' Strava distance challenge
// (github.com/dansullivan2001/2026-Strava-Challenge, apps-script/). Both projects share one
// Strava API app, which allows a single callback domain (this one), so the challenge's Strava
// login returns here and is forwarded to a Google Apps Script web app that does the token
// exchange. Nothing is stored or exchanged in this route.
// Keep it publicly reachable (middleware must not redirect it to login), keep the fixed
// destination (never take it from the request: open redirect), and do not change the Strava
// app's callback domain or credentials without updating the Apps Script properties.

const FORWARD = ['code', 'state', 'scope', 'error'];

export async function GET(req: Request) {
  const base = process.env.CHALLENGE_APPS_SCRIPT_URL;
  if (!base) return new Response('Not configured', { status: 500 });
  const src = new URL(req.url);
  const dest = new URL(base);
  for (const k of FORWARD) {
    const v = src.searchParams.get(k);
    if (v !== null) dest.searchParams.set(k, v);
  }
  return Response.redirect(dest.toString(), 302);
}
```

3. **Make `/challenge-callback` publicly reachable.** Visitors returning from Strava are not logged in to RunCoach. If `middleware.ts` would redirect or block them, make the smallest change that exempts only `/challenge-callback` (add it to the public paths or exclude it in the `matcher`). Do not loosen anything else. If middleware needs no change, say so.
4. **Add the section below to `CLAUDE.md`** (append it; do not rewrite existing content).
5. **Environment variable:** do not set it. Tell me that `CHALLENGE_APPS_SCRIPT_URL` must be added in the Vercel project settings (the Apps Script web app's `.../exec` URL), and that I need to redeploy after adding it. Add a placeholder line to `.env.example` if the repo has one.
6. **Verify:** run the repo's lint, typecheck and build. Then run the dev server and request `/challenge-callback?code=test&state=test&scope=read&extra=ignored` with `CHALLENGE_APPS_SCRIPT_URL=https://example.com/exec` set locally. Confirm a 302 to `https://example.com/exec?code=test&state=test&scope=read` (the `extra` parameter dropped), and a 500 when the variable is unset. Confirm the request is not redirected to a login page.

## Constraints
- Do not touch RunCoach's own Strava OAuth code, Supabase code or the Strava app configuration.
- Do not commit to the main branch. Create a branch, commit, and tell me; I'll open the pull request.
- If anything in this repo contradicts what I've described above, stop and tell me rather than guessing.

## CLAUDE.md section to append

```markdown
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
```

When finished, report: files changed, what you found in `middleware.ts` and the existing Strava callback, the verification results, and the branch name.
