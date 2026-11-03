// Project overview hero: the real Earth (Natural Earth borders) seen from above the western Pacific, with the
// GPS and BeiDou satellites that NKUST can actually see, computed from the current broadcast ephemerides
// (data/latest.json).
// The Earth is drawn once; only the satellite layer is redrawn, a few times per second, while on screen.
(() => {
  const canvas = document.getElementById('po-hero-cv');
  if (!canvas || !window.d3 || !window.topojson || !window.GnssOrbit) return;
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json';
  const RE = 6378137, K = 0.231, D2R = Math.PI / 180;
  const LAT0 = 22.75843215402263, LON0 = 120.33823886027615; // NKUST
  const VIEW_LAT = -14, VIEW_LON = 124;                         // NKUST sits near the upper limb
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const enu = (la, lo) => {
    la *= D2R; lo *= D2R;
    return {
      east: [-Math.sin(lo), Math.cos(lo), 0],
      north: [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)],
      up: [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)],
    };
  };
  const view = enu(VIEW_LAT, VIEW_LON), site = enu(LAT0, LON0);
  const SITE = site.up.map(v => v * RE);
  let W = 0, H = 0, dpr = 1, R = 0, cx = 0, cy = 0, earth = null, world = null, sats = [], visible = true, t0 = 0;

  function layout() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    R = Math.min(W * 0.46, H * 0.56); cx = W / 2; cy = H + R * 0.18;
  }
  function project(p) {
    const r = Math.hypot(p[0], p[1], p[2]), u = p.map(v => v / r), s = R * (1 + (r / RE - 1) * K);
    return { x: cx + dot(u, view.east) * s, y: cy - dot(u, view.north) * s, front: dot(u, view.up) >= 0 };
  }
  // The Earth layer: ocean, land, coastlines, graticule, atmosphere — painted once per size.
  function paintEarth() {
    earth = document.createElement('canvas');
    earth.width = canvas.width; earth.height = canvas.height;
    const e = earth.getContext('2d');
    e.setTransform(dpr, 0, 0, dpr, 0, 0);
    const proj = d3.geoOrthographic().rotate([-VIEW_LON, -VIEW_LAT]).scale(R).translate([cx, cy]).clipAngle(90);
    const path = d3.geoPath(proj, e);
    const atm = e.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.12);
    atm.addColorStop(0, 'rgba(110,180,255,.35)'); atm.addColorStop(1, 'rgba(110,180,255,0)');
    e.fillStyle = atm; e.beginPath(); e.arc(cx, cy, R * 1.12, 0, Math.PI * 2); e.fill();
    const ocean = e.createRadialGradient(cx - R * 0.3, cy - R * 0.5, R * 0.1, cx, cy, R);
    ocean.addColorStop(0, '#1b5a93'); ocean.addColorStop(0.6, '#0d3460'); ocean.addColorStop(1, '#061a33');
    e.fillStyle = ocean; e.beginPath(); path({ type: 'Sphere' }); e.fill();
    e.strokeStyle = 'rgba(160,200,255,.08)'; e.lineWidth = 0.6; e.beginPath(); path(d3.geoGraticule10()); e.stroke();
    if (world) {
      e.fillStyle = '#2e5a43'; e.beginPath(); path(world.land); e.fill();
      e.strokeStyle = 'rgba(190,230,210,.35)'; e.lineWidth = 0.6; e.beginPath(); path(world.coast); e.stroke();
      e.strokeStyle = 'rgba(190,230,210,.18)'; e.beginPath(); path(world.borders); e.stroke();
      e.fillStyle = '#4a8f68'; e.beginPath(); path(world.taiwan); e.fill();
    }
    // Shade toward the limb for depth.
    const shade = e.createRadialGradient(cx - R * 0.25, cy - R * 0.55, R * 0.2, cx, cy, R);
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,8,20,.55)');
    e.fillStyle = shade; e.beginPath(); path({ type: 'Sphere' }); e.fill();
  }
  function lookEl(p) {
    const d = [p[0] - SITE[0], p[1] - SITE[1], p[2] - SITE[2]];
    return Math.asin(dot(d, site.up) / Math.hypot(d[0], d[1], d[2])) / D2R;
  }
  function positionAt(s, t) {
    let best = s.recs[0];
    for (const r of s.recs) if (Math.abs(t - r.rel) < Math.abs(t - best.rel)) best = r;
    return GnssOrbit.position(best.eph, t - best.rel);
  }
  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (earth && earth.width && earth.height) ctx.drawImage(earth, 0, 0, W, H);
    const nk = project(SITE);
    // Real satellites above NKUST now (simulated clock runs 120× on the ephemeris day).
    const t = (t0 + (reduced ? 0 : (now / 1000) * 120)) % 86400;
    const seen = sats.map(s => {
      const p = positionAt(s, t);
      return { s, p, el: lookEl(p), q: project(p) };
    }).filter(o => o.el > 12 && o.q.y > 14 && o.q.x > 14 && o.q.x < W - 14).sort((a, b) => b.el - a.el).slice(0, 9);
    seen.forEach(({ s, q }, i) => {
      const col = s.sys === 'G' ? '#70b7ff' : '#f6c775';
      ctx.setLineDash([3, 5]); ctx.lineDashOffset = -(now / 60) % 8;
      ctx.strokeStyle = col + '88'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(nk.x, nk.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.fillRect(q.x - 5, q.y - 3.5, 10, 7);
      ctx.globalAlpha = 0.75; ctx.fillRect(q.x - 15, q.y - 2, 8, 4); ctx.fillRect(q.x + 7, q.y - 2, 8, 4); ctx.globalAlpha = 1;
      ctx.fillStyle = '#e6eef8'; ctx.font = "600 10px 'JetBrains Mono',Consolas,monospace"; ctx.textAlign = 'center';
      ctx.fillText(s.prn, q.x, q.y - 9);
    });
    // NKUST receiver.
    const pulse = reduced ? 0 : (now / 1400) % 1;
    ctx.strokeStyle = `rgba(138,255,221,${1 - pulse})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(nk.x, nk.y, 6 + pulse * 18, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#8affdd'; ctx.beginPath(); ctx.arc(nk.x, nk.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = "700 11px 'Noto Sans TC',sans-serif"; ctx.textAlign = 'left'; ctx.fillStyle = '#e6fff8';
    ctx.fillText('NKUST', nk.x + 9, nk.y + 4);
    if (sats.length) {
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(200,220,240,.75)'; ctx.font = "600 10px Orbitron,sans-serif";
      const g = seen.filter(o => o.s.sys === 'G').length, c = seen.length - g;
      ctx.fillText(`${day} · GPS ${g} · BDS ${c}`, W - 6, H - 8);
    }
  }
  let last = 0;
  function frame(now) {
    if (visible && !document.hidden && now - last > 120) { last = now; draw(now); }
    requestAnimationFrame(frame);
  }
  new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(canvas);
  new ResizeObserver(() => { layout(); paintEarth(); draw(performance.now()); }).observe(canvas);
  layout(); paintEarth();
  fetch(WORLD_URL).then(r => r.json()).then(topo => {
    const obj = topo.objects.countries;
    world = {
      land: topojson.merge(topo, obj.geometries),
      coast: topojson.mesh(topo, obj, (a, b) => a === b),
      borders: topojson.mesh(topo, obj, (a, b) => a !== b),
      taiwan: topojson.feature(topo, { type: 'GeometryCollection', geometries: obj.geometries.filter(g => g.id === '158') }),
    };
    paintEarth();
  }).catch(() => {});
  let day = '';
  fetch('../data/latest.json').then(r => r.json()).then(m => fetch('../data/' + m.file)).then(r => r.json()).then(data => {
    day = data.date;
    sats = Object.entries(data.sats).map(([prn, list]) => {
      const sys = prn[0], prnNum = Number(prn.slice(1));
      return { prn, sys, recs: list.map(([rel, ...values]) => ({ rel, eph: GnssOrbit.fromRecord(sys, prnNum, values) })) };
    }).filter(s => s.recs[0].eph.kind !== 'GEO');   // the platform's BeiDou signals cover MEO and IGSO
    // Start at the time of day it is now, on the ephemeris day.
    const d = new Date();
    t0 = (d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds() + 18) % 86400;
  }).catch(() => {});
  requestAnimationFrame(frame);
})();
