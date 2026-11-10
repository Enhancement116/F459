// Shared by tools/update-ephemeris.js and tools/build-ephemeris.js: turns parsed broadcast
// ephemerides into the compact one-day JSON the site reads, and writes data/latest.json.
const fs = require('fs');
const path = require('path');
const { FIELDS, toRecord } = require('../gnss-orbit.js');

const DAY = 86400;
// A broadcast ephemeris is good for about two hours either side of its reference time.
const VALID = 7200;
const GPS_EPOCH = Date.UTC(1980, 0, 6);

const round = v => Number(v.toPrecision(12));
const dayOf = toeGpst => Math.floor(toeGpst / DAY);
const dateOf = day => new Date(GPS_EPOCH + day * DAY * 1000).toISOString().slice(0, 10);
const dayFromDate = date => {
  const [y, m, d] = date.split('-').map(Number);
  return (Date.UTC(y, m - 1, d) - GPS_EPOCH) / 1000 / DAY;
};

// One GPST day of ephemerides. Records up to two hours either side of the day are kept, so the
// first and last hours still have a nearby set. `from`/`to` is the part of the day (seconds from
// 00:00 GPST) the records actually cover: the site only animates and computes inside it.
function buildDay(ephs, day, sources) {
  const dayStart = day * DAY;
  const date = dateOf(day);
  const doy = Math.round((Date.parse(date) - Date.UTC(+date.slice(0, 4), 0, 1)) / 86400000) + 1;
  const sats = {};
  const seen = new Set();
  let unhealthy = 0, lo = Infinity, hi = -Infinity;
  for (const eph of ephs) {
    const rel = eph.toeGpst - dayStart;
    if (rel < -VALID || rel > DAY + VALID) continue;
    if (eph.health !== 0) { unhealthy++; continue; }
    const key = eph.prn + ':' + eph.toeGpst;
    if (seen.has(key)) continue;
    seen.add(key);
    (sats[eph.prn] = sats[eph.prn] || []).push([rel, ...toRecord(eph).map(round)]);
    lo = Math.min(lo, rel); hi = Math.max(hi, rel);
  }
  for (const list of Object.values(sats)) list.sort((a, b) => a[0] - b[0]);
  const from = Math.max(0, Math.floor(lo - VALID));
  const to = Math.min(DAY, Math.ceil(hi + VALID));
  return {
    data: {
      date, doy, timeSystem: 'GPST', leapSeconds: 18,
      from, to,
      fields: ['toeFromDayStart', ...FIELDS],
      sources,
      sats: Object.fromEntries(Object.entries(sats).sort(([a], [b]) => a.localeCompare(b)))
    },
    unique: seen.size, unhealthy
  };
}

function writeDay(built, out, { keepLatest = false } = {}) {
  const { data } = built;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const json = JSON.stringify(data);
  const same = fs.existsSync(out) && fs.readFileSync(out, 'utf8') === json;
  fs.writeFileSync(out, json);
  if (!keepLatest) {
    const manifest = path.join(path.dirname(out), 'latest.json');
    let built = Date.now();
    // Same data as last time: keep the old stamp, so nothing changes and browsers keep their copy.
    try {
      const old = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (same && old.file === path.basename(out) && old.built) built = old.built;
    } catch (_) {}
    fs.writeFileSync(manifest, JSON.stringify({ file: path.basename(out), date: data.date, doy: data.doy, from: data.from, to: data.to, built }));
  }
  return out;
}

const hhmm = s => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}`;

function describe(built, out) {
  const { data, unique, unhealthy } = built;
  const ids = Object.keys(data.sats);
  return `${out}: ${data.date} (day ${data.doy}), covers ${hhmm(data.from)}–${hhmm(data.to)} GPST, ` +
    `${ids.filter(s => s[0] === 'G').length} GPS + ${ids.filter(s => s[0] === 'C').length} BDS satellites, ` +
    `${unique} ephemerides (${unhealthy} unhealthy skipped), ${fs.statSync(out).size} bytes`;
}

module.exports = { DAY, VALID, dayOf, dateOf, dayFromDate, buildDay, writeDay, describe, hhmm };
