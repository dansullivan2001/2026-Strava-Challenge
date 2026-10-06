/**
 * Run once from the editor after setting Script Properties.
 * Idempotent: re-running replaces the triggers rather than duplicating them.
 */
function setup() {
  ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET', 'STRAVA_REDIRECT_URI', 'INVITE_KEY'].forEach(requireProp_);

  ensureActivitiesSheet_();
  refreshChallengeTab_();

  ScriptApp.getProjectTriggers().forEach(t => {
    const fn = t.getHandlerFunction();
    if (fn === 'syncActivities' || fn === 'sendWeeklyEmail') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncActivities').timeBased().everyDays(1).atHour(21).create();
  ScriptApp.newTrigger('sendWeeklyEmail').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(21).create();

  console.log('Triggers created (daily sync ~21:00, Sunday email ~21:00, ' + Session.getScriptTimeZone() + ').');
  console.log('Invite link: ' + inviteUrl_());
}
