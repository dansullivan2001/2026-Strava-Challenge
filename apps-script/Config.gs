/**
 * Non-secret settings. Secrets (Strava client ID/secret, invite key, redirect URI)
 * live in Script Properties, never here. See README.md.
 */

// Challenge year. Set to 2026 if you cut over before the 2026 challenge ends.
const YEAR = 2027;

const CONFIG = {
  YEAR: YEAR,
  // Each athlete's target is the year in km (2027 -> 2,027 km).
  // Group target = number of registered athletes x this.
  INDIVIDUAL_TARGET_KM: YEAR,

  CHALLENGE_NAME: YEAR + 'km Challenge',
  DASHBOARD_URL: 'https://dansullivan2001.github.io/2026-Strava-Challenge/',

  // Lower-case. Matches the dashboard's exclusions.
  EXCLUDED_TYPES: ['walk', 'hike', 'walking', 'hiking'],

  ACTIVITIES_SHEET: 'Activities',
  CHALLENGE_SHEET: 'Challenge',

  // 'activity:read' = public/followers activities; 'activity:read_all' also includes private ones.
  STRAVA_SCOPE: 'activity:read_all',

  // Daily sync looks back this far (the invite backfill goes back to 1 January).
  SYNC_WINDOW_DAYS: 30,

  // Route landmarks are defined for a 10,130 km route and scaled so the
  // finish line always equals the current group target.
  ROUTE_BASE_KM: 10130,
  LANDMARKS: [
    { km: 0,     name: 'the North Pole',      emoji: '🧊' },
    { km: 555,   name: 'the Arctic Ocean',    emoji: '🌊' },
    { km: 1221,  name: 'Svalbard',            emoji: '🏔️' },
    { km: 2220,  name: 'Tromsø',              emoji: '🌌' },
    { km: 3330,  name: 'Oslo',                emoji: '🇳🇴' },
    { km: 4329,  name: 'London',              emoji: '🏙️' },
    { km: 4662,  name: 'Paris',               emoji: '🗼' },
    { km: 5106,  name: 'the Swiss Alps',      emoji: '⛰️' },
    { km: 5439,  name: 'Rome',                emoji: '🏛️' },
    { km: 5883,  name: 'Athens',              emoji: '🏺' },
    { km: 6660,  name: 'Cairo',               emoji: '🐪' },
    { km: 7215,  name: 'Khartoum',            emoji: '🏜️' },
    { km: 8325,  name: 'the Sahel',           emoji: '🌵' },
    { km: 9435,  name: 'the Gulf of Guinea',  emoji: '🌊' },
    { km: 9990,  name: 'the Equator',         emoji: '🌍' },
    { km: 10130, name: 'the finish line',     emoji: '🎉' },
  ],
};
