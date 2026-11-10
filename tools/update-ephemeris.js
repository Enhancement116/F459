// Picks up whatever broadcast-ephemeris files are in the ephemeris/ folder and makes the newest
// day the site's current day.
//
//   node tools/update-ephemeris.js                 newest day found in ephemeris/
//   node tools/update-ephemeris.js --date 2026-09-22   a specific day
//   node tools/update-ephemeris.js --dir other/folder  a different source folder
//   node tools/update-ephemeris.js --prune         also delete older data/gnss-*.json files
//   node tools/update-ephemeris.js --dry           report only, write nothing
//
// Files: RINEX 3 or 4 navigation files with GPS and/or BeiDou records, plain or .gz, in any
// subfolder, under any name (daily BRDC/BRDM files, hourly files, receiver logs). The day is read
// from the records themselves, not from file names. A full day is not required: if the newest
// day only has a few hours of records, the site uses those hours.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { parseRinex } = require('../gnss-orbit.js');
const { DAY, dayOf, dateOf, dayFromDate, buildDay, writeDay, describe, hhmm } = require('./ephemeris-day.js');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const flag = name => args.includes(name);
const dir = path.resolve(ROOT, opt('--dir') || 'ephemeris');
const forced = opt('--date');
const dataDir = path.join(ROOT, 'data');

if (!fs.existsSync(dir)) {
  console.error(`No folder at ${dir}. Create it and put RINEX navigation files in it.`);
  process.exit(1);
}

// Every file under the folder, newest first, so a day spread across files is read in full.
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (!/^(readme|\.)/i.test(e.name)) files.push(p);
  }
})(dir);

const ephs = [];
const fileDays = new Map();   // file -> set of days its records fall on
for (const file of files) {
  let text;
  try {
    let buf = fs.readFileSync(file);
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
    text = buf.toString('utf8');
  } catch (err) {
    console.warn(`skip ${path.relative(ROOT, file)}: ${err.message}`);
    continue;
  }
  if (!text.includes('END OF HEADER')) { console.warn(`skip ${path.relative(ROOT, file)}: not a RINEX file`); continue; }
  const found = parseRinex(text);
  if (!found.length) { console.warn(`skip ${path.relative(ROOT, file)}: no GPS or BeiDou records (RINEX 3/4 navigation needed)`); continue; }
  const days = new Set();
  for (const eph of found) { eph.file = file; ephs.push(eph); days.add(dayOf(eph.toeGpst)); }
  fileDays.set(file, days);
}
if (!ephs.length) { console.error(`No usable ephemeris in ${dir}.`); process.exit(1); }

// Satellites with a healthy record on each day.
const perDay = new Map();
for (const e of ephs) {
  if (e.health !== 0) continue;
  const d = dayOf(e.toeGpst);
  (perDay.get(d) || perDay.set(d, new Set()).get(d)).add(e.prn);
}
const days = [...perDay.keys()].sort((a, b) => a - b);
console.log('Days found:');
for (const d of days) {
  const t = ephs.filter(e => dayOf(e.toeGpst) === d).map(e => e.toeGpst - d * DAY);
  console.log(`  ${dateOf(d)}  ${String(perDay.get(d).size).padStart(3)} satellites  ${hhmm(Math.min(...t))}–${hhmm(Math.max(...t))} GPST`);
}

// The newest day, unless it is only a stray set at midnight (a file ending at 24:00 often carries
// a record for the next day): a day needs a reasonable share of the satellites seen on any day.
let day;
if (forced) {
  day = dayFromDate(forced);
  if (!perDay.has(day)) { console.error(`No records for ${forced}.`); process.exit(1); }
} else {
  const most = Math.max(...[...perDay.values()].map(s => s.size));
  day = days.filter(d => perDay.get(d).size >= Math.max(8, most * 0.4)).pop();
}

const sources = [...fileDays].filter(([, ds]) => [day - 1, day, day + 1].some(d => ds.has(d))).map(([f]) => path.basename(f)).sort();
const built = buildDay(ephs, day, sources);
const out = path.join(dataDir, `gnss-${built.data.date.slice(0, 4)}-${String(built.data.doy).padStart(3, '0')}.json`);

if (flag('--dry')) {
  console.log(`Would write ${path.relative(ROOT, out)}: ${built.data.date}, ${hhmm(built.data.from)}–${hhmm(built.data.to)} GPST, ${Object.keys(built.data.sats).length} satellites`);
  process.exit(0);
}
writeDay(built, out);
console.log(describe(built, path.relative(ROOT, out)));
console.log(`data/latest.json now points to ${path.basename(out)}`);
const ids = Object.keys(built.data.sats);
if (!ids.some(id => id[0] === 'G')) console.warn('Note: no GPS records for this day; pages that follow a GPS satellite keep their built-in example.');
if (!ids.some(id => id[0] === 'C')) console.warn('Note: no BeiDou records for this day.');
if (built.data.to - built.data.from < DAY) console.log(`Part of a day: the site will animate ${hhmm(built.data.from)}–${hhmm(built.data.to)} GPST only.`);

if (flag('--prune')) {
  for (const f of fs.readdirSync(dataDir)) {
    if (/^gnss-\d{4}-\d{3}\.json$/.test(f) && f !== path.basename(out)) {
      fs.unlinkSync(path.join(dataDir, f));
      console.log(`removed data/${f}`);
    }
  }
}
