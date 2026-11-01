// GNSS Atlas scenes: orbit shells, the census, how four satellites make a fix, orbits and ground tracks,
// the L-band map, and how geometry changes the error. Helpers come from scene-kit.js.
(() => {
  const { reduced, isEn, C, RED, arrow, scene } = window.GTScene;
  const SYS = [
    { id: 'GPS', zh: 'GPS', col: '#70b7ff', orb: { MEO: 32 } },
    { id: 'BDS', zh: '北斗', col: '#f6c775', orb: { MEO: 28, IGSO: 5, GEO: 4 } },
    { id: 'GAL', zh: 'Galileo', col: '#8affdd', orb: { MEO: 28 } },
    { id: 'GLO', zh: 'GLONASS', col: '#ff9d9d', orb: { MEO: 24 } },
    { id: 'QZS', zh: 'QZSS', col: '#bd9aff', orb: { QZO: 3, GEO: 2 } },
    { id: 'NAV', zh: 'NavIC', col: '#f0a6d8', orb: { IGSO: 2, GEO: 1 } },
  ];
  const ORB_SHADE = { MEO: 1, IGSO: 0.7, QZO: 0.7, GEO: 0.45 };

  // Tabs + play button shared by the interactive scenes: auto-advance while playing, a click pins a step.
  function stepper(rootSel, playId, count, dur) {
    const st = { i: 0, start: 0, now: 0, playing: !reduced.matches };
    const tabs = [...document.querySelectorAll(`${rootSel} [data-layer]`)], btn = document.getElementById(playId);
    const render = () => {
      tabs.forEach((b, k) => { b.setAttribute('aria-selected', String(k === st.i)); b.classList.toggle('is-done', k < st.i); });
      if (btn) { const en = isEn(); btn.textContent = en ? (st.playing ? 'Pause Ⅱ' : 'Play ▷') : (st.playing ? '暫停 Ⅱ' : '播放 ▷'); btn.setAttribute('aria-pressed', String(st.playing)); }
    };
    tabs.forEach((b, k) => b.addEventListener('click', () => { st.i = k; st.start = st.now; st.playing = false; render(); }));
    btn?.addEventListener('click', () => { st.playing = !st.playing; st.start = st.now; render(); });
    document.addEventListener('languagechange', () => setTimeout(render));
    st.tick = t => { st.now = t; if (st.playing && t - st.start > dur) { st.i = (st.i + 1) % count; st.start = t; render(); } return t - st.start; };
    render();
    return st;
  }

  // Hero: the three orbit shells to scale, with satellites of every system circling.
  scene('ga-hero-cv', (g, t) => {
    const { ctx, W, H, n } = g;
    const cx = W / 2, cy = H / 2, k = Math.min(W, H) / 2 / 43000;
    const eg = ctx.createRadialGradient(cx - 10, cy - 10, 4, cx, cy, 6378 * k);
    eg.addColorStop(0, '#2c74a8'); eg.addColorStop(1, '#0e2c4a');
    ctx.beginPath(); ctx.arc(cx, cy, 6378 * k, 0, Math.PI * 2); ctx.fillStyle = eg; ctx.fill();
    const shells = [[26560, 0.9, 'MEO'], [42164, 0.45, 'GEO / IGSO']];
    shells.forEach(([r, , lab]) => {
      ctx.beginPath(); ctx.ellipse(cx, cy, r * k, r * k * 0.36, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#2f5577'; ctx.lineWidth = 1; ctx.setLineDash([2, 5]); ctx.stroke(); ctx.setLineDash([]);
      g.txt(lab, cx + r * k * 0.72, cy - r * k * 0.36 * 0.72 - 10, { size: 11, color: C.dim, weight: 700, mono: true });
    });
    let s = 0;
    SYS.forEach(sys => Object.entries(sys.orb).forEach(([o, nSat]) => {
      const r = o === 'MEO' ? 26560 - (s % 3) * 900 : 42164, sp = o === 'MEO' ? 0.12 : 0.06;
      for (let i = 0; i < Math.min(nSat, 8); i++) {
        const a = t * sp * (o === 'GEO' ? 0.5 : 1) + i / Math.min(nSat, 8) * Math.PI * 2 + s * 0.7;
        const x = cx + Math.cos(a) * r * k, y = cy + Math.sin(a) * r * k * 0.36;
        if (Math.sin(a) < 0 && Math.hypot(x - cx, (y - cy) / 0.36 * 1) < 6378 * k * 1.02) continue;
        g.dot(x, y, 2.6, sys.col, 6);
      }
      s++;
    }));
  }, { w: 600, h: 440, nw: 400, nh: 320 });

  // 01: the census as stacked bars, one row per system, coloured by orbit type.
  scene('ga-census-cv', (g, t, en) => {
    const { ctx, W, H, n } = g;
    const x0 = n ? 92 : 150, x1 = W - (n ? 44 : 120), rh = n ? 46 : 38, top = n ? 64 : 58, grow = Math.min(1, t / 2.2);
    const X = v => x0 + (x1 - x0) * v / 40;
    g.txt(en ? 'Operating satellites by system and orbit' : '各系統運作中的衛星（依軌道）', 14, 24, { size: n ? 13 : 15, color: C.text, weight: 700 });
    // Legend.
    const leg = [['MEO', 1], ['IGSO / QZO', 0.7], ['GEO', 0.45]];
    leg.forEach(([lab, a], i) => {
      const lx = n ? 14 + i * 120 : W - 360 + i * 120, ly = n ? 44 : 24;
      ctx.globalAlpha = a; ctx.fillStyle = '#c9d6e4'; ctx.fillRect(lx, ly - 6, 14, 12); ctx.globalAlpha = 1;
      g.txt(lab, lx + 20, ly, { size: 11.5, color: C.dim, weight: 700, mono: true });
    });
    for (let v = 0; v <= 40; v += 10) { g.line(X(v), top - 14, X(v), top + SYS.length * rh - 10, '#1d3650', 1); g.txt(String(v), X(v), top + SYS.length * rh, { size: 11, color: C.dim, align: 'center', mono: true }); }
    SYS.forEach((sys, i) => {
      const y = top + i * rh;
      g.txt(en && sys.zh === '北斗' ? 'BeiDou' : sys.zh, 14, y + 6, { size: n ? 13 : 15, color: sys.col, weight: 700 });
      let acc = 0;
      const total = Object.values(sys.orb).reduce((a, b) => a + b, 0);
      ['MEO', 'IGSO', 'QZO', 'GEO'].forEach(o => {
        const v = sys.orb[o]; if (!v) return;
        const a = X(acc), b = X(acc + v * grow);
        ctx.globalAlpha = ORB_SHADE[o]; ctx.fillStyle = sys.col; ctx.fillRect(a, y - 8, Math.max(0, b - a - 1), 28); ctx.globalAlpha = 1;
        if (grow > 0.95 && (b - a) > 24) g.txt(String(v), (a + b) / 2, y + 6, { size: 12, color: '#061322', align: 'center', weight: 700, mono: true });
        acc += v * grow;
      });
      g.txt(String(Math.round(total * grow)), X(acc) + 10, y + 6, { size: n ? 13 : 15, color: C.text, weight: 700, mono: true });
    });
    if (grow > 0.98) g.txt(en ? 'Total 129 · MEO 112 · GEO 7 · IGSO 7 · QZO 3' : '合計 129 顆・MEO 112・GEO 7・IGSO 7・QZO 3', W - 14, H - 14, { size: n ? 11.5 : 13, color: C.acc, align: 'right', weight: 700 });
  }, { h: 330, nh: 400 });

  // 02: one satellite → a circle, two → two points, three with a clock error → circles miss, four → solved.
  const fixStep = stepper('.ga-fix-ctrl', 'ga-fix-play', 4, 5);
  scene('ga-fix-cv', (g, t, en) => {
    const { ctx, W, H, n } = g;
    const local = fixStep.tick(t), step = fixStep.i;
    const ox = W / 2, oy = n ? H / 2 + 40 : H / 2 + 34, sc = n ? 0.95 : 1.05;
    const rx = { x: ox + 10 * sc, y: oy + 18 * sc };
    const sats = [[-170, -95], [160, -105], [-20, -150], [190, 60]].map(([x, y]) => ({ x: ox + x * sc, y: oy + y * sc }));
    const nSat = Math.min(4, step + 1), bias = step === 2 ? 26 * sc : step === 3 ? 26 * sc * Math.max(0, 1 - local / 2) : 0;
    const grow = Math.min(1, local / 1.4);
    for (let i = 0; i < nSat; i++) {
      const s = sats[i], d = Math.hypot(rx.x - s.x, rx.y - s.y) + bias;
      ctx.beginPath(); ctx.arc(s.x, s.y, d * (i === nSat - 1 ? grow : 1), 0, Math.PI * 2);
      ctx.strokeStyle = ['#e9f1f9', '#d9bf8c', '#a5b8cb', '#c9a0ff'][i] + 'bb'; ctx.lineWidth = 1.6; ctx.stroke();
      g.sat(s.x, s.y, ['#e9f1f9', '#d9bf8c', '#a5b8cb', '#c9a0ff'][i]);
      g.txt(`${en ? 'sat' : '衛星'} ${i + 1}`, s.x, s.y - 18, { size: 12, color: C.text, align: 'center', weight: 700 });
    }
    if (step === 1 && grow > 0.95) {
      // Two circles meet at two points.
      const [a, b] = sats, ra = Math.hypot(rx.x - a.x, rx.y - a.y), rb = Math.hypot(rx.x - b.x, rx.y - b.y);
      const d = Math.hypot(b.x - a.x, b.y - a.y), l = (ra * ra - rb * rb + d * d) / (2 * d), h = Math.sqrt(Math.max(0, ra * ra - l * l));
      const mx = a.x + l * (b.x - a.x) / d, my = a.y + l * (b.y - a.y) / d;
      [[mx + h * (b.y - a.y) / d, my - h * (b.x - a.x) / d], [mx - h * (b.y - a.y) / d, my + h * (b.x - a.x) / d]].forEach(([x, y]) => g.dot(x, y, 6, '#fff', 12));
    }
    if (step === 2 && grow > 0.95) {
      ctx.beginPath(); ctx.arc(rx.x, rx.y, 30 * sc, 0, Math.PI * 2); ctx.strokeStyle = RED; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
      g.txt(en ? 'the circles do not meet: clock error' : '三個圓沒有交在同一點：時鐘誤差', rx.x + 38 * sc, rx.y + 40 * sc, { size: 13, color: RED, weight: 700 });
    }
    if (step === 3 && local > 2) {
      g.dot(rx.x, rx.y, 7, C.acc, 16);
      g.txt(en ? 'position + clock error solved' : '位置與時鐘誤差一起解出', rx.x + 14, rx.y + 26, { size: 13, color: C.acc, weight: 700 });
    }
    const msg = [en ? 'One distance: anywhere on this circle' : '一個距離：接收機可能在圓上任何一點',
                 en ? 'Two distances: narrowed to two points' : '兩個距離：縮小到兩個交點',
                 en ? 'Three distances, but the receiver clock is off' : '三個距離，但接收機的時鐘不準',
                 en ? 'A fourth satellite fixes the clock, and all circles meet' : '第四顆衛星解出時鐘誤差，所有圓交在一點'][step];
    g.txt(msg, 14, 24, { size: n ? 13 : 15, color: C.text, weight: 700 });
  }, { h: 400, nh: 480 });

  // 03: orbit heights to scale, and ground tracks from simple circular orbits (inclination, period, Earth rotation).
  scene('ga-orbit-cv', (g, t, en) => {
    const { ctx, W, H, n } = g;
    // Left: heights.
    const lx = n ? W / 2 : 170, ly = n ? 150 : H / 2 + 10, k = (n ? 120 : 140) / 42164;
    const eg = ctx.createRadialGradient(lx - 6, ly - 6, 3, lx, ly, 6378 * k);
    eg.addColorStop(0, '#2c74a8'); eg.addColorStop(1, '#0e2c4a');
    ctx.beginPath(); ctx.arc(lx, ly, 6378 * k, 0, Math.PI * 2); ctx.fillStyle = eg; ctx.fill();
    [[26560, 'MEO', C.gps, 0.5], [42164, 'GEO', C.bds, 0.25]].forEach(([r, lab, col, sp]) => {
      ctx.beginPath(); ctx.arc(lx, ly, r * k, 0, Math.PI * 2); ctx.strokeStyle = col + '66'; ctx.lineWidth = 1.2; ctx.stroke();
      const a = t * sp;
      g.sat(lx + Math.cos(a) * r * k, ly + Math.sin(a) * r * k, col);
      g.txt(`${lab} ${(r - 6378).toLocaleString('en-US')} km`, lx, ly - r * k - 10, { size: 11.5, color: col, align: 'center', weight: 700, mono: true });
    });
    // IGSO drawn as a tilted ring through the same radius.
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(-0.95);
    ctx.beginPath(); ctx.ellipse(0, 0, 42164 * k, 42164 * k * 0.3, 0, 0, Math.PI * 2); ctx.strokeStyle = C.pur + '77'; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    g.txt('IGSO', lx + 42164 * k * 0.55, ly + 42164 * k * 0.72, { size: 11.5, color: C.pur, weight: 700, mono: true });
    // Right: ground tracks on a lat/lon grid.
    const mx0 = n ? 14 : 360, mx1 = W - 14, my0 = n ? 320 : 40, my1 = n ? H - 30 : H - 30;
    const LON0 = 40, LON1 = 220, LAT = 70;
    const X = lon => mx0 + (mx1 - mx0) * (((lon - LON0) % 360 + 360) % 360) / (LON1 - LON0), Y = lat => my0 + (my1 - my0) * (LAT - lat) / (2 * LAT);
    ctx.strokeStyle = '#1d3650'; ctx.lineWidth = 1;
    for (let lo = 60; lo <= 200; lo += 30) { const x = X(lo); g.line(x, my0, x, my1, '#1d3650', 1); g.txt(`${lo}°E`, x, my1 + 12, { size: 10, color: C.dim, align: 'center', mono: true }); }
    for (let la = -60; la <= 60; la += 30) { const y = Y(la); g.line(mx0, y, mx1, y, la === 0 ? '#2f5577' : '#1d3650', 1); }
    g.txt(en ? 'equator' : '赤道', mx0 + 4, Y(0) - 8, { size: 10.5, color: C.dim });
    // Taiwan for reference.
    g.dot(X(121), Y(23.7), 4, '#fff'); g.txt(en ? 'Taiwan' : '台灣', X(121) + 7, Y(23.7) - 8, { size: 11, color: '#fff', weight: 700 });
    const WE = 360 / 86164;
    const track = (inc, period, lonAsc, phase, col, lab, hours) => {
      const pts = [];
      for (let s = 0; s <= hours * 3600; s += 300) {
        const u = (360 * s / period + phase) * Math.PI / 180, i = inc * Math.PI / 180;
        const lat = Math.asin(Math.sin(i) * Math.sin(u)) * 180 / Math.PI;
        const lon = lonAsc + Math.atan2(Math.cos(i) * Math.sin(u), Math.cos(u)) * 180 / Math.PI - WE * s;
        pts.push([lon, lat]);
      }
      ctx.beginPath(); let prev = null;
      pts.forEach(([lo, la]) => { const x = X(lo); if (prev !== null && Math.abs(x - prev) > (mx1 - mx0) / 2) ctx.moveTo(x, Y(la)); else if (prev === null) ctx.moveTo(x, Y(la)); else ctx.lineTo(x, Y(la)); prev = x; });
      ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
      return pts;
    };
    // IGSO: 55°, sidereal day → figure eight over 118°E. MEO: 55°, ~12.9 h (BeiDou MEO), shown over one day.
    const igso = track(55, 86164, 118, 0, C.pur, 'IGSO', 24);
    const meo = track(55, 46380, 150, 0, C.gps + 'aa', 'MEO', 24);
    const p = (t * 0.05) % 1;
    const pi = igso[Math.floor(p * (igso.length - 1))], pm = meo[Math.floor(p * (meo.length - 1))];
    g.dot(X(pi[0]), Y(pi[1]), 5, C.pur, 10); g.dot(X(pm[0]), Y(pm[1]), 5, C.gps, 10);
    g.dot(X(110.5), Y(0), 6, C.bds, 10);
    g.txt('GEO', X(110.5) + 8, Y(0) + 14, { size: 11.5, color: C.bds, weight: 700, mono: true });
    g.txt(en ? 'IGSO figure eight' : 'IGSO 8 字形', X(118) + 10, Y(48), { size: 11.5, color: C.pur, weight: 700 });
    g.txt(en ? 'MEO track (one day)' : 'MEO 一天的軌跡', mx1 - 4, my0 + 12, { size: 11.5, color: C.gps, align: 'right', weight: 700 });
  }, { h: 360, nh: 560 });

  // 04: the L-band map. Each row a system; blocks at official centre frequencies; dashed lines where systems share.
  const BANDS = [
    ['GPS', '#70b7ff', [['L5', 1176.45, 10.23], ['L2', 1227.6, 1.023], ['L1', 1575.42, 2.046]]],
    ['Galileo', '#8affdd', [['E5a', 1176.45, 10.23], ['E5b', 1207.14, 10.23], ['E6', 1278.75, 5.115], ['E1', 1575.42, 2.046]]],
    ['北斗 BeiDou', '#f6c775', [['B2a', 1176.45, 10.23], ['B2b', 1207.14, 10.23], ['B3I', 1268.52, 10.23], ['B1I', 1561.098, 2.046], ['B1C', 1575.42, 2.046]]],
    ['GLONASS', '#ff9d9d', [['G3', 1202.025, 10.23], ['G2', 1246, 4], ['G1', 1602, 4.5]]],
    ['QZSS', '#bd9aff', [['L5', 1176.45, 10.23], ['L2', 1227.6, 1.023], ['L6', 1278.75, 5.115], ['L1', 1575.42, 2.046]]],
    ['NavIC', '#f0a6d8', [['L5', 1176.45, 10.23], ['L1', 1575.42, 2.046]]],
  ];
  scene('ga-band-cv', (g, t, en) => {
    const { ctx, W, H, n } = g;
    const x0 = n ? 66 : 130, x1 = W - 14, F0 = 1160, F1 = 1615, top = n ? 50 : 46, rh = n ? 52 : 40;
    const X = f => x0 + (x1 - x0) * (f - F0) / (F1 - F0);
    for (let f = 1200; f <= 1600; f += 50) { g.line(X(f), top - 14, X(f), top + BANDS.length * rh, '#1d3650', 1); g.txt(String(f), X(f), top + BANDS.length * rh + 12, { size: n ? 9.5 : 11, color: C.dim, align: 'center', mono: true }); }
    g.txt('MHz', x1, top + BANDS.length * rh + 28, { size: 11, color: C.dim, align: 'right', mono: true });
    [[1575.42, 'L1 / E1 / B1C'], [1176.45, 'L5 / E5a / B2a']].forEach(([f, lab]) => {
      g.line(X(f), top - 20, X(f), top + BANDS.length * rh - 6, '#ffffffaa', 1.2, [4, 4]);
      g.txt(`${lab} · ${f}`, X(f) + (f > 1400 ? -6 : 6), top - 26, { size: n ? 10 : 12, color: '#fff', align: f > 1400 ? 'right' : 'left', weight: 700, mono: true });
    });
    const sweep = F0 + ((t * 40) % (F1 - F0 + 60));
    BANDS.forEach(([name, col, bs], i) => {
      const y = top + i * rh + rh / 2 - 6;
      g.txt(en ? name.replace('北斗 ', '') : name.replace(' BeiDou', ''), 12, y, { size: n ? 11.5 : 14, color: col, weight: 700 });
      g.line(x0, y, x1, y, '#1d3650', 1);
      bs.forEach(([lab, f, w]) => {
        const a = X(f - w), b = X(f + w), lit = Math.abs(sweep - f) < 12;
        ctx.fillStyle = col + (lit ? 'ee' : '99'); ctx.fillRect(a, y - 10, Math.max(3, b - a), 20);
        const lx = lab === 'B1I' ? a - 2 : lab === 'B1C' ? b + 2 : (a + b) / 2, al = lab === 'B1I' ? 'right' : lab === 'B1C' ? 'left' : 'center';
        if (!n || w > 3) g.txt(lab, lx, y - 18, { size: n ? 9.5 : 11, color: col, align: al, weight: 700, mono: true });
      });
    });
    // GeoTrust today.
    const gy = top + BANDS.length * rh + (n ? 44 : 40);
    g.txt(en ? 'GeoTrust generates today: GPS L1 C/A (1575.42) and BeiDou B1I (1561.098)' : 'GeoTrust 目前產生：GPS L1 C/A（1575.42）與北斗 B1I（1561.098）', 12, gy, { size: n ? 11 : 13, color: C.acc, weight: 700 });
    [1575.42, 1561.098].forEach(f => g.dot(X(f), gy, 5, C.acc, 10));
  }, { h: 340, nh: 440 });

  // 05: the same range error, two geometries. Shaded where every range band overlaps = where the fix can be.
  const dopStep = stepper('.ga-dop-ctrl', 'ga-dop-play', 2, 6);
  let dopCache = null;
  scene('ga-dop-cv', (g, t, en) => {
    const { ctx, W, H, n } = g;
    dopStep.tick(t);
    const spread = dopStep.i === 1;
    const ox = W / 2, oy = n ? H / 2 + 20 : H / 2 + 14, R = n ? 150 : 200, err = 9;
    const angles = spread ? [-160, -90, -20, 50] : [-110, -95, -80, -68];
    const sats = angles.map(a => ({ x: ox + Math.cos(a * Math.PI / 180) * R * 1.6, y: oy + Math.sin(a * Math.PI / 180) * R * 1.6 }));
    // Overlap region by sampling a grid (cached per geometry and size).
    const key = `${spread}-${W}-${H}`;
    if (!dopCache || dopCache.key !== key) {
      const pts = [];
      for (let y = oy - 120; y <= oy + 120; y += 2) for (let x = ox - 160; x <= ox + 160; x += 2) {
        if (sats.every(s => Math.abs(Math.hypot(x - s.x, y - s.y) - Math.hypot(ox - s.x, oy - s.y)) < err)) pts.push([x, y]);
      }
      dopCache = { key, pts };
    }
    sats.forEach((s, i) => {
      const d = Math.hypot(ox - s.x, oy - s.y), a0 = Math.atan2(oy - s.y, ox - s.x);
      ctx.beginPath(); ctx.arc(s.x, s.y, d + err, a0 - 0.32, a0 + 0.32); ctx.arc(s.x, s.y, d - err, a0 + 0.32, a0 - 0.32, true); ctx.closePath();
      ctx.fillStyle = '#c9d6e42a'; ctx.fill();          // any system: the colour is not a system here
      g.line(s.x, s.y, ox, oy, '#ffffff22', 1, [3, 5]);
      const sx = Math.max(16, Math.min(W - 16, s.x)), sy = Math.max(36, Math.min(H - 16, s.y));
      g.sat(sx, sy, '#c9d6e4');
    });
    ctx.fillStyle = '#8affdd'; dopCache.pts.forEach(([x, y]) => ctx.fillRect(x - 1, y - 1, 2, 2));
    g.dot(ox, oy, 3, '#fff');
    const area = dopCache.pts.length;
    g.txt(spread ? (en ? 'Spread out: small overlap, low DOP' : '衛星分散：重疊範圍小，DOP 低') : (en ? 'Bunched together: long overlap, high DOP' : '衛星集中：重疊範圍又長又大，DOP 高'),
      14, 24, { size: n ? 13 : 15, color: spread ? C.acc : C.bds, weight: 700 });
    g.txt(`${en ? 'possible area' : '可能範圍'} ≈ ${area} ${en ? 'cells' : '格'}`, W - 14, 24, { size: 12, color: C.dim, align: 'right', mono: true });
  }, { h: 380, nh: 460 });

  // ================= Part 2: the signal, and part 3: the receiver =================

  // Modulation: BPSK, QPSK and BOC(1,1) side by side: symbols → carrier phase → constellation → spectrum.
  const modStep = stepper('.ga-mod-ctrl', 'ga-mod-play', 3, 8);
  const SYM = [1, -1, -1, 1, 1, -1, 1, -1, -1, 1];
  scene('ga-mod-cv', (g, t, en) => {
    const { ctx, W, H, n } = g;
    modStep.tick(t);
    const m = modStep.i, x0 = n ? 14 : 20, x1 = n ? W - 14 : 500, span = x1 - x0, N = 8, sw = span / N;
    const shift = (t * 0.35) % 1;
    const sym = k => SYM[((k % SYM.length) + SYM.length) % SYM.length];
    const qpsk = k => [sym(2 * k), sym(2 * k + 1)];
    const names = [en ? 'BPSK: 1 bit per symbol, 2 phases' : 'BPSK：每個符號 1 位元、2 種相位', en ? 'QPSK: 2 bits per symbol, 4 phases' : 'QPSK：每個符號 2 位元、4 種相位', en ? 'BOC(1,1): BPSK × a square subcarrier' : 'BOC(1,1)：BPSK 再乘上方波副載波'];
    g.txt(names[m], x0, 20, { size: n ? 13 : 15, color: C.acc, weight: 700 });
    // Symbols row.
    const y1 = n ? 58 : 60, y2 = n ? 140 : 140;
    g.txt(en ? 'symbols' : '符號', x0, y1 - 26, { size: 11.5, color: C.dim, weight: 700 });
    for (let k = 0; k < N + 1; k++) {
      const x = x0 + (k - shift) * sw; if (x + sw < x0 || x > x1) continue;
      const kk = k + Math.floor(t * 0.35);
      const lab = m === 1 ? qpsk(kk).map(v => (v > 0 ? '0' : '1')).join('') : (sym(kk) > 0 ? '+1' : '−1');
      ctx.strokeStyle = '#2f5577'; ctx.strokeRect(Math.max(x0, x) + 1, y1 - 14, Math.min(sw, x1 - x) - 2, 28);
      if (x > x0 - 4 && x + sw < x1 + 4) g.txt(lab, x + sw / 2, y1, { size: 13, color: C.text, align: 'center', weight: 700, mono: true });
    }
    // Carrier with phase set by the current symbol.
    g.txt(en ? 'carrier' : '載波', x0, y2 - 40, { size: 11.5, color: C.dim, weight: 700 });
    ctx.beginPath();
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / sw + shift, k = Math.floor(u) + Math.floor(t * 0.35);
      let ph = 0;
      if (m === 0) ph = sym(k) > 0 ? 0 : Math.PI;
      else if (m === 1) { const [a, b] = qpsk(k); ph = Math.atan2(b, a); }
      else ph = sym(k) > 0 ? 0 : Math.PI;
      let v = Math.cos(2 * Math.PI * u * 3 + ph);
      if (m === 2) v *= (Math.floor(u * 4) % 2 ? -1 : 1);
      x === x0 ? ctx.moveTo(x, y2 - v * 24) : ctx.lineTo(x, y2 - v * 24);
    }
    ctx.strokeStyle = m === 2 ? C.pur : C.bds; ctx.lineWidth = 1.6; ctx.stroke();
    // Phase jumps.
    for (let k = 1; k <= N; k++) { const x = x0 + (k - shift) * sw; if (x > x0 && x < x1) g.line(x, y2 - 30, x, y2 + 30, '#ffffff33', 1, [2, 3]); }
    // Constellation.
    const cx = n ? W * 0.28 : 660, cy = n ? 268 : 100, cr = n ? 52 : 56;
    g.line(cx - cr - 10, cy, cx + cr + 10, cy, C.line, 1); g.line(cx, cy - cr - 10, cx, cy + cr + 10, C.line, 1);
    g.txt('I', cx + cr + 16, cy, { size: 12, color: C.dim, weight: 700, mono: true }); g.txt('Q', cx, cy - cr - 18, { size: 12, color: C.dim, align: 'center', weight: 700, mono: true });
    const pts = m === 1 ? [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => [a * 0.707, b * 0.707]) : [[1, 0], [-1, 0]];
    const curK = Math.floor(shift + Math.floor(t * 0.35));
    const curP = m === 1 ? (() => { const [a, b] = qpsk(curK); return [a * 0.707, b * 0.707]; })() : [sym(curK), 0];
    pts.forEach(([a, b]) => { const on = Math.abs(a - curP[0]) < 0.01 && Math.abs(b - curP[1]) < 0.01; g.dot(cx + a * cr, cy - b * cr, on ? 8 : 5, on ? '#fff' : C.acc, on ? 14 : 0); });
    g.txt(en ? 'constellation' : '星座圖', cx, cy + cr + 22, { size: 12, color: C.dim, align: 'center', weight: 700 });
    // Spectrum.
    const sx0 = n ? W * 0.52 : 560, sx1 = W - 16, sy = n ? 410 : 318, sh = n ? 70 : 72, R = 1;
    const sinc2 = u => Math.abs(u) < 1e-6 ? 1 : (Math.sin(Math.PI * u) / (Math.PI * u)) ** 2;
    const psd = f => m === 2 ? sinc2(f / R) * Math.tan(Math.PI * f / (2 * R)) ** 2 * 0.62 : sinc2(f / R);
    g.line(sx0, sy, sx1, sy, C.line, 1);
    ctx.beginPath();
    for (let x = sx0; x <= sx1; x++) { const f = ((x - sx0) / (sx1 - sx0) - 0.5) * 6; const v = Math.min(1.1, psd(f)); x === sx0 ? ctx.moveTo(x, sy - v * sh) : ctx.lineTo(x, sy - v * sh); }
    ctx.strokeStyle = C.acc; ctx.lineWidth = 1.8; ctx.stroke();
    g.txt(en ? 'spectrum' : '頻譜', sx0, sy - sh - 12, { size: 12, color: C.dim, weight: 700 });
    const note = [en ? 'one main lobe at the centre' : '中心一個主瓣', en ? 'same width, twice the bits' : '同樣頻寬，位元多一倍', en ? 'split in two, away from the centre' : '能量分到兩側，中心讓出來'][m];
    g.txt(note, sx1, sy - sh - 12, { size: 12, color: C.text, align: 'right', weight: 700 });
  }, { h: 340, nh: 440 });

  // Spreading and multiple access: data alone is narrow; the code spreads it under the noise. CDMA shares one frequency;
  // GLONASS's legacy FDMA gives each satellite its own channel.
  const spStep = stepper('.ga-sp-ctrl', 'ga-sp-play', 3, 8);
  scene('ga-sp-cv', (g, t, en) => {
    const { ctx, W, H, n } = g;
    const local = spStep.tick(t), m = spStep.i, grow = Math.min(1, local / 1.4);
    const x0 = 20, x1 = W - 20, base = H - 56, top = 54;
    const sinc2 = u => Math.abs(u) < 1e-6 ? 1 : (Math.sin(Math.PI * u) / (Math.PI * u)) ** 2;
    g.line(x0, base, x1, base, C.line, 1);
    const noiseY = base - (base - top) * 0.32;
    if (m < 2) {
      ctx.fillStyle = '#9fb4c814'; ctx.fillRect(x0, noiseY, x1 - x0, base - noiseY);
      g.txt(en ? 'thermal noise' : '熱雜訊', x1 - 6, noiseY - 10, { size: 12, color: '#9fb4c8', align: 'right', weight: 700 });
    }
    const curve = (fn, col, w = 2) => { ctx.beginPath(); for (let x = x0; x <= x1; x++) { const v = fn((x - x0) / (x1 - x0)); x === x0 ? ctx.moveTo(x, base - v * (base - top)) : ctx.lineTo(x, base - v * (base - top)); } ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
    if (m === 0) {
      // Before: a tall narrow line (50 bps). After: the same power spread over ~2 MHz, below the noise.
      const narrowH = 1 - grow * 0.9;
      curve(u => narrowH * sinc2((u - 0.5) * 90), C.pur, 2);
      curve(u => 0.2 * grow * sinc2((u - 0.5) * 3), C.acc, 2);
      g.txt(en ? 'data only: ~100 Hz wide' : '只有電文：寬約 100 Hz', W / 2 + 10, top + 6, { size: 13, color: C.pur, weight: 700 });
      g.txt(en ? 'after spreading: ~2 MHz wide, under the noise' : '展頻後：寬約 2 MHz，埋在雜訊下', W / 2, base - 26 - 0.2 * (base - top), { size: 13, color: C.acc, align: 'center', weight: 700 });
      g.txt(en ? 'spreading ratio 1.023 Mcps ÷ 50 bps ≈ 43 dB' : '展頻比：1.023 Mcps ÷ 50 bps ≈ 43 dB', 20, 24, { size: n ? 12.5 : 15, color: C.text, weight: 700 });
    } else if (m === 1) {
      ['#70b7ff', '#8affdd', '#f6c775', '#bd9aff'].forEach((col, i) => curve(u => (0.18 + i * 0.012) * sinc2((u - 0.5) * 3), col, 1.6));
      ['G05', 'G13', 'G21', 'G27'].forEach((id, i) => g.txt(id, W / 2 - 90 + i * 60, base - (base - top) * 0.36 - 14, { size: 12, color: ['#70b7ff', '#8affdd', '#f6c775', '#bd9aff'][i], align: 'center', weight: 700, mono: true }));
      g.txt(en ? 'CDMA: every GPS satellite on the same 1575.42 MHz, told apart by its code' : 'CDMA：所有 GPS 衛星都在同一個 1575.42 MHz，靠各自的碼區分', 20, 24, { size: n ? 12 : 15, color: C.text, weight: 700 });
    } else {
      const k0 = -7, k1 = 6, F = k => (k - k0 + 0.5) / (k1 - k0 + 1);
      for (let k = k0; k <= k1; k++) {
        const on = Math.floor(t * 1.2) % 14 === k - k0;
        curve(u => 0.75 * sinc2((u - F(k)) * 32), on ? '#ff9d9d' : '#ff9d9d66', on ? 2.4 : 1.2);
        if (!n || k % 2 === 0) g.txt(String(k), (x0 + (x1 - x0) * F(k)), base + 16, { size: 11, color: on ? '#fff' : C.dim, align: 'center', mono: true });
      }
      g.txt(en ? 'FDMA (GLONASS G1): channel k at 1602 + k × 0.5625 MHz, k = −7…+6' : 'FDMA（GLONASS G1）：頻道 k 在 1602 + k × 0.5625 MHz，k = −7…+6', 20, 24, { size: n ? 12 : 15, color: C.text, weight: 700 });
    }
  }, { h: 320, nh: 360 });

  // Gold codes: the real GPS C/A generator (G1, G2 shift registers) for PRN 13, and correlations computed from the real codes.
  const caCode = (s1, s2) => {
    const g1 = Array(10).fill(1), g2 = Array(10).fill(1), out = [];
    for (let i = 0; i < 1023; i++) {
      out.push(g1[9] ^ g2[s1 - 1] ^ g2[s2 - 1]);
      const f1 = g1[2] ^ g1[9], f2 = g2[1] ^ g2[2] ^ g2[5] ^ g2[7] ^ g2[8] ^ g2[9];
      g1.pop(); g1.unshift(f1); g2.pop(); g2.unshift(f2);
    }
    return out.map(b => (b ? -1 : 1));
  };
  const PRN13 = caCode(6, 7), PRN5 = caCode(1, 9);
  const corr = (a, b) => { const r = []; for (let s = 0; s < 1023; s++) { let v = 0; for (let i = 0; i < 1023; i++) v += a[i] * b[(i + s) % 1023]; r.push(v); } return r; };
  let AUTO = null, CROSS = null;
  scene('ga-gold-cv', (g, t, en) => {
    const { ctx, W, H, n } = g;
    if (!AUTO) { AUTO = corr(PRN13, PRN13); CROSS = corr(PRN13, PRN5); }
    // Registers, shown ticking: the states are recomputed from the start for the current chip index.
    const k = Math.floor(t * 4) % 1023;
    const g1 = Array(10).fill(1), g2 = Array(10).fill(1);
    for (let i = 0; i < k; i++) { const f1 = g1[2] ^ g1[9], f2 = g2[1] ^ g2[2] ^ g2[5] ^ g2[7] ^ g2[8] ^ g2[9]; g1.pop(); g1.unshift(f1); g2.pop(); g2.unshift(f2); }
    const cw = n ? 24 : 28, rx = n ? 14 : 20;
    [[g1, 'G1', en ? 'taps 3, 10' : '回授 3、10', 30], [g2, 'G2', en ? 'taps 2,3,6,8,9,10 · PRN 13 reads 6 ⊕ 7' : '回授 2,3,6,8,9,10・PRN 13 取 6 ⊕ 7', 96]].forEach(([reg, name, note, y]) => {
      g.txt(name, rx, y + cw / 2, { size: 13, color: C.gps, weight: 700, mono: true });
      reg.forEach((b, i) => {
        const x = rx + 30 + i * cw, hot = name === 'G2' && (i === 5 || i === 6);
        ctx.fillStyle = b ? '#8affdd2a' : '#0b1b2c'; ctx.fillRect(x, y, cw - 3, cw);
        ctx.strokeStyle = hot ? '#d9bf8c' : '#2f5577'; ctx.lineWidth = hot ? 2 : 1; ctx.strokeRect(x, y, cw - 3, cw);
        g.txt(String(b), x + (cw - 3) / 2, y + cw / 2, { size: 12, color: b ? C.acc : C.dim, align: 'center', weight: 700, mono: true });
      });
      g.txt(note, rx + 30, y + cw + 12, { size: 10.5, color: C.dim });
    });
    // Output chips.
    const oy = n ? 178 : 188, chipsShown = n ? 30 : 40;
    g.txt(en ? `PRN 13 output, chip ${k + 1} of 1023` : `PRN 13 輸出：第 ${k + 1}／1023 個碼片`, rx, oy - 18, { size: 12, color: C.text, weight: 700 });
    for (let i = 0; i < chipsShown; i++) {
      const idx = (k - chipsShown + 1 + i + 1023) % 1023, v = PRN13[idx];
      ctx.fillStyle = v > 0 ? C.acc : '#ff9d9d'; ctx.fillRect(rx + i * ((n ? W - 28 : 380) / chipsShown), oy - (v > 0 ? 10 : 0), (n ? W - 28 : 380) / chipsShown - 2, 10);
    }
    // Correlation plots: how strongly the received code matches a local copy, for every possible offset.
    // Same vertical scale in both, so the difference in size is real: 1023 when aligned, at most 65 otherwise.
    const px0 = n ? 44 : 476, px1 = W - 16, ph = n ? 74 : 86;
    const plots = n
      ? [[226, en ? '① PRN 13 vs its own copy' : '① PRN 13 對自己的複本', AUTO, C.acc], [326, en ? '② PRN 13 vs PRN 5' : '② PRN 13 對 PRN 5 的碼', CROSS, '#ff9d9d']]
      : [[40, en ? '① PRN 13 vs its own copy' : '① PRN 13 對自己的複本', AUTO, C.acc], [178, en ? '② PRN 13 vs PRN 5’s code' : '② PRN 13 對 PRN 5 的碼', CROSS, '#ff9d9d']];
    plots.forEach(([py, lab, data, col], k) => {
      const top = py + 14, by = top + ph, Y = v => by - (v / 1023) * ph, X = s => px0 + (px1 - px0) * ((s + 511) % 1023) / 1022;
      g.txt(lab, n ? 14 : px0 - 30, py, { size: 12.5, color: col, weight: 700 });
      // Axes: 1023 and 0 on the left, offsets along the bottom.
      g.line(px0, top, px0, by, C.line, 1); g.line(px0, by, px1, by, C.line, 1);
      g.line(px0, Y(1023), px1, Y(1023), '#ffffff14', 1, [3, 4]);
      g.txt('1023', px0 - 6, Y(1023), { size: 10, color: C.dim, align: 'right', mono: true });
      g.txt('0', px0 - 6, by, { size: 10, color: C.dim, align: 'right', mono: true });
      ctx.beginPath();
      data.forEach((v, s) => { const x = X(s), y = Y(Math.max(0, v)); s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.stroke();
      if (k === 0) {
        g.txt(en ? 'aligned → 1023' : '完全對齊 → 1023', X(0) + 8, Y(1023) + 12, { size: 11.5, color: C.acc, weight: 700 });
        g.txt(en ? 'off by one chip or more → 63 at most' : '錯開一個碼片以上 → 最多 63', px0 + 6, by + 12, { size: 11, color: C.dim });
      } else {
        const peak = Math.max(...data);
        g.txt(en ? `never aligns: at most ${peak} → no peak, no match` : `怎麼對都對不上：最多 ${peak} → 沒有尖峰`, px1, Y(1023) + 12, { size: 11.5, color: '#ff9d9d', align: 'right', weight: 700 });
      }
      if (k === 1 || n) g.txt(en ? 'offset between the two codes (chips) →' : '兩組碼錯開的碼片數 →', px1, by + 12, { size: 10.5, color: C.dim, align: 'right' });
    });
  }, { h: 300, nh: 400 });

  // The navigation message: an LNAV frame of five subframes, each ten 30-bit words, read out at 50 bps (sped up).
  scene('ga-msg-cv', (g, t, en) => {
    const { ctx, W, H, n } = g;
    const x0 = 20, x1 = W - 20, fw = x1 - x0, sec = (t * 3) % 30;
    const SUB = en ? ['clock & health', 'ephemeris I', 'ephemeris II', 'almanac, iono, UTC (page)', 'almanac (page)'] : ['時鐘修正與健康', '星曆（一）', '星曆（二）', '曆書、電離層、UTC（分頁）', '曆書（分頁）'];
    g.txt(en ? 'One frame = 1,500 bits = 30 s' : '一個主幀＝1,500 位元＝30 秒', x0, 22, { size: n ? 13 : 15, color: C.text, weight: 700 });
    const fy = 44, fh = n ? 46 : 40;
    for (let i = 0; i < 5; i++) {
      const a = x0 + fw * i / 5, on = Math.floor(sec / 6) === i;
      ctx.fillStyle = on ? '#8affdd22' : '#0b1b2c'; ctx.fillRect(a + 1, fy, fw / 5 - 2, fh);
      ctx.strokeStyle = on ? C.acc : '#2f5577'; ctx.lineWidth = 1; ctx.strokeRect(a + 1, fy, fw / 5 - 2, fh);
      g.txt(`${en ? 'SF' : '子幀'} ${i + 1}`, a + fw / 10, fy + 13, { size: 12, color: on ? '#fff' : C.text, align: 'center', weight: 700 });
      if (!n) g.txt(SUB[i], a + fw / 10, fy + 30, { size: 11, color: on ? C.acc : C.dim, align: 'center' });
    }
    g.line(x0 + fw * sec / 30, fy - 6, x0 + fw * sec / 30, fy + fh + 6, '#fff', 2);
    if (n) g.txt(SUB[Math.floor(sec / 6)], x0, fy + fh + 18, { size: 12, color: C.acc, weight: 700 });
    // Zoom: the current subframe, ten words.
    const zy = n ? 140 : 128, zh = n ? 40 : 44, s0 = Math.floor(sec / 6) * 6, ws = ((sec - s0) / 6) * 10;
    g.txt(en ? 'One subframe = 10 words × 30 bits = 6 s' : '一個子幀＝10 個字組 × 30 位元＝6 秒', x0, zy - 16, { size: 13, color: C.text, weight: 700 });
    for (let w = 0; w < 10; w++) {
      const a = x0 + fw * w / 10, on = Math.floor(ws) === w, lab = w === 0 ? 'TLM' : w === 1 ? 'HOW' : `W${w + 1}`;
      ctx.fillStyle = on ? '#d9bf8c26' : '#0b1b2c'; ctx.fillRect(a + 1, zy, fw / 10 - 2, zh);
      ctx.strokeStyle = on ? '#d9bf8c' : '#2f5577'; ctx.strokeRect(a + 1, zy, fw / 10 - 2, zh);
      g.txt(lab, a + fw / 20, zy + zh / 2, { size: n ? 10 : 12, color: on ? '#fff' : C.text, align: 'center', weight: 700, mono: true });
    }
    // Zoom: the current word, 24 data bits + 6 parity bits.
    const by = n ? 230 : 214, bw = fw / 30, word = Math.floor(ws);
    g.txt(word === 0 ? (en ? 'TLM: preamble 10001011 marks the start of every subframe' : 'TLM：前導碼 10001011，標出每個子幀的開頭') : word === 1 ? (en ? 'HOW: time of week, so the receiver knows the exact send time' : 'HOW：週內時間，讓接收機知道確切的發送時刻') : (en ? 'A word: 24 data bits + 6 parity bits' : '一個字組：24 個資料位元＋6 個同位位元'), x0, by - 16, { size: 13, color: C.text, weight: 700 });
    const PRE = [1, 0, 0, 0, 1, 0, 1, 1];
    for (let b = 0; b < 30; b++) {
      const a = x0 + b * bw, par = b >= 24, v = word === 0 && b < 8 ? PRE[b] : ((Math.sin((b + word * 31 + s0) * 12.9898) * 43758.5 % 1 + 1) % 1 > 0.5 ? 1 : 0);
      ctx.fillStyle = par ? '#bd9aff33' : word === 0 && b < 8 ? '#d9bf8c33' : '#0b1b2c'; ctx.fillRect(a + 1, by, bw - 2, 28);
      g.txt(String(v), a + bw / 2, by + 14, { size: n ? 9.5 : 12, color: par ? C.pur : C.text, align: 'center', mono: true });
    }
    g.txt(en ? 'parity' : '同位', x0 + 27 * bw, by + 42, { size: 11, color: C.pur, align: 'center', weight: 700 });
    g.txt(en ? 'Subframes 4–5 rotate through 25 pages: a full cycle takes 12.5 min. BeiDou D1 uses the same 300-bit, 6 s subframe.' : '子幀 4–5 有 25 頁輪流播出，完整一輪 12.5 分鐘。北斗 D1 同樣是 300 位元、6 秒一個子幀。', x0, H - 16, { size: n ? 10.5 : 12, color: C.dim });
  }, { h: 300, nh: 340 });

  // Link budget, in dB: the signal is far below the noise in the receiver's bandwidth, and comes out above it after
  // despreading and 1 ms of integration.
  scene('ga-link-cv', (g, t, en) => {
    const { ctx, W, H, n } = g;
    const lo = -180, hi = -100, top = 30, bot = H - 40, Y = d => top + (bot - top) * (hi - d) / (hi - lo);
    const ax = n ? 64 : 90;
    for (let d = hi; d >= lo; d -= 10) { g.line(ax - 6, Y(d), W - 20, Y(d), '#16304a', 1); g.txt(`${d}`, ax - 10, Y(d), { size: 11, color: C.dim, align: 'right', mono: true }); }
    g.txt('dBm', ax - 10, top - 14, { size: 11, color: C.dim, align: 'right', mono: true });
    const grow = Math.min(1, (t % 12) / 2), stage2 = (t % 12) > 6;
    const cols = n ? [ax + 30, ax + 150] : [ax + 60, ax + 330];
    // Before despreading: 2 MHz noise vs the signal.
    const bar = (x, d, col, lab, sub) => {
      const y = Y(d); ctx.fillStyle = col + '44'; ctx.fillRect(x, y, n ? 80 : 120, Y(lo) - y); ctx.fillStyle = col; ctx.fillRect(x, y, n ? 80 : 120, 3);
      g.txt(`${d.toFixed(1)}`, x + (n ? 40 : 60), y - 12, { size: 13, color: col, align: 'center', weight: 700, mono: true });
      g.txt(lab, x + (n ? 40 : 60), Y(lo) + 14, { size: 11.5, color: col, align: 'center', weight: 700 });
      if (sub && !n) g.txt(sub, x + 60, Y(lo) + 28, { size: 10.5, color: C.dim, align: 'center' });
    };
    const S = -128.5, N2 = -174 + 2 + 10 * Math.log10(2.046e6), N1 = -174 + 2 + 30;
    if (!stage2) {
      bar(cols[0], N2 * grow + hi * (1 - grow), '#9fb4c8', en ? 'noise in 2 MHz' : '2 MHz 內的雜訊', '−174 + NF 2 + 63.1');
      bar(cols[0] + (n ? 90 : 140), S, C.gps, en ? 'GPS signal' : 'GPS 訊號', en ? 'spec minimum' : '規格最低值');
      g.txt(en ? `signal is ${(N2 - S).toFixed(1)} dB below the noise` : `訊號比雜訊低 ${(N2 - S).toFixed(1)} dB`, W - 20, top + 6, { size: n ? 13 : 16, color: '#ff9d9d', align: 'right', weight: 700 });
    } else {
      bar(cols[0], N1, '#9fb4c8', en ? 'noise in 1 kHz' : '1 kHz 內的雜訊', en ? 'after 1 ms of integration' : '相關運算累積 1 ms 之後');
      bar(cols[0] + (n ? 90 : 140), S, C.acc, en ? 'GPS signal' : 'GPS 訊號', en ? 'unchanged' : '功率不變');
      g.txt(en ? `now ${(S - N1).toFixed(1)} dB above the noise` : `變成高出雜訊 ${(S - N1).toFixed(1)} dB`, W - 20, top + 6, { size: n ? 13 : 16, color: C.acc, align: 'right', weight: 700 });
    }
    g.txt(`C/N₀ = −128.5 − (−174 + 2) ≈ ${(S + 174 - 2).toFixed(1)} dB-Hz`, W - 20, top + (n ? 28 : 32), { size: n ? 11.5 : 13, color: C.text, align: 'right', mono: true });
  }, { h: 320, nh: 380 });

  // Inside a receiver: the signal path from antenna to position, one block lit at a time.
  const rxStep = stepper('.ga-rx-ctrl', 'ga-rx-play', 7, 5);
  const RX = [
    ['天線', 'Antenna', '右旋圓極化，收下 −130 dBm 等級的微弱訊號', 'Right-hand circular polarisation; picks up signals around −130 dBm'],
    ['LNA', 'LNA', '低雜訊放大器：先放大，雜訊指數決定整機靈敏度', 'Low-noise amplifier: amplifies first; its noise figure sets sensitivity'],
    ['降頻', 'Down-convert', '與本地振盪器混頻，從 1.5 GHz 降到中頻或基頻', 'Mixes with a local oscillator, from 1.5 GHz down to IF or baseband'],
    ['ADC', 'ADC', '取樣成數位 I/Q；GeoTrust 產生的就是這一層的資料', 'Samples into digital I/Q; this is the layer GeoTrust generates'],
    ['捕獲', 'Acquisition', '在碼相位 × 都卜勒中搜尋，找出看得到哪些衛星', 'Searches code phase × Doppler to find which satellites are there'],
    ['追蹤', 'Tracking', 'DLL 鎖住碼、PLL 鎖住載波，持續量出偽距與都卜勒', 'DLL locks the code, PLL the carrier, measuring range and Doppler'],
    ['定位', 'Position', '解出電文，以四顆以上衛星解出位置、速度與時間', 'Decodes the data and solves position, velocity and time from four or more'],
  ];
  scene('ga-rx-cv', (g, t, en) => {
    const { ctx, W, H, n } = g;
    rxStep.tick(t);
    const cur = rxStep.i, per = n ? 4 : 7, bw = n ? 82 : 94, gap = (W - 40 - per * bw) / (per - 1);
    RX.forEach((b, i) => {
      const row = n ? Math.floor(i / per) : 0, col = n ? i % per : i;
      const x = 20 + col * (bw + gap), y = (n ? 30 : 46) + row * 90, on = i === cur, done = i < cur;
      g.box(x, y, bw, 52, on ? C.acc : done ? '#4f8f86' : '#2f5577');
      if (on) { ctx.fillStyle = '#8affdd1f'; ctx.fillRect(x + 1, y + 1, bw - 2, 50); }
      g.txt(en ? b[1] : b[0], x + bw / 2, y + 26, { size: 13.5, color: on ? '#fff' : done ? '#a5d9cf' : C.text, align: 'center', weight: 700 });
      if (i < RX.length - 1 && (!n || col < per - 1)) arrow(g, x + bw + 2, y + 26, x + bw + gap - 2, y + 26, i < cur ? C.acc : '#2f5577');
      if (i === 3) g.txt(en ? 'digital from here →' : '以下為數位 →', x + bw / 2, y + 66, { size: 10.5, color: '#d9bf8c', align: 'center', weight: 700 });
    });
    // A pulse travelling along the chain.
    const p = (t * 0.8) % 1;
    if (!n) g.dot(20 + (W - 40) * p, 46 + 26, 4, '#fff', 10);
    const b = RX[cur];
    g.box(20, H - (n ? 92 : 96), W - 40, n ? 76 : 76, '#2f5577');
    g.txt(`${cur + 1}. ${en ? b[1] : b[0]}`, 36, H - (n ? 68 : 72), { size: 16, color: C.acc, weight: 700 });
    g.txt(en ? b[3] : b[2], 36, H - (n ? 40 : 42), { size: n ? 12 : 14, color: C.text });
  }, { h: 240, nh: 300 });

  // Acquisition: a search over code phase × Doppler; one cell lights up where G13 really is.
  scene('ga-acq-cv', (g, t, en) => {
    const { ctx, W, H, n } = g;
    const x0 = n ? 46 : 80, x1 = n ? W - 14 : 560, y0 = 34, y1 = H - 46, cols = 64, rows = 21;
    const cw = (x1 - x0) / cols, ch = (y1 - y0) / rows, PC = 40, PR = 13;
    const scan = (t * 140) % (cols * rows + 120), done = Math.min(cols * rows, scan);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const idx = r * cols + c; if (idx > done) continue;
      const d = Math.hypot((c - PC) / 1.2, r - PR), peak = Math.max(0, 1 - d / 1.6);
      const nz = (Math.sin(idx * 78.233) * 43758.5 % 1 + 1) % 1 * 0.22;
      const v = Math.min(1, peak + nz);
      ctx.fillStyle = `rgba(${Math.round(40 + 98 * v)},${Math.round(70 + 185 * v)},${Math.round(110 + 111 * v)},${0.25 + v * 0.75})`;
      ctx.fillRect(x0 + c * cw, y0 + r * ch, cw - 1, ch - 1);
    }
    g.txt(en ? 'code phase (0 – 1023 chips) →' : '碼相位（0 – 1023 碼片）→', (x0 + x1) / 2, y1 + 16, { size: 12, color: C.dim, align: 'center', weight: 700 });
    ctx.save(); ctx.translate(x0 - (n ? 30 : 40), (y0 + y1) / 2); ctx.rotate(-Math.PI / 2);
    g.txt(en ? 'Doppler −5 … +5 kHz' : '都卜勒 −5 … +5 kHz', 0, 0, { size: 12, color: C.dim, align: 'center', weight: 700 }); ctx.restore();
    g.txt(en ? 'Each cell: correlate 1 ms with G13’s code at that offset' : '每一格：用 G13 的碼、在該偏移下做 1 ms 相關', x0, 18, { size: n ? 11.5 : 13, color: C.text, weight: 700 });
    if (done >= cols * rows) {
      const px = x0 + (PC + 0.5) * cw, py = y0 + (PR + 0.5) * ch;
      ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      if (!n) {
        g.txt(en ? 'Found G13' : '找到 G13', 600, 120, { size: 18, color: C.acc, weight: 700 });
        g.txt(en ? `code phase ≈ ${Math.round(PC / cols * 1023)} chips` : `碼相位 ≈ ${Math.round(PC / cols * 1023)} 碼片`, 600, 152, { size: 13, color: C.text, mono: true });
        g.txt(en ? `Doppler ≈ +${(PR - 10) * 500} Hz` : `都卜勒 ≈ +${(PR - 10) * 500} Hz`, 600, 176, { size: 13, color: C.text, mono: true });
        g.txt(en ? 'then hand over to tracking' : '接著交給追蹤', 600, 206, { size: 12.5, color: C.dim });
      } else g.txt(en ? 'Found G13' : '找到 G13', x1, 18, { size: 13, color: C.acc, align: 'right', weight: 700 });
    } else if (!n) {
      g.txt(en ? `${cols} code bins shown` : `圖中 ${cols} 格碼相位`, 600, 112, { size: 12.5, color: C.dim });
      g.txt(en ? '(really 2,046, every half chip)' : '（實際 2,046 格，每半碼片一格）', 600, 134, { size: 12.5, color: C.dim });
      g.txt(en ? '21 Doppler bins, 500 Hz each' : '都卜勒 21 格，每格 500 Hz', 600, 162, { size: 12.5, color: C.dim });
    }
  }, { h: 300, nh: 320 });

  // Tracking: early, prompt and late correlators on the correlation triangle (DLL), and the prompt I/Q point held on
  // the I axis by a Costas loop, flipping sides with each data bit.
  scene('ga-track-cv', (g, t, en) => {
    const { ctx, W, H, n } = g;
    const lx0 = 20, lx1 = n ? W - 20 : 440, base = n ? 150 : H - 50, tp = 50, mid = (lx0 + lx1) / 2, half = (lx1 - lx0) * 0.32;
    const tri = x => Math.max(0, 1 - Math.abs(x - mid) / half);
    g.line(lx0, base, lx1, base, C.line, 1);
    ctx.beginPath(); for (let x = lx0; x <= lx1; x++) { const y = base - tri(x) * (base - tp); x === lx0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.strokeStyle = C.gps; ctx.lineWidth = 1.6; ctx.stroke();
    const err = Math.sin(t * 0.9) * half * 0.35 * Math.max(0.15, Math.abs(Math.cos(t * 0.3))), P = mid + err, sp = half * 0.5;
    [['E', P - sp, '#f6c775'], ['P', P, '#fff'], ['L', P + sp, '#bd9aff']].forEach(([lab, x, col]) => {
      const y = base - tri(x) * (base - tp);
      g.line(x, base, x, y, col, 2); g.dot(x, y, 5, col, 8);
      g.txt(lab, x, base + 14, { size: 12, color: col, align: 'center', weight: 700, mono: true });
    });
    const dE = tri(P - sp), dL = tri(P + sp);
    g.txt(en ? 'DLL: keep Early = Late' : 'DLL：讓 Early 和 Late 一樣高', lx0, 24, { size: 14, color: C.text, weight: 700 });
    g.txt(`E − L = ${(dE - dL).toFixed(2)} ${Math.abs(dE - dL) < 0.05 ? (en ? '→ centred' : '→ 對準') : (dE > dL ? (en ? '→ move earlier' : '→ 往前調') : (en ? '→ move later' : '→ 往後調'))}`, lx1, 24, { size: 12, color: C.dim, align: 'right', mono: true });
    // Prompt I/Q.
    const qx = n ? W / 2 : 640, qy = n ? 270 : H / 2 + 6, qr = n ? 62 : 80;
    g.line(qx - qr, qy, qx + qr, qy, C.line, 1); g.line(qx, qy - qr, qx, qy + qr, C.line, 1);
    g.txt('I', qx + qr + 8, qy, { size: 12, color: C.dim, weight: 700, mono: true }); g.txt('Q', qx, qy - qr - 10, { size: 12, color: C.dim, align: 'center', weight: 700, mono: true });
    const bit = Math.floor(t * 0.8) % 2 ? -1 : 1, jit = Math.sin(t * 5) * 0.06;
    for (let i = 0; i < 26; i++) { const r = (Math.sin(i * 12.9 + Math.floor(t * 6)) * 43758.5 % 1); g.dot(qx + (bit * 0.8 + r * 0.12) * qr, qy - (jit + (r - 0.5) * 0.14) * qr, 2, C.acc + '99'); }
    g.dot(qx + bit * 0.8 * qr, qy - jit * qr, 6, '#fff', 12);
    g.txt(en ? 'PLL (Costas): prompt held on the I axis' : 'PLL（Costas）：Prompt 點穩在 I 軸上', qx, qy + qr + 18, { size: 12.5, color: C.text, align: 'center', weight: 700 });
    g.txt(en ? 'left / right = data bit −1 / +1' : '左右兩側＝電文 −1／+1', qx, qy + qr + 36, { size: 11.5, color: C.dim, align: 'center' });
  }, { h: 300, nh: 400 });

  // Reveal on scroll, as on the project page.
  document.documentElement.classList.add('po-js');
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  document.querySelectorAll('.ga-sys, .ga-src').forEach(el => io.observe(el));
})();
