// The project page's running example, derived from whatever ephemeris data/latest.json points to.
// At about noon Taiwan time (04:00 GPST), or the covered hour nearest it when the file covers only part of
// the day, it picks the rising GPS satellite closest to 45° above NKUST and a
// rising BeiDou MEO satellite, computes their real elevation, range and travel time, then rewrites the
// example text (written for 2026-09-22) to match. Animations read the same values from window.GT_EPH.
(() => {
  if (!window.GnssOrbit) return;
  const RE = 6378137, C = 299792458, D = Math.PI / 180;
  const LAT = 22.75843215402263 * D, LON = 120.33823886027615 * D, NOON = 4 * 3600, HOURS4 = 4 * 3600;
  let T = NOON, SPAN = HOURS4;
  const up = [Math.cos(LAT) * Math.cos(LON), Math.cos(LAT) * Math.sin(LON), Math.sin(LAT)];
  const SITE = up.map(v => v * RE);
  const look = p => {
    const d = p.map((v, i) => v - SITE[i]), n = Math.hypot(...d);
    return { el: Math.asin(d.reduce((a, v, i) => a + v * up[i], 0) / n) / D, range: n };
  };
  const at = (sys, prn, list, t) => {
    let best = list[0];
    for (const r of list) if (Math.abs(t - r[0]) < Math.abs(t - best[0])) best = r;
    return GnssOrbit.position(GnssOrbit.fromRecord(sys, prn, best.slice(1)), t - best[0]);
  };
  // Every visible satellite of one system at T, rising ones only.
  function candidates(data, sys, kinds) {
    return Object.entries(data.sats).filter(([id]) => id[0] === sys).map(([id, list]) => {
      const prn = +id.slice(1), eph = GnssOrbit.fromRecord(sys, prn, list[0].slice(1));
      if (kinds && !kinds.includes(eph.kind)) return null;
      const now = look(at(sys, prn, list, T)), later = look(at(sys, prn, list, T + 60));
      return later.el > now.el && now.el > 15 ? { id, ...now } : null;
    }).filter(Boolean);
  }
  // Resolved from this script's own address, so pages at any depth find the same data folder.
  const base = new URL('data/', document.currentScript?.src || location.href).href;
  GnssOrbit.latest(base).then(data => {
    // The example's moment: noon in Taiwan if the file covers it, otherwise the nearest covered time, with
    // up to four hours around it for the animations.
    const sp = GnssOrbit.span(data);
    SPAN = Math.min(HOURS4, sp.len);
    T = Math.round(Math.min(Math.max(NOON, sp.from + SPAN / 2), sp.to - SPAN / 2) / 60) * 60;
    const g = candidates(data, 'G').sort((a, b) => Math.abs(a.el - 45) - Math.abs(b.el - 45))[0];
    const c = candidates(data, 'C', ['MEO']).sort((a, b) => Math.abs(a.el - 60) - Math.abs(b.el - 60))[0];
    if (!g || !c) return;
    const [y, mo, d] = data.date.split('-').map(Number);
    const days = (Date.UTC(y, mo - 1, d) - Date.UTC(1980, 0, 6)) / 86400000;
    const eph = {
      date: data.date, gpsWeek: Math.floor(days / 7), bdsWeek: Math.floor(days / 7) - 1356, sow: (days % 7) * 86400 + T,
      prn: g.id, el: g.el, km: Math.round(g.range / 1000), ms: g.range / C * 1000,
      bds: c.id, bdsMs: c.range / C * 1000,
      t: T, span: SPAN,
    };
    window.GT_EPH = eph;
    window.GT_DATA = data;   // the whole day, for the orbit chapter
    // Rewrite the example wherever it appears: text, both language attributes and labels.
    const swaps = [
      ['2026-09-22', eph.date], ['45.2°', eph.el.toFixed(1) + '°'],
      ['約 45°', `約 ${Math.round(eph.el)}°`], ['about 45°', `about ${Math.round(eph.el)}°`],
      ['21,641 km', eph.km.toLocaleString('en-US') + ' km'], ['72.2 ms', eph.ms.toFixed(1) + ' ms'],
    ];
    // The text says "noon" and "four hours around noon"; a file without noon gets the actual times.
    if (T !== NOON || SPAN !== HOURS4) {
      const hm = s => { s = ((s % 86400) + 86400) % 86400; return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}`; };
      const tw = s => hm(s + 8 * 3600), at = tw(T), a = tw(T - SPAN / 2), b = tw(T + SPAN / 2);
      swaps.unshift(
        ['04:00 GPS 時間（台灣約中午 12:00）', `${hm(T)} GPS 時間（台灣約 ${at}）`],
        ['04:00 GPS time (about noon in Taiwan)', `${hm(T)} GPS time (about ${at} in Taiwan)`],
        ['台灣中午前後 4 小時', `台灣時間 ${a}–${b}`], ['台灣時間中午', `台灣時間 ${at}`],
        ['over four hours around noon Taiwan time', `from ${a} to ${b} Taiwan time`],
        ['four hours around noon in Taiwan', `${a}–${b} Taiwan time`],
        ['Around noon Taiwan time', `Around ${at} Taiwan time`], ['around noon Taiwan time', `around ${at} Taiwan time`],
      );
    }
    const fix = s => swaps.reduce((t, [a, b]) => t.split(a).join(b), s);
    document.querySelectorAll('main [data-zh], main [data-en], main [aria-label]').forEach(el => {
      ['data-zh', 'data-en', 'aria-label'].forEach(a => { const v = el.getAttribute(a); if (v && fix(v) !== v) el.setAttribute(a, fix(v)); });
    });
    const walk = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) { const raw = n.nodeValue.replace(/\u200b/g, ''); const v = fix(raw); if (v !== raw) n.nodeValue = v; }
    if (window.gtPhrase) window.gtPhrase(document.querySelector('main'));
    document.dispatchEvent(new CustomEvent('gt-eph', { detail: eph }));
  }).catch(() => {});
})();
