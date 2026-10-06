// For a Next.js App Router project: save as app/challenge-callback/route.ts
// (or app/api/challenge-callback/route.ts; then use that path in STRAVA_REDIRECT_URI).
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
