// Merges a day of RINEX navigation files into the compact JSON used by the homepage globe.
// Usage: node tools/build-ephemeris.js --date 2026-09-22 --out data/gnss-2026-265.json file1.rnx file2.rnx ...
const fs = require('fs');
const path = require('path');
const { parseRinex, toRecord, FIELDS } = require('../gnss-orbit.js');

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
const date = opt('--date'), out = opt('--out');
if (!date || !out || !args.length) {
  console.error('Usage: node tools/build-ephemeris.js --date YYYY-MM-DD --out data/file.json nav1.rnx [nav2.rnx ...]');
  process.exit(1);
}

const [y, m, d] = date.split('-').map(Number);
const dayStart = (Date.UTC(y, m - 1, d) - Date.UTC(1980, 0, 6)) / 1000; // 00:00 GPST, seconds since GPS epoch
const doy = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
const round = v => Number(v.toPrecision(12));

const sats = {};
const seen = new Set();
let total = 0, unhealthy = 0;
for (const file of args) {
  for (const eph of parseRinex(fs.readFileSync(file, 'utf8'))) {
    total++;
    const rel = eph.toeGpst - dayStart;
    if (rel < -7200 || rel > 93600) continue;
    if (eph.health !== 0) { unhealthy++; continue; }
    const key = eph.prn + ':' + eph.toeGpst;
    if (seen.has(key)) continue;
    seen.add(key);
    (sats[eph.prn] = sats[eph.prn] || []).push([rel, ...toRecord(eph).map(round)]);
  }
}
for (const list of Object.values(sats)) list.sort((a, b) => a[0] - b[0]);

const data = {
  date, doy, timeSystem: 'GPST', leapSeconds: 18,
  fields: ['toeFromDayStart', ...FIELDS],
  sources: args.map(f => path.basename(f)),
  sats: Object.fromEntries(Object.entries(sats).sort(([a], [b]) => a.localeCompare(b)))
};
fs.writeFileSync(out, JSON.stringify(data));
const ids = Object.keys(sats);
console.log(`${out}: ${ids.filter(s => s[0] === 'G').length} GPS + ${ids.filter(s => s[0] === 'C').length} BDS satellites, ` +
  `${seen.size} unique ephemerides from ${total} records (${unhealthy} unhealthy skipped), ${fs.statSync(out).size} bytes`);
