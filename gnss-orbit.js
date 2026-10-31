// GPS and BeiDou broadcast-ephemeris orbit model (RINEX 3/4 navigation files,
// IS-GPS-200 and BDS ICD equations). Used by globe.js in the browser and by
// tools/build-ephemeris.js in Node.
(function (root) {
  const SYSTEMS = {
    G: { GM: 3.986005e14, OMEGA_E: 7.2921151467e-5, weekOffset: 0, timeOffset: 0 },
    // BDT week 0 starts at GPS week 1356; BDT = GPST − 14 s.
    C: { GM: 3.986004418e14, OMEGA_E: 7.2921150e-5, weekOffset: 1356, timeOffset: 14 }
  };
  const WEEK = 604800, HALF_WEEK = 302400;
  // BDS GEO satellites use the rotated-frame GEO algorithm.
  const BDS_GEO = new Set([1, 2, 3, 4, 5, 59, 60, 61, 62]);
  // Order of the orbit parameters in compact records (see toRecord).
  const FIELDS = ['toe', 'sqrtA', 'e', 'i0', 'omega0', 'omega', 'm0', 'deltaN', 'idot', 'omegaDot', 'cuc', 'cus', 'crc', 'crs', 'cic', 'cis'];

  const num = s => parseFloat(String(s).trim().replace(/[dD]/, 'e'));

  function classify(sys, prnNum, sqrtA) {
    if (sys === 'C' && BDS_GEO.has(prnNum)) return 'GEO';
    if (sys === 'C' && sqrtA > 6000) return 'IGSO';
    return 'MEO';
  }

  // Parses GPS (G) and BeiDou (C) Keplerian records from a RINEX 3.0x or 4.0x
  // navigation file. Other systems and record types are skipped.
  function parseRinex(text, systems = 'GC') {
    const lines = text.split(/\r?\n/);
    let i = lines.findIndex(l => l.includes('END OF HEADER')) + 1;
    const out = [];
    while (i > 0 && i < lines.length) {
      const line = lines[i];
      if (!/^[A-Z]\d\d /.test(line) || !systems.includes(line[0])) { i++; continue; }
      const fields = [line.slice(23, 42), line.slice(42, 61), line.slice(61, 80)];
      for (let k = 1; k <= 7; k++) {
        const c = lines[i + k] || '';
        for (let f = 0; f < 4; f++) fields.push(c.slice(4 + 19 * f, 23 + 19 * f));
      }
      const v = fields.map(num);
      const sys = line[0], prnNum = Number(line.slice(1, 3));
      const eph = {
        sys, prn: line.slice(0, 3), prnNum,
        crs: v[4], deltaN: v[5], m0: v[6],
        cuc: v[7], e: v[8], cus: v[9], sqrtA: v[10],
        toe: v[11], cic: v[12], omega0: v[13], cis: v[14],
        i0: v[15], crc: v[16], omega: v[17], omegaDot: v[18],
        idot: v[19], week: v[21], health: v[24]
      };
      const s = SYSTEMS[sys];
      // Time of ephemeris on the continuous GPST scale (seconds since 1980-01-06).
      eph.toeGpst = (eph.week + s.weekOffset) * WEEK + eph.toe + s.timeOffset;
      eph.kind = classify(sys, prnNum, eph.sqrtA);
      if (Number.isFinite(eph.sqrtA) && Number.isFinite(eph.toe)) out.push(eph);
      i += 8;
    }
    return out;
  }

  const toRecord = eph => FIELDS.map(f => eph[f]);
  function fromRecord(sys, prnNum, values) {
    const eph = { sys, prnNum };
    FIELDS.forEach((f, i) => { eph[f] = values[i]; });
    eph.kind = classify(sys, prnNum, eph.sqrtA);
    return eph;
  }

  // ECEF position (m) at tk seconds from toe.
  function position(eph, tk) {
    const { GM, OMEGA_E } = SYSTEMS[eph.sys];
    if (tk > HALF_WEEK) tk -= WEEK;
    if (tk < -HALF_WEEK) tk += WEEK;
    const A = eph.sqrtA * eph.sqrtA;
    const n = Math.sqrt(GM / (A * A * A)) + eph.deltaN;
    const M = eph.m0 + n * tk;
    let E = M;
    for (let k = 0; k < 12; k++) E = M + eph.e * Math.sin(E);
    const nu = Math.atan2(Math.sqrt(1 - eph.e * eph.e) * Math.sin(E), Math.cos(E) - eph.e);
    const phi = nu + eph.omega;
    const s2 = Math.sin(2 * phi), c2 = Math.cos(2 * phi);
    const u = phi + eph.cus * s2 + eph.cuc * c2;
    const r = A * (1 - eph.e * Math.cos(E)) + eph.crs * s2 + eph.crc * c2;
    const inc = eph.i0 + eph.idot * tk + eph.cis * s2 + eph.cic * c2;
    const x = r * Math.cos(u), y = r * Math.sin(u);
    if (eph.sys === 'C' && eph.kind === 'GEO') {
      const om = eph.omega0 + eph.omegaDot * tk - OMEGA_E * eph.toe;
      const xg = x * Math.cos(om) - y * Math.cos(inc) * Math.sin(om);
      const yg = x * Math.sin(om) + y * Math.cos(inc) * Math.cos(om);
      const zg = y * Math.sin(inc);
      const f = -5 * Math.PI / 180, z = OMEGA_E * tk;
      const x1 = xg, y1 = Math.cos(f) * yg + Math.sin(f) * zg, z1 = -Math.sin(f) * yg + Math.cos(f) * zg;
      return [Math.cos(z) * x1 + Math.sin(z) * y1, -Math.sin(z) * x1 + Math.cos(z) * y1, z1];
    }
    const om = eph.omega0 + (eph.omegaDot - OMEGA_E) * tk - OMEGA_E * eph.toe;
    return [
      x * Math.cos(om) - y * Math.cos(inc) * Math.sin(om),
      x * Math.sin(om) + y * Math.cos(inc) * Math.cos(om),
      y * Math.sin(inc)
    ];
  }

  const api = { parseRinex, position, toRecord, fromRecord, FIELDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GnssOrbit = api;
})(this);
