/**
 * Web app: invite form, Strava callback.
 *
 * Only pages shown after the invite key or a valid Strava callback are HTML
 * (HtmlService pages expose google.script.run). Everything else is plain text.
 */

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.code || p.error) return handleCallback_(p);
    return inviteForm_(p);
  } catch (err) {
    console.error(err && err.stack || err);
    return textPage_('Something went wrong. Please try again, or tell the organiser.');
  }
}

function textPage_(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}

function pageShell_(title, bodyHtml) {
  const html = '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + esc_(title) + '</title>' +
    '<style>body{font-family:sans-serif;max-width:440px;margin:40px auto;padding:0 16px;color:#222}' +
    'h1{color:#FC4C02}label{display:block;margin-top:14px;font-weight:bold}' +
    'input{width:100%;padding:10px;margin-top:4px;box-sizing:border-box;font-size:16px}' +
    'button{margin-top:20px;padding:12px 20px;background:#FC4C02;color:#fff;border:0;border-radius:6px;font-size:16px;font-weight:bold;cursor:pointer}' +
    'button[disabled]{opacity:.5}.small{font-size:12px;color:#777}#msg{margin-top:14px;color:#b00020}</style>' +
    '</head><body>' + bodyHtml + '</body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(title);
}

function inviteForm_(p) {
  if (!inviteKeyOk_(p.key)) return textPage_('This invite link is not valid. Ask the organiser for a new one.');
  const key = JSON.stringify(String(p.key)).replace(/</g, '\\u003c');
  const body =
    '<h1>Join the ' + esc_(CONFIG.CHALLENGE_NAME) + '</h1>' +
    '<p>Connect your Strava account so your runs and rides count towards the group target, ' +
    'and get the weekly summary email.</p>' +
    '<form id="f">' +
    '<label for="n">Your name (as shown on the dashboard)</label><input id="n" maxlength="60" required>' +
    '<label for="e">Email for the weekly summary</label><input id="e" type="email" maxlength="120" required>' +
    '<button id="b" type="submit">Connect with Strava</button>' +
    '</form><p id="msg"></p>' +
    '<p class="small">We store your name, email and a Strava access token. You can revoke access any time in Strava under Settings &gt; My Apps.</p>' +
    '<script>' +
    'var KEY=' + key + ';' +
    'document.getElementById("f").addEventListener("submit",function(ev){' +
    'ev.preventDefault();var b=document.getElementById("b"),m=document.getElementById("msg");' +
    'b.disabled=true;m.textContent="";' +
    'google.script.run.withSuccessHandler(function(url){' +
    'var a=document.createElement("a");a.href=url;a.target="_top";a.textContent="Continue to Strava";' +
    'm.style.color="#222";m.textContent="";m.appendChild(a);window.top.location.href=url;' +
    '}).withFailureHandler(function(err){m.textContent=err.message||"Something went wrong.";b.disabled=false;})' +
    '.createInvite(document.getElementById("n").value,document.getElementById("e").value,KEY);' +
    '});' +
    '</script>';
  return pageShell_(CONFIG.CHALLENGE_NAME, body);
}

/** Called from the invite form. Public by necessity, so it checks the invite key itself. */
function createInvite(name, email, key) {
  if (!inviteKeyOk_(key)) throw new Error('This invite link is not valid.');
  const cleanName = String(name || '').replace(/\s+/g, ' ').trim();
  const cleanEmail = String(email || '').trim();
  if (cleanName.length < 2 || cleanName.length > 60) throw new Error('Please enter your name (2 to 60 characters).');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error('Please enter a valid email address.');
  const nonce = Utilities.getUuid();
  CacheService.getScriptCache().put('invite:' + nonce, JSON.stringify({ name: cleanName, email: cleanEmail }), 21600);
  return stravaAuthUrl_(nonce);
}

function handleCallback_(p) {
  if (p.error) return textPage_('Strava access was not granted, so nothing was saved. Use the invite link to try again.');

  const cache = CacheService.getScriptCache();
  const raw = p.state ? cache.get('invite:' + p.state) : null;
  if (!raw) return textPage_('This link has expired or was already used. Go back to the invite link and start again.');
  cache.remove('invite:' + p.state);
  const invite = JSON.parse(raw);

  const granted = String(p.scope || '');
  if (granted.indexOf('activity:read') === -1) {
    return textPage_('Strava did not grant permission to read activities. Start again and leave the activity box ticked.');
  }

  const tokens = exchangeCode_(p.code);
  const stravaId = String(tokens.athlete && tokens.athlete.id);
  if (!stravaId || stravaId === 'undefined') throw new Error('Strava response had no athlete id.');

  const clash = listAthletes_().find(a => a.name === invite.name && String(a.id) !== stravaId);
  if (clash) return textPage_('Someone has already joined with that name. Start again and add a surname or initial.');

  const existing = listAthletes_().find(a => String(a.id) === stravaId);
  const athlete = {
    id: stravaId,
    name: invite.name,
    email: invite.email,
    refreshToken: tokens.refresh_token,
    joinedAt: existing ? existing.joinedAt : new Date().toISOString(),
    needsReauth: false,
  };
  saveAthlete_(athlete);

  // Backfill the whole year straight away; the daily sync would otherwise only look back 30 days.
  let note = '';
  try {
    syncAthletes_([athlete], yearStartEpoch_());
  } catch (err) {
    console.error('Backfill failed for ' + athlete.name + ': ' + err.message);
    note = '<p class="small">Your activities will appear after the next daily sync.</p>';
  }

  return pageShell_('Connected',
    '<h1>You\'re in! 🚴‍♂️</h1><p>Thanks, ' + esc_(athlete.name) + '. Your Strava activities now count towards the ' +
    esc_(CONFIG.CHALLENGE_NAME) + ', and you\'ll get the weekly summary by email.</p>' + note +
    '<p class="small">You can close this window.</p>');
}
