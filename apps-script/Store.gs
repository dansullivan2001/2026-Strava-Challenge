/**
 * Private storage in Script Properties (never in the public sheet).
 *   athlete:<stravaId>  -> JSON { id, name, email, refreshToken, joinedAt, needsReauth }
 *   celebrated:...      -> ISO timestamp, set once a celebration has been emailed
 */

const ATHLETE_PREFIX_ = 'athlete:';
const CELEBRATED_PREFIX_ = 'celebrated:';

function props_() { return PropertiesService.getScriptProperties(); }

function requireProp_(name) {
  const v = props_().getProperty(name);
  if (!v) throw new Error('Missing script property: ' + name);
  return v;
}

function listAthletes_() {
  const all = props_().getProperties();
  return Object.keys(all)
    .filter(k => k.indexOf(ATHLETE_PREFIX_) === 0)
    .map(k => JSON.parse(all[k]));
}

function saveAthlete_(a) {
  props_().setProperty(ATHLETE_PREFIX_ + a.id, JSON.stringify(a));
}

function celebratedFlags_() {
  return Object.keys(props_().getProperties()).filter(k => k.indexOf(CELEBRATED_PREFIX_) === 0);
}

function setFlags_(keys) {
  const now = new Date().toISOString();
  const o = {};
  keys.forEach(k => { o[k] = now; });
  if (keys.length) props_().setProperties(o);
}

function inviteKeyOk_(key) {
  const real = props_().getProperty('INVITE_KEY') || '';
  const given = String(key || '');
  if (!real || real.length !== given.length) return false;
  let diff = 0;
  for (let i = 0; i < real.length; i++) diff |= real.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

function ownerEmail_() { return Session.getEffectiveUser().getEmail(); }

function alertOwner_(subject, body) {
  try {
    MailApp.sendEmail(ownerEmail_(), '[' + CONFIG.CHALLENGE_NAME + '] ' + subject, body);
  } catch (err) {
    console.error('Could not alert owner: ' + err);
  }
}

function inviteUrl_() {
  return ScriptApp.getService().getUrl() + '?key=' + encodeURIComponent(props_().getProperty('INVITE_KEY') || '');
}
