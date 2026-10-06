// For a plain Vercel project (or Next.js pages router): save as api/challenge-callback.js
// (Next.js pages router: pages/api/challenge-callback.js with `export default` instead of module.exports).
//
// Strava redirects here (stride-pink.vercel.app is the registered callback domain);
// this forwards only the OAuth parameters to the Apps Script web app.
// Env var CHALLENGE_APPS_SCRIPT_URL = the web app's .../exec URL.

const FORWARD = ['code', 'state', 'scope', 'error'];

module.exports = (req, res) => {
  const base = process.env.CHALLENGE_APPS_SCRIPT_URL;
  if (!base) { res.status(500).send('Not configured'); return; }
  const dest = new URL(base);
  FORWARD.forEach(k => {
    const v = req.query[k];
    if (typeof v === 'string') dest.searchParams.set(k, v);
  });
  res.redirect(302, dest.toString());
};
