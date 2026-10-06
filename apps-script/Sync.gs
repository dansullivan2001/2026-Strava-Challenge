function spreadsheet_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function yearStartEpoch_() { return Math.floor(Date.UTC(CONFIG.YEAR, 0, 1) / 1000); }

// One day of slack past 31 Dec; rows are filtered by date prefix below.
function yearEndEpoch_() { return Math.floor(Date.UTC(CONFIG.YEAR + 1, 0, 2) / 1000); }

const ACTIVITY_HEADERS_ = ['Athlete', 'Activity ID', 'Activity Name', 'Activity Type', 'Distance (km)', 'Duration (min)', 'Activity Date'];

function sheetByName_(name, headers) {
  const ss = spreadsheet_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (headers) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sh;
}

function ensureActivitiesSheet_() { return sheetByName_(CONFIG.ACTIVITIES_SHEET, ACTIVITY_HEADERS_); }

function existingActivityIds_(sheet) {
  const n = sheet.getLastRow() - 1;
  const seen = new Set();
  if (n < 1) return seen;
  sheet.getRange(2, 2, n, 1).getValues().forEach(r => { if (r[0] !== '') seen.add(String(r[0])); });
  return seen;
}

function activityRow_(athlete, act) {
  return [
    athlete.name,
    act.id,
    act.name,
    act.sport_type || act.type,
    act.distance / 1000,
    act.moving_time / 60,
    act.start_date.slice(0, 10),
  ];
}

function appendRows_(sheet, rows) {
  if (!rows.length) return;
  const start = sheet.getLastRow() + 1;
  // Text columns are formatted as plain text first, so a name such as "=1+1"
  // cannot become a formula in a publicly readable sheet, and dates stay YYYY-MM-DD.
  sheet.getRange(start, 1, rows.length, 1).setNumberFormat('@');
  sheet.getRange(start, 3, rows.length, 2).setNumberFormat('@');
  sheet.getRange(start, 7, rows.length, 1).setNumberFormat('@');
  sheet.getRange(start, 1, rows.length, 7).setValues(rows);
}

/** Public mirror of non-secret challenge settings, for the dashboard. */
function refreshChallengeTab_() {
  const sh = sheetByName_(CONFIG.CHALLENGE_SHEET);
  const n = listAthletes_().length;
  const vals = [
    ['Key', 'Value'],
    ['Year', CONFIG.YEAR],
    ['IndividualTargetKm', CONFIG.INDIVIDUAL_TARGET_KM],
    ['Participants', n],
    ['GroupTargetKm', n * CONFIG.INDIVIDUAL_TARGET_KM],
  ];
  sh.getRange(1, 1, vals.length, 2).setValues(vals);
}

/**
 * Fetches and appends new activities for the given athletes.
 * Returns { added, failures:[{ name, message, reauth, alreadyFlagged }] }.
 */
function syncAthletes_(athletes, afterEpoch) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(60000)) throw new Error('Another sync is already running.');
  const failures = [];
  let added = 0;
  try {
    const sheet = ensureActivitiesSheet_();
    const seen = existingActivityIds_(sheet);
    const rows = [];
    athletes.forEach(athlete => {
      const wasFlagged = !!athlete.needsReauth;
      try {
        const token = refreshAccessToken_(athlete);
        fetchActivities_(token, afterEpoch, yearEndEpoch_()).forEach(act => {
          const row = activityRow_(athlete, act);
          if (row[6].slice(0, 4) !== String(CONFIG.YEAR)) return;
          const id = String(act.id);
          if (seen.has(id)) return;
          seen.add(id);
          rows.push(row);
        });
      } catch (err) {
        const reauth = err.status === 400 || err.status === 401;
        if (reauth) { athlete.needsReauth = true; saveAthlete_(athlete); }
        failures.push({ name: athlete.name, message: String(err.message || err), reauth: reauth, alreadyFlagged: wasFlagged });
        console.error('Sync failed for ' + athlete.name + ': ' + err.message);
      }
    });
    appendRows_(sheet, rows);
    added = rows.length;
    refreshChallengeTab_();
  } finally {
    lock.releaseLock();
  }
  return { added: added, failures: failures };
}

/** Daily trigger. Safe to run by hand. */
function syncActivities() {
  const now = Math.floor(Date.now() / 1000);
  const after = Math.max(yearStartEpoch_(), now - CONFIG.SYNC_WINDOW_DAYS * 86400);
  const result = syncAthletes_(listAthletes_(), after);
  console.log('Added ' + result.added + ' activities.');

  const toReport = result.failures.filter(f => !(f.reauth && f.alreadyFlagged));
  if (toReport.length) {
    const lines = toReport.map(f => '- ' + f.name + ': ' + f.message + (f.reauth ? ' (needs to re-authorise)' : ''));
    alertOwner_('Sync problem', lines.join('\n') + '\n\nInvite link to resend: ' + inviteUrl_());
  }
}
