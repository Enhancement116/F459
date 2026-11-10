// Merges a day of RINEX navigation files into the compact JSON used by the site, and points
// data/latest.json at it so every page (globe, project hero, running example, sky) switches to that day.
// Usage: node tools/build-ephemeris.js --date 2026-09-22 --out data/gnss-2026-265.json file1.rnx file2.rnx ...
//        add --keep-latest to build a file without making it the current day.
// For everyday updates, tools/update-ephemeris.js reads the ephemeris/ folder and needs no arguments.
const fs = require('fs');
const path = require('path');
const { parseRinex } = require('../gnss-orbit.js');
const { dayFromDate, buildDay, writeDay, describe } = require('./ephemeris-day.js');

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
const keepLatest = args.includes('--keep-latest');
if (keepLatest) args.splice(args.indexOf('--keep-latest'), 1);
const date = opt('--date'), out = opt('--out');
if (!date || !out || !args.length) {
  console.error('Usage: node tools/build-ephemeris.js --date YYYY-MM-DD --out data/file.json nav1.rnx [nav2.rnx ...]');
  process.exit(1);
}

const ephs = args.flatMap(file => parseRinex(fs.readFileSync(file, 'utf8')));
const built = buildDay(ephs, dayFromDate(date), args.map(f => path.basename(f)));
writeDay(built, out, { keepLatest });
if (!keepLatest) console.log(`${path.join(path.dirname(out), 'latest.json')} now points to ${path.basename(out)}`);
console.log(describe(built, out));
