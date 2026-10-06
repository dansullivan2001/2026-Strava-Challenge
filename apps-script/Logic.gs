/**
 * Pure logic. Uses no Apps Script services, so it is unit-tested in Node
 * (see test/logic.test.js). Dates are 'YYYY-MM-DD' strings throughout.
 */

// ── Dates ────────────────────────────────────────────────────────────────

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

function isoDate_(y, m, d) { return y + '-' + pad2_(m) + '-' + pad2_(d); }

function parseIso_(s) {
  const p = s.split('-').map(Number);
  return Date.UTC(p[0], p[1] - 1, p[2]);
}

function addDays_(iso, n) {
  const d = new Date(parseIso_(iso) + n * 86400000);
  return isoDate_(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function mondayOf_(iso) {
  const dow = new Date(parseIso_(iso)).getUTCDay(); // 0 = Sunday
  return addDays_(iso, -((dow + 6) % 7));
}

function dayOfYear_(iso) {
  const y = Number(iso.slice(0, 4));
  return Math.round((parseIso_(iso) - Date.UTC(y, 0, 1)) / 86400000) + 1;
}

function daysInYear_(y) {
  return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365;
}

const MONTHS_ = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDay_(iso) {
  return Number(iso.slice(8, 10)) + ' ' + MONTHS_[Number(iso.slice(5, 7)) - 1];
}

// ── Formatting ───────────────────────────────────────────────────────────

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtInt_(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

function fmt1_(n) { return n.toFixed(1); }

// ── Flags (which celebrations have already been sent) ────────────────────

function flagGroup_(year) { return 'celebrated:group:' + year; }

function flagAthlete_(id, year) { return 'celebrated:athlete:' + id + ':' + year; }

// ── Stats ────────────────────────────────────────────────────────────────

function reachedOn_(list, target) {
  let c = 0;
  for (let i = 0; i < list.length; i++) {
    c += list[i].km;
    if (c >= target) return list[i].date;
  }
  return null;
}

/**
 * activities: [{ athlete (name), type, distance (km), date }]
 * athletes:   [{ id, name }]  (names must be unique)
 * opts:       { year, today, excludedTypes, individualTarget }
 */
function computeStats(activities, athletes, opts) {
  const weekStart = mondayOf_(opts.today);
  const weekEnd = addDays_(weekStart, 6);
  const byName = new Map();
  const per = new Map();
  athletes.forEach(a => {
    byName.set(a.name, a.id);
    per.set(a.id, { id: a.id, name: a.name, ytd: 0, weekKm: 0, weekCount: 0, lastDate: null, reachedOn: null });
  });

  const eligible = [];
  let groupTotal = 0;
  activities.forEach(act => {
    if (!act.date || act.date.slice(0, 4) !== String(opts.year)) return;
    if (opts.excludedTypes.indexOf(String(act.type || '').toLowerCase()) !== -1) return;
    const km = Number(act.distance) || 0;
    if (km <= 0) return;
    groupTotal += km;
    const id = byName.get(act.athlete);
    eligible.push({ athleteId: id === undefined ? null : id, date: act.date, km: km });
    if (id === undefined) return;
    const s = per.get(id);
    s.ytd += km;
    if (!s.lastDate || act.date > s.lastDate) s.lastDate = act.date;
    if (act.date >= weekStart && act.date <= weekEnd) { s.weekKm += km; s.weekCount++; }
  });

  eligible.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const groupTarget = athletes.length * opts.individualTarget;
  const ty = Number(opts.today.slice(0, 4));
  const pctOfYear = ty > opts.year ? 1 : ty < opts.year ? 0 : dayOfYear_(opts.today) / daysInYear_(opts.year);
  const expectedKm = groupTarget * pctOfYear;

  const list = Array.from(per.values());
  list.forEach(s => {
    if (s.ytd >= opts.individualTarget) {
      s.reachedOn = reachedOn_(eligible.filter(e => e.athleteId === s.id), opts.individualTarget);
    }
  });
  list.sort((a, b) => b.weekKm - a.weekKm || b.ytd - a.ytd || a.name.localeCompare(b.name));

  return {
    year: opts.year,
    today: opts.today,
    weekStart: weekStart,
    weekEnd: weekEnd,
    athletes: list,
    groupTotal: groupTotal,
    groupTarget: groupTarget,
    individualTarget: opts.individualTarget,
    expectedKm: expectedKm,
    diffKm: groupTotal - expectedKm,
    pctOfYear: pctOfYear,
    pctOfGoal: groupTarget > 0 ? (groupTotal / groupTarget) * 100 : 0,
    groupReachedOn: groupTarget > 0 ? reachedOn_(eligible, groupTarget) : null,
  };
}

/** Who is newly celebrating? flagKeys = keys already recorded as celebrated. */
function decideCelebrations(stats, flagKeys) {
  const done = new Set(flagKeys);
  const athletes = stats.athletes.filter(s =>
    s.ytd >= stats.individualTarget && !done.has(flagAthlete_(s.id, stats.year)));
  const group = stats.groupTarget > 0 && stats.groupTotal >= stats.groupTarget && !done.has(flagGroup_(stats.year));
  const flagsToSet = athletes.map(s => flagAthlete_(s.id, stats.year));
  if (group) flagsToSet.push(flagGroup_(stats.year));
  return { group: group, athletes: athletes, flagsToSet: flagsToSet };
}

function currentLandmark_(landmarks, baseKm, groupTarget, groupTotal) {
  const scale = groupTarget / baseKm;
  let cur = landmarks[0];
  landmarks.forEach(l => { if (groupTotal >= l.km * scale) cur = l; });
  return cur;
}

// ── Email ────────────────────────────────────────────────────────────────

function progressBar_(stats) {
  const targetPct = parseFloat((stats.pctOfYear * 100).toFixed(2));
  const progressPct = parseFloat(Math.min(stats.pctOfGoal, 100).toFixed(2));
  const cell = (w, bg) => '<td width="' + w + '%" bgcolor="' + bg + '" style="height:24px;"></td>';
  const marker = '<td width="3" bgcolor="#000000" style="height:24px;min-width:3px;"></td>';
  let cells;
  if (progressPct >= targetPct) {
    cells = cell(targetPct, '#FC4C02') + marker +
      cell(parseFloat((progressPct - targetPct).toFixed(2)), '#FC4C02') +
      cell(parseFloat((100 - progressPct).toFixed(2)), '#e0e0e0');
  } else {
    cells = cell(progressPct, '#FC4C02') +
      cell(parseFloat((targetPct - progressPct).toFixed(2)), '#fee2e2') + marker +
      cell(parseFloat((100 - targetPct).toFixed(2)), '#e0e0e0');
  }
  return '<table width="100%" border="0" cellpadding="0" cellspacing="0" ' +
    'style="height:24px;border-radius:12px;overflow:hidden;background-color:#e0e0e0;table-layout:fixed;">' +
    '<tr style="vertical-align:middle;">' + cells + '</tr></table>';
}

/**
 * opts: { dashboardUrl, landmarks, routeBaseKm, challengeName }
 * Returns { subject, html, text }.
 */
function buildEmail(stats, cel, opts) {
  const box = 'font-family:sans-serif;max-width:600px;border:1px solid #eee;border-radius:12px;margin-bottom:20px;';
  const parts = [];
  const target = fmtInt_(stats.groupTarget);
  const indTarget = fmtInt_(stats.individualTarget);

  // Group celebration headline
  if (cel.group) {
    parts.push(
      '<div style="' + box + 'background:#FC4C02;color:#ffffff;padding:28px;text-align:center;border:0;">' +
      '<div style="font-size:48px;">🎉🏆🎉</div>' +
      '<h1 style="margin:8px 0;">Challenge complete!</h1>' +
      '<p style="font-size:18px;margin:0;">Together you have covered <strong>' + fmtInt_(stats.groupTotal) +
      ' km</strong>, beating the ' + target + ' km target' +
      (stats.groupReachedOn ? ' on ' + fmtDay_(stats.groupReachedOn) : '') + '.</p></div>');
  }

  // Individual celebrations
  cel.athletes.forEach(s => {
    parts.push(
      '<div style="' + box + 'padding:16px 20px;border:2px solid #FC4C02;background:#fff4ee;">' +
      '🏅 <strong>' + esc_(s.name) + '</strong> has reached the ' + indTarget + ' km individual target' +
      (s.reachedOn ? ' (on ' + fmtDay_(s.reachedOn) + ')' : '') + '!</div>');
  });

  // Weekly table
  let weekly = '<div style="' + box + 'padding:20px;"><h2 style="color:#FC4C02;margin-top:0;">Weekly Summary 🏆</h2>' +
    '<p style="color:#999;font-size:12px;margin:0 0 10px;">' + fmtDay_(stats.weekStart) + ' – ' + fmtDay_(stats.weekEnd) + '</p>' +
    '<table style="width:100%;border-collapse:collapse;">';
  stats.athletes.forEach(s => {
    const status = s.weekKm > 0
      ? s.weekCount + (s.weekCount === 1 ? ' activity' : ' activities')
      : '<span style="color:#999;font-style:italic;">Last: ' + (s.lastDate ? fmtDay_(s.lastDate) : 'No data') + '</span>';
    weekly += '<tr style="border-bottom:1px solid #eee;">' +
      '<td style="padding:10px 5px;font-weight:bold;">' + esc_(s.name) + '</td>' +
      '<td style="padding:10px 5px;">' + fmt1_(s.weekKm) + ' km</td>' +
      '<td style="padding:10px 5px;font-size:12px;color:#666;">' + fmtInt_(s.ytd) + ' / ' + indTarget + ' km</td>' +
      '<td style="padding:10px 5px;font-size:12px;text-align:right;">' + status + '</td></tr>';
  });
  weekly += '</table></div>';
  parts.push(weekly);

  // Year to date vs pace
  const ahead = stats.diffKm >= 0;
  const arrow = ahead ? '<span style="color:#4CAF50;">▲</span>' : '<span style="color:#F44336;">▼</span>';
  const paceLine = stats.groupTotal >= stats.groupTarget
    ? 'The group has reached its <strong>' + target + ' km</strong> target.'
    : 'The group is <strong>' + fmt1_(Math.abs(stats.diffKm)) + ' km</strong> ' + (ahead ? 'ahead of' : 'behind') + ' pace.';
  const landmark = currentLandmark_(opts.landmarks, opts.routeBaseKm, stats.groupTarget, stats.groupTotal);
  parts.push(
    '<div style="' + box + 'padding:25px;background-color:#fcfcfc;">' +
    '<h2 style="color:#333;margin-top:0;margin-bottom:8px;">Road to ' + target + ' km</h2>' +
    '<div style="font-size:36px;font-weight:bold;margin:5px 0;color:#111;">' + fmtInt_(stats.groupTotal) + ' km ' + arrow + '</div>' +
    '<p style="font-size:15px;color:#666;margin-bottom:25px;">' + paceLine + '</p>' +
    progressBar_(stats) +
    '<div style="margin-top:25px;padding:15px;border:1px dashed #ddd;border-radius:8px;text-align:center;background-color:#fff;">' +
    '<p style="font-size:14px;color:#444;margin:0;">📍 Virtual location: <strong>Passed ' + esc_(landmark.name) + ' ' + landmark.emoji + '</strong></p>' +
    '<p style="font-size:11px;color:#999;margin-top:4px;margin-bottom:12px;">Tracking the journey from the North Pole to the Equator.</p>' +
    '<a href="' + esc_(opts.dashboardUrl) + '" style="display:inline-block;padding:10px 20px;background-color:#FC4C02;color:#ffffff;text-decoration:none;border-radius:5px;font-weight:bold;font-size:13px;">View detailed stats &amp; dashboard →</a>' +
    '</div></div>');

  let subject;
  if (cel.group) {
    subject = '🎉 Challenge complete! ' + fmtInt_(stats.groupTotal) + ' km';
  } else if (cel.athletes.length) {
    subject = '🏅 ' + cel.athletes.map(s => s.name).join(' & ') + ' reached ' + indTarget + ' km';
  } else {
    subject = opts.challengeName + ' weekly summary: ' + fmtInt_(stats.groupTotal) + ' km so far';
  }

  const text = subject + '\n\nOpen this email in an HTML-capable client, or see ' + opts.dashboardUrl;
  return { subject: subject, html: parts.join('\n'), text: text };
}
