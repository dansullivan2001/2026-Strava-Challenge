function todayIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function readActivities_() {
  const sheet = ensureActivitiesSheet_();
  const n = sheet.getLastRow() - 1;
  if (n < 1) return [];
  const tz = spreadsheet_().getSpreadsheetTimeZone();
  return sheet.getRange(2, 1, n, 7).getValues().map(r => ({
    athlete: String(r[0]).trim(),
    type: String(r[3]),
    distance: Number(r[4]) || 0,
    date: r[6] instanceof Date ? Utilities.formatDate(r[6], tz, 'yyyy-MM-dd') : String(r[6]).slice(0, 10),
  }));
}

/** Sunday trigger. */
function sendWeeklyEmail() { runWeekly_(false); }

/** Run by hand: sends the real email, to you only, and records nothing. */
function sendWeeklyEmailTestToMe() { runWeekly_(true); }

function runWeekly_(testOnly) {
  const lastSent = props_().getProperty('LAST_WEEKLY_SENT');
  if (!testOnly && lastSent && Date.now() - new Date(lastSent).getTime() < 5 * 86400000) {
    console.log('Weekly email already sent on ' + lastSent + '; skipping.');
    return;
  }

  try { syncActivities(); } catch (err) { console.error('Pre-email sync failed: ' + err.message); }

  const athletes = listAthletes_();
  if (!athletes.length) { console.log('No athletes registered.'); return; }

  const stats = computeStats(
    readActivities_(),
    athletes.map(a => ({ id: a.id, name: a.name })),
    {
      year: CONFIG.YEAR,
      today: todayIso_(),
      excludedTypes: CONFIG.EXCLUDED_TYPES,
      individualTarget: CONFIG.INDIVIDUAL_TARGET_KM,
    });
  const cel = decideCelebrations(stats, celebratedFlags_());
  const mail = buildEmail(stats, cel, {
    dashboardUrl: CONFIG.DASHBOARD_URL,
    landmarks: CONFIG.LANDMARKS,
    routeBaseKm: CONFIG.ROUTE_BASE_KM,
    challengeName: CONFIG.CHALLENGE_NAME,
  });

  const recipients = testOnly
    ? [ownerEmail_()]
    : athletes.filter(a => a.email).map(a => a.email);

  let sent = 0;
  recipients.forEach(to => {
    try {
      MailApp.sendEmail({ to: to, subject: mail.subject, body: mail.text, htmlBody: mail.html, name: CONFIG.CHALLENGE_NAME });
      sent++;
    } catch (err) {
      console.error('Email to ' + to + ' failed: ' + err.message);
    }
  });
  console.log('Sent ' + sent + '/' + recipients.length + ' emails. Remaining daily quota: ' + MailApp.getRemainingDailyQuota());

  if (!testOnly && sent > 0) {
    setFlags_(cel.flagsToSet);
    props_().setProperty('LAST_WEEKLY_SENT', new Date().toISOString());
  }
  if (!testOnly && sent < recipients.length) {
    alertOwner_('Weekly email not fully sent', 'Sent ' + sent + ' of ' + recipients.length + '. See Executions in the Apps Script editor.');
  }
}
