// Run: node apps-script/test/logic.test.js
// Loads Logic.gs (which uses no Apps Script services) and checks it.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Logic.gs'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Config.gs'), 'utf8'), ctx);
const L = name => vm.runInContext(name, ctx);
const CONFIG = L('CONFIG'); // top-level const is not a property of the context object

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  ' + name); }

test('mondayOf_ and week bounds', () => {
  assert.strictEqual(L('mondayOf_')('2026-10-06'), '2026-10-05'); // Tuesday
  assert.strictEqual(L('mondayOf_')('2026-10-11'), '2026-10-05'); // Sunday
  assert.strictEqual(L('mondayOf_')('2026-10-05'), '2026-10-05'); // Monday
  assert.strictEqual(L('addDays_')('2026-12-30', 3), '2027-01-02');
});

test('dayOfYear_ and daysInYear_', () => {
  assert.strictEqual(L('dayOfYear_')('2026-10-06'), 279);
  assert.strictEqual(L('daysInYear_')(2028), 366);
  assert.strictEqual(L('daysInYear_')(2027), 365);
});

const athletes = [{ id: '1', name: 'Ann' }, { id: '2', name: 'Bob' }];
const baseOpts = { year: 2027, today: '2027-03-14', excludedTypes: ['walk', 'hike'], individualTarget: 2027 };

test('computeStats: totals, exclusions, year filter, week window, group target', () => {
  const acts = [
    { athlete: 'Ann', type: 'Run', distance: 10, date: '2027-03-08' },   // week (Mon)
    { athlete: 'Ann', type: 'Walk', distance: 50, date: '2027-03-09' },  // excluded
    { athlete: 'Bob', type: 'Ride', distance: 40, date: '2027-03-14' },  // week (Sun)
    { athlete: 'Bob', type: 'Run', distance: 5, date: '2027-03-07' },    // previous week
    { athlete: 'Bob', type: 'Run', distance: 99, date: '2026-12-31' },   // wrong year
    { athlete: 'Zed', type: 'Run', distance: 7, date: '2027-03-10' },    // unregistered: group only
  ];
  const s = L('computeStats')(acts, athletes, baseOpts);
  assert.strictEqual(s.groupTarget, 4054);
  assert.strictEqual(s.groupTotal, 62);
  const ann = s.athletes.find(a => a.name === 'Ann');
  const bob = s.athletes.find(a => a.name === 'Bob');
  assert.strictEqual(ann.ytd, 10);
  assert.strictEqual(ann.weekKm, 10);
  assert.strictEqual(bob.ytd, 45);
  assert.strictEqual(bob.weekKm, 40);
  assert.strictEqual(s.athletes[0].name, 'Bob'); // sorted by week km
  assert.strictEqual(s.weekStart, '2027-03-08');
});

test('computeStats: pace fraction by year', () => {
  const mk = today => L('computeStats')([], athletes, Object.assign({}, baseOpts, { today }));
  assert.ok(Math.abs(mk('2027-12-31').pctOfYear - 1) < 1e-9);
  assert.strictEqual(mk('2028-01-05').pctOfYear, 1);
  assert.strictEqual(mk('2026-12-01').pctOfYear, 0);
});

test('reachedOn dates and celebrations fire once', () => {
  const acts = [
    { athlete: 'Ann', type: 'Run', distance: 2000, date: '2027-06-01' },
    { athlete: 'Ann', type: 'Run', distance: 30, date: '2027-06-20' },
    { athlete: 'Bob', type: 'Run', distance: 100, date: '2027-06-21' },
  ];
  const o = Object.assign({}, baseOpts, { today: '2027-06-27' });
  const s = L('computeStats')(acts, athletes, o);
  assert.strictEqual(s.athletes.find(a => a.name === 'Ann').reachedOn, '2027-06-20');
  assert.strictEqual(s.groupReachedOn, null);

  const c1 = L('decideCelebrations')(s, []);
  assert.deepStrictEqual(Array.from(c1.athletes, a => a.name), ['Ann']);
  assert.strictEqual(c1.group, false);
  const c2 = L('decideCelebrations')(s, c1.flagsToSet);
  assert.strictEqual(c2.athletes.length, 0);
});

test('group celebration at 5 x year, once only', () => {
  const five = ['A', 'B', 'C', 'D', 'E'].map((n, i) => ({ id: String(i), name: n }));
  const acts = five.map((a, i) => ({ athlete: a.name, type: 'Run', distance: 2027, date: '2027-0' + (i + 1) + '-01' }));
  const o = { year: 2027, today: '2027-12-20', excludedTypes: [], individualTarget: 2027 };
  const s = L('computeStats')(acts, five, o);
  assert.strictEqual(s.groupTarget, 10135);
  assert.strictEqual(s.groupTotal, 10135);
  const c = L('decideCelebrations')(s, []);
  assert.strictEqual(c.group, true);
  assert.strictEqual(c.athletes.length, 5);
  assert.strictEqual(L('decideCelebrations')(s, c.flagsToSet).group, false);
});

test('landmark scales with the group target', () => {
  const lm = CONFIG.LANDMARKS;
  assert.strictEqual(L('currentLandmark_')(lm, 10130, 10130, 4400).name, 'London');
  // A target of 20260 doubles the route: Tromsø moves to 4440 km, so 4400 km is still at Svalbard.
  assert.strictEqual(L('currentLandmark_')(lm, 10130, 20260, 4400).name, 'Svalbard');
  assert.strictEqual(L('currentLandmark_')(lm, 10130, 10130, 0).name, 'the North Pole');
});

test('buildEmail: variants, escaping, subjects', () => {
  const five = ['A', 'B', 'C', 'D', 'E'].map((n, i) => ({ id: String(i), name: n }));
  const emailOpts = { dashboardUrl: 'https://example.com/', landmarks: CONFIG.LANDMARKS, routeBaseKm: 10130, challengeName: '2027km Challenge' };
  const o = { year: 2027, today: '2027-12-20', excludedTypes: [], individualTarget: 2027 };

  // normal week
  let s = L('computeStats')([{ athlete: 'A', type: 'Run', distance: 12, date: '2027-12-19' }], five, o);
  let m = L('buildEmail')(s, L('decideCelebrations')(s, []), emailOpts);
  assert.ok(/weekly summary/.test(m.subject));
  assert.ok(!/Challenge complete/.test(m.html));

  // XSS in a name
  const evil = [{ id: '9', name: '<script>alert(1)</script>' }];
  s = L('computeStats')([], evil, o);
  m = L('buildEmail')(s, L('decideCelebrations')(s, []), emailOpts);
  assert.ok(!m.html.includes('<script>'));
  assert.ok(m.html.includes('&lt;script&gt;'));

  // individual celebration
  s = L('computeStats')([{ athlete: 'A', type: 'Run', distance: 2027, date: '2027-12-18' }], five, o);
  m = L('buildEmail')(s, L('decideCelebrations')(s, []), emailOpts);
  assert.ok(/reached 2,027 km/.test(m.subject));
  assert.ok(m.html.includes('individual target'));

  // group celebration
  const acts = five.map(a => ({ athlete: a.name, type: 'Run', distance: 2027, date: '2027-12-18' }));
  s = L('computeStats')(acts, five, o);
  m = L('buildEmail')(s, L('decideCelebrations')(s, []), emailOpts);
  assert.ok(/Challenge complete/.test(m.subject));
  assert.ok(m.html.includes('Challenge complete!'));
  assert.ok(m.html.includes('10,135'));
});

console.log('\n' + passed + ' tests passed');
