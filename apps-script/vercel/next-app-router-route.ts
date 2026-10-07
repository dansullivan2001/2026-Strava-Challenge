// For a Next.js App Router project: save as app/challenge-callback/route.ts
// (or app/api/challenge-callback/route.ts; then use that path in STRAVA_REDIRECT_URI).
//
// NOT RunCoach functionality. This belongs to the friends' Strava distance challenge
// (github.com/dansullivan2001/2026-Strava-Challenge, apps-script/). Both projects share one
// Strava API app, which allows a single callback domain (this one), so the challenge's Strava
// login returns here and is forwarded to a Google Apps Script web app that does the token
// exchange. Nothing is stored or exchanged in this route.
// Keep it publicly reachable (middleware must not redirect it to login), keep the fixed
// destination (never take it from the request: open redirect), and do not change the Strava
// app's callback domain or credentials without updating the Apps Script properties.
//
// Forwards only the OAuth parameters to the Apps Script web app.
// Env var CHALLENGE_APPS_SCRIPT_URL = the web app's .../exec URL.

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
