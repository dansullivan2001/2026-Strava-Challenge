const STRAVA_TOKEN_URL_ = 'https://www.strava.com/oauth/token';

function stravaAuthUrl_(state) {
  const q = {
    client_id: requireProp_('STRAVA_CLIENT_ID'),
    redirect_uri: requireProp_('STRAVA_REDIRECT_URI'),
    response_type: 'code',
    approval_prompt: 'auto',
    scope: CONFIG.STRAVA_SCOPE,
    state: state,
  };
  return 'https://www.strava.com/oauth/authorize?' +
    Object.keys(q).map(k => k + '=' + encodeURIComponent(q[k])).join('&');
}

function stravaTokenRequest_(extra) {
  const payload = Object.assign({
    client_id: requireProp_('STRAVA_CLIENT_ID'),
    client_secret: requireProp_('STRAVA_CLIENT_SECRET'),
  }, extra);
  const res = UrlFetchApp.fetch(STRAVA_TOKEN_URL_, { method: 'post', payload: payload, muteHttpExceptions: true });
  const status = res.getResponseCode();
  if (status !== 200) {
    const err = new Error('Strava token request failed (HTTP ' + status + ')');
    err.status = status;
    throw err;
  }
  return JSON.parse(res.getContentText());
}

function exchangeCode_(code) {
  return stravaTokenRequest_({ grant_type: 'authorization_code', code: code });
}

/** Returns a fresh access token and stores the refresh token if Strava rotated it. */
function refreshAccessToken_(athlete) {
  const t = stravaTokenRequest_({ grant_type: 'refresh_token', refresh_token: athlete.refreshToken });
  let changed = false;
  if (t.refresh_token && t.refresh_token !== athlete.refreshToken) { athlete.refreshToken = t.refresh_token; changed = true; }
  if (athlete.needsReauth) { athlete.needsReauth = false; changed = true; }
  if (changed) saveAthlete_(athlete);
  return t.access_token;
}

function fetchActivities_(accessToken, after, before) {
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const url = 'https://www.strava.com/api/v3/athlete/activities?after=' + after +
      '&before=' + before + '&per_page=100&page=' + page;
    const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + accessToken }, muteHttpExceptions: true });
    const status = res.getResponseCode();
    if (status !== 200) {
      const err = new Error('Strava activities request failed (HTTP ' + status + ')');
      err.status = status;
      throw err;
    }
    const batch = JSON.parse(res.getContentText());
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push.apply(out, batch);
    if (batch.length < 100) break;
  }
  return out;
}
