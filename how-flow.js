// Homepage "HOW": five-step signal pipeline. A canvas stage draws one scene per step;
// the step list beside it drives the tour (auto-advance, click to pin, play/pause).
(() => {
  const root = document.getElementById('how-flow');
  if (!root) return;
  const canvas = root.querySelector('.hf-canvas');
  const ctx = canvas.getContext('2d');
  const steps = [...root.querySelectorAll('.hf-step')];
  const playBtn = root.querySelector('.hf-play');
  const navBtns = [...root.querySelectorAll('.hf-nav')];
  const count = root.querySelector('.hf-count');
  const timer = root.querySelector('.hf-timer i');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const isEn = () => document.documentElement.lang === 'en';
  // Each step holds until its last beat has been on screen for several seconds.
  const BEAT = [0, 4, 8.5, 13.5, 18.5, 23.5];   // beats past index 2 are used only by step 04
  const STEP_S = [15, 14, 15, 30, 15];
  const C = { grid: '#17304a', text: '#dbe8f6', dim: '#7f9bb8', gps: '#70b7ff', bds: '#f6c775', acc: '#8affdd', pur: '#bd9aff', earth: '#123a5c' };

  let step = 0, playing = false, visible = false, t = 0, T = 0, last = 0;
  let W = 800, H = 500, scale = 1, dpr = 1;

  // ---------- drawing helpers (virtual W×H space) ----------
  const fs = () => narrow() ? 1.15 : 1.2;
  function txt(s, x, y, { size = 15, color = C.text, align = 'left', weight = 500, mono = false } = {}) {
    size *= fs();
    ctx.font = `${weight} ${size}px ${mono ? "'JetBrains Mono',Consolas,monospace" : "'Noto Sans TC',sans-serif"}`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function box(x, y, w, h, stroke, fill = '#0b1b2c', r = 10) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke();
  }
  function line(x1, y1, x2, y2, color, width = 1.5, dash = []) {
    ctx.beginPath(); ctx.setLineDash(dash); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.setLineDash([]);
  }
  function dot(x, y, r, color, glow = 0) {
    ctx.shadowColor = color; ctx.shadowBlur = glow;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.shadowBlur = 0;
  }
  function sat(x, y, color, s = 1) {
    ctx.fillStyle = color;
    ctx.fillRect(x - 6 * s, y - 5 * s, 12 * s, 10 * s);
    ctx.globalAlpha *= 0.75;
    ctx.fillRect(x - 22 * s, y - 3 * s, 13 * s, 6 * s); ctx.fillRect(x + 9 * s, y - 3 * s, 13 * s, 6 * s);
    ctx.globalAlpha /= 0.75;
  }
  // Stable pseudo-random ±1 sequences for data bits and code chips.
  const bit = (seed, n) => (Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453 % 1 + 1) % 1 > 0.5 ? 1 : -1;
  function trace(x0, x1, yMid, amp, f, color, width = 2) {
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 1.5) { const y = yMid - f(x) * amp; x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  const ease = k => 1 - Math.pow(1 - Math.min(Math.max(k, 0), 1), 3);
  const narrow = () => W < 700;

  // ---------- Shared: three beats per scene, with a caption box that explains each beat ----------
  // Beat 0 picks up from the previous step, beat 2 hands off to the next one.
  const beatOf = () => t < BEAT[1] ? 0 : t < BEAT[2] ? 1 : 2;
  const revealAt = k => ease((t - BEAT[k]) / 0.6);
  const areaH = () => narrow() ? H * 0.68 : H * 0.74;
  function caption(beat, caps, next, tag = '') {
    const n = narrow();
    const cx = n ? 16 : 20, cw = W - cx * 2, cy = areaH(), ch = H - cy - (n ? 10 : 12);
    box(cx, cy, cw, ch, '#2f5577');
    caps.forEach((_, i) => dot(cx + 18 + i * 14, cy + 18, 4, i <= beat ? C.acc : '#2b4a66'));
    if (tag) txt(tag, cx + cw - 14, cy + 18, { size: 11, color: C.dim, align: 'right', mono: true });
    const y = wrapText(caps[beat], cx + 16, cy + 42, cw - 32, n ? 19 : 22, { size: n ? 13 : 15, color: C.text });
    if (beat === caps.length - 1 && next) {
      ctx.save(); ctx.globalAlpha *= revealAt(beat);
      txt(next, cx + 16, Math.min(y + (n ? 23 : 28), cy + ch - 14), { size: n ? 12 : 14, color: C.acc, weight: 700 });
      ctx.restore();
    }
  }
  const dimIf = (off, fn) => { ctx.save(); if (off) ctx.globalAlpha *= 0.3; fn(); ctx.restore(); };

  // ---------- 01 Ephemeris: where is each satellite? read it from the broadcast ephemeris ----------
  function sceneEphemeris() {
    const n = narrow(), en = isEn(), beat = beatOf(), AH = areaH();
    // Beat 0 is just the sky; the ephemeris card arrives with beat 1 (on desktop the Earth slides left to make room).
    const slide = beat >= 1 ? ease((t - BEAT[1]) / 0.7) : 0;
    const ex = n ? W * 0.5 : W * (0.5 - 0.25 * slide), ey = n ? AH * 0.3 : AH * 0.5, er = n ? 40 : 58;
    const g = ctx.createRadialGradient(ex - er * 0.3, ey - er * 0.3, 4, ex, ey, er);
    g.addColorStop(0, '#2c74a8'); g.addColorStop(1, C.earth);
    const orbits = [{ rx: er * 2.9, ry: er * 1.1, rot: -0.35, c: C.gps, k: [0, 2.1, 4.2] }, { rx: er * 2.6, ry: er * 1.3, rot: 0.45, c: C.bds, k: [1, 3.1, 5.2] }];
    const pos = (o, a) => {
      const x = Math.cos(a) * o.rx, y = Math.sin(a) * o.ry;
      return [ex + x * Math.cos(o.rot) - y * Math.sin(o.rot), ey + x * Math.sin(o.rot) + y * Math.cos(o.rot), Math.sin(a)];
    };
    // Back halves of orbits, Earth, then front halves so satellites pass behind the planet.
    const drawOrbit = (o, front) => {
      ctx.beginPath();
      for (let a = front ? 0 : Math.PI; a <= (front ? Math.PI : Math.PI * 2) + 0.01; a += 0.05) { const [x, y] = pos(o, a); a === (front ? 0 : Math.PI) ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.strokeStyle = o.c + (front ? '88' : '33'); ctx.lineWidth = 1.2; ctx.stroke();
    };
    const sats = [];
    orbits.forEach(o => o.k.forEach(k => { const [x, y, z] = pos(o, T * 0.35 + k); sats.push({ x, y, z, c: o.c }); }));
    orbits.forEach(o => drawOrbit(o, false));
    sats.filter(s => s.z < 0).forEach(s => sat(s.x, s.y, s.c, 0.7));
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#3d7fb0'; ctx.lineWidth = 1; ctx.stroke();
    orbits.forEach(o => drawOrbit(o, true));
    sats.filter(s => s.z >= 0).forEach(s => sat(s.x, s.y, s.c, 0.8));
    txt(en ? '● GPS' : '● GPS', ex - er * 2.6, ey + er * 1.9, { size: 12, color: C.gps, weight: 700 });
    txt(en ? '● BeiDou' : '● 北斗', ex - er * 2.6 + 64, ey + er * 1.9, { size: 12, color: C.bds, weight: 700 });

    // From beat 1 on, follow one satellite: G05.
    const h = sats[0];
    if (beat >= 1) {
      ctx.strokeStyle = C.acc; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h.x, h.y, 16 + Math.sin(T * 4) * 2, 0, Math.PI * 2); ctx.stroke();
      txt('G05', h.x + 20, h.y - 16, { size: 12, color: C.acc, weight: 700, mono: true });
    }

    // Ephemeris card.
    const cx = n ? 16 : W * 0.53, cw = n ? W - 32 : W * 0.44;
    const cy = n ? AH * 0.6 : 18, ch = n ? AH * 0.4 - 6 : AH - 32;
    if (beat >= 1) {
      ctx.save(); ctx.globalAlpha *= revealAt(1);
      box(cx, cy, cw, ch, '#3b6d96');
      if (beat === 2) {
        // The computation itself: orbit position from Kepler's equation, clock offset from a polynomial.
        const k = revealAt(2);
        ctx.save(); ctx.globalAlpha *= k;
        txt(en ? 'Orbit equations · IS-GPS-200 / BDS ICD' : '軌道公式 · IS-GPS-200 / 北斗 ICD', cx + 16, cy + (n ? 16 : 24), { size: n ? 12 : 14, color: C.gps, weight: 700 });
        const eqs = [
          ['n = √(μ / A³) + Δn', en ? 'mean motion: how fast it goes round' : '平均角速度：繞一圈有多快'],
          ['M = M₀ + n · tₖ', en ? 'where it is on the orbit now' : '此刻走到軌道上的哪裡'],
          ['M = E − e · sin E', en ? 'Kepler’s equation, solved for E' : '克卜勒方程，反覆求解 E'],
          ['(x, y, z) ← A, e, E, ω, i, Ω', en ? 'rotate into Earth coordinates' : '轉換到地球座標'],
          ['δt = af₀ + af₁Δt + af₂Δt²', en ? 'satellite clock offset' : '衛星時鐘偏差'],
        ];
        (n ? eqs.slice(1) : eqs).forEach(([f, d], i) => {
          if (n) { txt(f, cx + 16, cy + 38 + i * 18, { size: 11, color: C.text, weight: 700, mono: true }); return; }
          const y = cy + 60 + i * 44;
          txt(f, cx + 18, y, { size: 15, color: C.text, weight: 700, mono: true });
          txt(d, cx + 18, y + 19, { size: 12, color: C.dim });
        });
        ctx.restore();
      }
      if (beat === 1) txt(en ? 'Broadcast ephemeris · RINEX · G05' : '廣播星曆 · RINEX · G05', cx + 16, cy + (n ? 16 : 24), { size: n ? 12 : 14, color: C.gps, weight: 700 });
      const params = en
        ? [['√A', 'orbit size'], ['e', 'eccentricity'], ['i₀', 'inclination'], ['Ω₀', 'ascending node'], ['ω', 'perigee'], ['M₀', 'position on orbit'], ['af₀', 'clock offset']]
        : [['√A', '軌道大小'], ['e', '橢圓程度'], ['i₀', '軌道傾角'], ['Ω₀', '升交點'], ['ω', '近地點方向'], ['M₀', '在軌道上的位置'], ['af₀', '時鐘偏差']];
      const shown = Math.min(params.length, Math.floor((t - BEAT[1]) * 2) + 1);
      if (beat === 1) params.slice(0, shown).forEach(([k, v], i) => {
        if (n) {
          const x = cx + 16 + (i % 2) * (cw - 32) / 2, y = cy + 38 + Math.floor(i / 2) * 20;
          if (i > 5) return;
          txt(k, x, y, { size: 11, color: C.text, weight: 700, mono: true });
          txt(v, x + 30, y, { size: 11, color: C.dim });
        } else {
          const y = cy + 58 + i * 31;
          txt(k, cx + 18, y, { size: 15, color: C.text, weight: 700, mono: true });
          txt(v, cx + 70, y, { size: 14, color: C.dim });
          ctx.fillStyle = '#2b5a80'; ctx.fillRect(cx + cw - 110, y - 3, 90 * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.7))), 6);
        }
      });
      if (beat === 2) {
        const k = revealAt(2), oy = cy + ch - (n ? 12 : 22);
        ctx.save(); ctx.globalAlpha *= k;
        line(cx + 12, oy - (n ? 12 : 20), cx + cw - 12, oy - (n ? 12 : 20), '#2f5577');
        txt(en ? '→ position (x, y, z) · clock δt' : '→ 算出：位置 (x, y, z) · 時鐘 δt', cx + 16, oy, { size: n ? 12 : 15, color: C.acc, weight: 700 });
        line(h.x, h.y, n ? cx + cw / 2 : cx, n ? cy : oy, C.acc + '99', 1.2, [4, 5]);
        ctx.restore();
      }
      ctx.restore();
    }
    caption(beat, en ? [
      'Dozens of GPS and BeiDou satellites move along their orbits. To simulate their signals, we first need to know where each one is.',
      'Satellites broadcast their own ephemeris: parameters describing orbit and clock. GeoTrust reads real broadcast ephemeris files (RINEX).',
      'Into the orbit equations: find where the satellite is on its orbit, solve Kepler’s equation, rotate into Earth coordinates; a polynomial gives the clock offset.',
    ] : [
      '天上有數十顆 GPS 與北斗衛星沿著軌道運行。要模擬訊號，第一步是知道每顆衛星此刻在哪裡。',
      '衛星會廣播自己的「星曆」：一組描述軌道與時鐘的參數。GeoTrust 讀取真實的廣播星曆檔（RINEX）。',
      '把參數代入軌道公式：先算出衛星走到軌道上的哪裡、解克卜勒方程，再轉成地球座標；時鐘偏差則用多項式修正。',
    ], en ? 'Next → how far is it from the receiver?' : '下一步 → 衛星離接收機多遠？');
  }

  // ---------- 02 Propagation: drag the satellite across the sky, read range, delay and Doppler ----------
  // Geometry for a GPS orbit (radius 26,560 km) seen from the ground; Doppler is a simplified pass model.
  const RE = 6371, RS = 26560, LIGHT = 299792.458, L1 = 1575.42e6, VMAX = 860;
  let theta = 40, dragged = false, dragging = false;   // θ: angle along the sky arc, 0° = left horizon
  function propGeom() {
    const n = narrow();
    const rx = n ? W * 0.5 : W * 0.27, ry = n ? H * 0.44 : H * 0.84;
    const ax = n ? W * 0.4 : W * 0.22, ay = n ? H * 0.33 : H * 0.66;
    return { n, rx, ry, ax, ay };
  }
  function propPhysics() {
    const el = Math.min(theta, 180 - theta), e = el * Math.PI / 180;
    const range = Math.sqrt(RS * RS - (RE * Math.cos(e)) ** 2) - RE * Math.sin(e);
    // Rising on the left (approaching, +), setting on the right (receding, −).
    const fd = (theta < 90 ? 1 : -1) * VMAX * Math.cos(e) / (LIGHT * 1000 / L1);
    return { el, range, tau: range / LIGHT * 1000, fd };
  }
  function wrapText(s, x, y, maxW, lineH, opts) {
    ctx.font = `${opts.weight || 500} ${(opts.size || 15) * fs()}px 'Noto Sans TC',sans-serif`;
    lineH *= fs();
    const parts = isEn() ? s.split(/(?<= )/) : [...s];
    let lineStr = '';
    for (const p of parts) {
      if (ctx.measureText(lineStr + p).width > maxW && lineStr) { txt(lineStr.trimEnd(), x, y, opts); y += lineH; lineStr = p.trimStart(); }
      else lineStr += p;
    }
    txt(lineStr, x, y, opts);
    return y;
  }
  function scenePropagation() {
    if (!dragged) theta = 8 + ((T * 9) % 164);
    const { n, rx, ry, ax, ay } = propGeom();
    const th = theta * Math.PI / 180;
    const sx = rx - ax * Math.cos(th), sy = ry - ay * Math.sin(th);
    const p = propPhysics(), en = isEn();
    // Sky arc (the satellite's path) and ground.
    ctx.beginPath(); ctx.ellipse(rx, ry, ax, ay, 0, Math.PI, 2 * Math.PI);
    ctx.strokeStyle = '#2f5577'; ctx.setLineDash([3, 6]); ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
    line(rx - ax - 20, ry + 14, rx + ax + 20, ry + 14, '#2f5577');
    // Wavefronts spreading from the satellite, clipped to the sky.
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, ry + 14); ctx.clip();
    for (let r = (T * 70) % 30; r < Math.hypot(sx - rx, sy - ry) + 20; r += 30) {
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(189,154,255,${Math.max(0, 0.5 - r / 600)})`; ctx.lineWidth = 1.2; ctx.stroke();
    }
    ctx.restore();
    // Receiver.
    ctx.fillStyle = C.acc; ctx.beginPath(); ctx.moveTo(rx - 14, ry + 12); ctx.lineTo(rx + 14, ry + 12); ctx.lineTo(rx, ry - 10); ctx.fill();
    line(rx, ry - 10, rx, ry - 24, C.acc, 2);
    txt(en ? 'Receiver' : '接收機', rx, ry + 32, { size: 13, color: C.dim, align: 'center' });
    line(sx, sy, rx, ry - 24, C.acc + 'aa', 1.3, [5, 6]);
    // Satellite with a drag handle.
    ctx.strokeStyle = dragging ? C.acc : C.acc + '88'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, 22 + (dragged ? 0 : Math.sin(T * 4) * 3), 0, Math.PI * 2); ctx.stroke();
    txt(en ? '↑ rises' : '↑ 升起', rx - ax, ry + 32, { size: 13, color: C.gps, align: 'center', weight: 700 });
    txt(en ? 'sets ↓' : '落下 ↓', rx + ax, ry + 32, { size: 13, color: C.bds, align: 'center', weight: 700 });
    {
      // Tangent of the arc in the direction of travel (left → right).
      let dx = ax * Math.sin(th), dy = -ay * Math.cos(th);
      const len = Math.hypot(dx, dy); dx /= len; dy /= len;
      const x1 = sx + dx * 30, y1 = sy + dy * 30, x2 = sx + dx * 58, y2 = sy + dy * 58;
      line(x1, y1, x2, y2, C.acc, 2.5);
      ctx.fillStyle = C.acc; ctx.beginPath();
      ctx.moveTo(x2 + dx * 8, y2 + dy * 8); ctx.lineTo(x2 - dy * 6, y2 + dx * 6); ctx.lineTo(x2 + dy * 6, y2 - dx * 6); ctx.fill();
    }
    sat(sx, sy, C.gps, 1);
    if (!dragged) txt(en ? '⇆ drag the satellite' : '⇆ 拖曳衛星', sx, sy + 40, { size: 14, color: C.acc, align: 'center', weight: 700 });
    // Elevation angle at the receiver.
    txt(`${Math.round(p.el)}°`, rx + (theta < 90 ? -34 : 34), ry - 6, { size: 13, color: C.text, align: 'center', weight: 700, mono: true });

    // Plain-language reason for the Doppler sign: it follows whether the range is shrinking or growing.
    const status = Math.abs(theta - 90) < 3
      ? [en ? 'Overhead: closest point, range not changing → 0' : '通過頭頂：距離最短、暫時不變 → 0', C.text]
      : theta < 90
        ? [en ? 'Approaching: range shrinking → frequency up (+)' : '正在靠近：距離縮短 → 頻率變高（＋）', C.gps]
        : [en ? 'Receding: range growing → frequency down (−)' : '正在遠離：距離拉長 → 頻率變低（－）', C.bds];
    const fmt = v => Math.round(v).toLocaleString('en-US');
    const sign = p.fd >= 0 ? '+' : '−', fdc = p.fd >= 0 ? C.gps : C.bds;
    const v = VMAX * Math.cos(p.el * Math.PI / 180), lambda = LIGHT * 1000 / L1;
    // Formulas are written out step by step with the current numbers substituted.
    const tauLine = `= ${fmt(p.range)} km ÷ 299,792 km/s`;
    const fdLine = `= ${sign}${fmt(v)} m/s ÷ ${lambda.toFixed(3)} m`;
    const tauVal = `${p.tau.toFixed(1)} ms`, fdVal = `${sign}${Math.abs(p.fd / 1000).toFixed(1)} kHz`;
    if (n) {
      const px = 12, pw = W - 24, py = H * 0.56, ph = H - py - 8, x = px + 14, xr = px + pw - 14;
      box(px, py, pw, ph, '#2f5577');
      [[en ? 'Elevation' : '仰角', `${Math.round(p.el)}°`], [en ? 'Range ρ' : '距離 ρ', `${fmt(p.range)} km`]].forEach(([k, val], i) => {
        txt(k, x + i * pw / 2, py + 20, { size: 12, color: C.dim });
        txt(val, x + i * pw / 2, py + 42, { size: 16, color: C.text, weight: 700, mono: true });
      });
      txt(en ? 'Delay  τ = ρ ÷ c' : '延遲  τ = ρ ÷ c', x, py + 76, { size: 13, color: C.text, weight: 700 });
      txt(tauVal, xr, py + 76, { size: 16, color: C.acc, align: 'right', weight: 700, mono: true });
      txt(tauLine, x, py + 98, { size: 12, color: C.dim, mono: true });
      txt(en ? 'Doppler  f_D = v ÷ λ' : '都卜勒  f_D = v ÷ λ', x, py + 128, { size: 13, color: C.text, weight: 700 });
      txt(fdVal, xr, py + 128, { size: 16, color: fdc, align: 'right', weight: 700, mono: true });
      txt(fdLine, x, py + 150, { size: 12, color: C.dim, mono: true });
      txt(status[0], x, py + 180, { size: 12, color: status[1], weight: 700 });
      return;
    }
    const px = W * 0.53, pw = W * 0.45, py = H * 0.05, ph = H * 0.9, x = px + 18, xr = px + pw - 18;
    box(px, py, pw, ph, '#2f5577');
    [[en ? 'Elevation' : '仰角', `${Math.round(p.el)}°`], [en ? 'Range ρ' : '距離 ρ', `${fmt(p.range)} km`]].forEach(([k, val], i) => {
      txt(k, x + i * pw * 0.4, py + 24, { size: 13, color: C.dim });
      txt(val, x + i * pw * 0.4, py + 50, { size: 19, color: C.text, weight: 700, mono: true });
    });
    line(x, py + 76, xr, py + 76, '#24425e');
    // Delay: τ = ρ ÷ c.
    txt(en ? 'Delay' : '傳播延遲', x, py + 100, { size: 13, color: C.dim });
    txt('τ = ρ ÷ c', x, py + 126, { size: 17, color: C.text, weight: 700, mono: true });
    txt(tauVal, xr, py + 126, { size: 19, color: C.acc, align: 'right', weight: 700, mono: true });
    txt(tauLine, x, py + 150, { size: 13, color: C.dim, mono: true });
    line(x, py + 172, xr, py + 172, '#24425e');
    // Doppler: f_D = v ÷ λ, with v the speed toward the receiver and λ the L1 wavelength.
    txt(en ? 'Doppler shift' : '都卜勒頻移', x, py + 196, { size: 13, color: C.dim });
    txt('f_D = v ÷ λ', x, py + 222, { size: 17, color: C.text, weight: 700, mono: true });
    txt(fdVal, xr, py + 222, { size: 19, color: fdc, align: 'right', weight: 700, mono: true });
    txt(fdLine, x, py + 246, { size: 13, color: C.dim, mono: true });
    txt(en ? 'v: speed toward receiver · λ: L1 wavelength' : 'v：衛星朝接收機的速度 · λ：L1 波長', x, py + 268, { size: 11, color: C.dim });
    txt(status[0], x, py + 298, { size: 13, color: status[1], weight: 700 });
    // Transmit vs receive ticks: the gap grows with the delay.
    const ty = py + 334, gw = pw - 36, gap = (p.tau - 64) / 24 * gw * 0.32, period = gw * 0.34;
    [en ? 'sent' : '發射', en ? 'received' : '收到'].forEach((l, r) => {
      const yy = ty + r * 30;
      txt(l, x, yy, { size: 11, color: C.dim });
      line(x + 52, yy + 6, x + gw, yy + 6, '#2f5577');
      for (let xx = ((T * 30) % period) + (r ? gap : 0) - period; xx < gw - 52; xx += period) {
        if (xx >= 0) line(x + 52 + xx, yy + 6, x + 52 + xx, yy - 8, r ? C.acc : C.gps, 2);
      }
    });
    txt(en ? 'Simplified model, GPS orbit' : '簡化模型 · 以 GPS 軌道計算', x, py + ph - 14, { size: 10, color: C.dim });
  }

  // ---------- 03 Coding: built up in three beats so each idea lands before the next ----------
  // Data bits follow a fixed pattern so the slow row visibly changes; on the last beat each data bit is shaded
  // to show the rule: +1 leaves the code as it is, −1 flips it.
  const DATA_BITS = [1, -1, -1, 1, -1, 1, 1, -1];
  const FLIP = '#ff8f7a';
  function sceneCoding() {
    const n = narrow(), en = isEn();
    const x0 = n ? 16 : 170, x1 = W - (n ? 16 : 28);
    const rows = n ? [H * 0.12, H * 0.31, H * 0.5] : [H * 0.14, H * 0.36, H * 0.58];
    const amp = n ? 18 : 26, shift = T * 30, BIT = n ? 120 : 160, CHIP = 12;
    const dIdx = x => Math.floor((x + shift) / BIT);
    const dVal = k => DATA_BITS[((k % 8) + 8) % 8];
    const data = x => dVal(dIdx(x));
    const code = x => bit(9, Math.floor((x + shift) / CHIP));
    const beat = beatOf();
    const reveal = k => k > beat ? 0 : revealAt(k);
    // Visible data-bit windows, clipped to the trace area.
    const windows = [];
    for (let k = dIdx(x0); k * BIT - shift < x1; k++) {
      const a = Math.max(x0, k * BIT - shift), b = Math.min(x1, (k + 1) * BIT - shift);
      if (b > a) windows.push({ a, b, d: dVal(k) });
    }
    // Last beat: shade every bit window across all three rows, green where unchanged, coral where flipped.
    if (beat === 2) {
      ctx.save(); ctx.globalAlpha *= revealAt(2);
      windows.forEach(({ a, b, d }) => {
        ctx.fillStyle = d > 0 ? '#8affdd12' : '#ff8f7a1c';
        ctx.fillRect(a, rows[0] - amp - 8, b - a, rows[2] - rows[0] + amp * 2 + 16);
        if (b - a > 40) txt(d > 0 ? (en ? 'unchanged' : '不變') : (en ? 'flipped' : '翻轉'), (a + b) / 2, rows[2] + amp + (n ? 14 : 18),
          { size: n ? 11 : 13, color: d > 0 ? C.acc : FLIP, align: 'center', weight: 700 });
      });
      ctx.restore();
    }
    const labels = en ? ['① Navigation data', '② PRN code', '③ Signal sent'] : ['① 導航電文', '② PRN 碼', '③ 送出的訊號'];
    const subs = en ? ['the message · slow', 'the fingerprint · fast', '① × ②'] : ['要傳的內容 · 慢', '衛星的指紋 · 快', '① × ②'];
    const colors = [C.bds, C.pur, C.acc];
    [0, 1, 2].forEach(i => {
      const a = reveal(i), c = colors[i];
      if (n) { txt(labels[i], x0, rows[i] - amp - 14, { size: 13, color: a ? c : '#3c5a78', weight: 700 }); txt(subs[i], x1, rows[i] - amp - 14, { size: 11, color: C.dim, align: 'right' }); }
      else { txt(labels[i], 20, rows[i] - 8, { size: 15, color: a ? c : '#3c5a78', weight: 700 }); txt(subs[i], 20, rows[i] + 14, { size: 12, color: C.dim }); }
      if (!a) { line(x0, rows[i], x1, rows[i], '#24425e', 1, [4, 6]); return; }
      ctx.save(); ctx.globalAlpha *= a; ctx.beginPath(); ctx.rect(x0, rows[i] - amp - 6, (x1 - x0) * a, amp * 2 + 12); ctx.clip();
      if (i === 0) trace(x0, x1, rows[0], amp, data, c, 2);
      if (i === 1) trace(x0, x1, rows[1], amp, code, c, 2);
      if (i === 2) {
        // Draw ③ bit by bit so flipped stretches stand out in coral.
        windows.forEach(({ a: wa, b: wb, d }) => {
          ctx.save(); ctx.beginPath(); ctx.rect(wa, rows[2] - amp - 6, wb - wa, amp * 2 + 12); ctx.clip();
          trace(Math.max(x0, wa - 2), Math.min(x1, wb + 2), rows[2], amp, x => d * code(x), d > 0 ? C.acc : FLIP, 2);
          ctx.restore();
        });
      }
      ctx.restore();
    });
    // Each data bit carries its value, written in the middle of the row.
    if (reveal(0)) windows.forEach(({ a, b, d }) => {
      if (b - a > 36) txt(d > 0 ? '+1' : '−1', (a + b) / 2, rows[0], { size: n ? 12 : 14, color: C.bds, align: 'center', weight: 700, mono: true });
    });
    // Beat 1: one data bit spans many code chips.
    if (beat === 1) {
      const w = windows.find(w => w.b - w.a >= BIT - 1);
      if (w) {
        ctx.save(); ctx.globalAlpha *= revealAt(1);
        ctx.fillStyle = '#8affdd10'; ctx.fillRect(w.a, rows[0] - amp - 8, BIT, rows[1] - rows[0] + amp * 2 + 16);
        ctx.strokeStyle = '#8affdd55'; ctx.strokeRect(w.a, rows[0] - amp - 8, BIT, rows[1] - rows[0] + amp * 2 + 16);
        txt(en ? '1 data bit = many chips' : '1 個電文位元 ＝ 許多碼片', w.a + BIT / 2, rows[1] + amp + (n ? 18 : 22), { size: n ? 11 : 13, color: C.acc, align: 'center', weight: 700 });
        ctx.restore();
      }
    }
    const chip = en ? 'GPS · L1 C/A   BeiDou · B1I' : 'GPS · L1 C/A　北斗 · B1I';
    caption(beat, en ? [
      'Range and timing are known; now the receiver must tell satellites apart. First, navigation data: what the satellite has to say (orbit, time), sent as +1 / −1 and changing slowly.',
      'Each satellite also has its own fast ±1 sequence, the PRN code. It works like a fingerprint.',
      'The rule: where the data is +1 the code passes unchanged; where it is −1 the code flips upside down. A receiver matching the same code recognises the satellite and reads the data.',
    ] : [
      '知道距離與時間後，還要讓接收機認得是哪顆衛星。先看導航電文：衛星要說的內容（軌道、時間），以 +1／−1 表示，變化得很慢。',
      '每顆衛星還有一組專屬、快速跳動的 ±1 序列，叫 PRN 碼，就像衛星的指紋。',
      '相乘的規則：電文是 +1 時，碼維持原樣；電文是 −1 時，碼整段上下翻轉。接收機用同一組碼比對，就能認出衛星並讀出電文。',
    ], en ? 'Next → combine all the satellites' : '下一步 → 把所有衛星合在一起', chip);
  }

  // ---------- 04 Synthesis: one channel → 16 in parallel → added point by point → stored as I/Q ----------
  // GeoTrust runs 16 channels by default (more if the hardware allows); the GPS/BeiDou split follows the sky, here 9 + 7.
  // A new split is drawn every time the 16-channel grid comes up (beat 1 of step 04, by playback or back/next): always 16 in total, never the same mix twice in a row.
  const GPS_POOL = ['G05', 'G02', 'G07', 'G09', 'G13', 'G15', 'G20', 'G30', 'G18', 'G25', 'G12', 'G29'];
  const BDS_POOL = ['C06', 'C09', 'C14', 'C21', 'C26', 'C33', 'C39', 'C42', 'C45', 'C11', 'C19', 'C24'];
  let CH_IDS = [], G0 = 0, C0 = 8, synBeat = -1, picked = [0, 1, 8];
  function shuffleChannels() {
    let gN;
    do gN = 4 + Math.floor(Math.random() * 9); while (gN === C0);   // 4–12 GPS, the rest BeiDou
    CH_IDS = [...GPS_POOL.slice(0, gN), ...BDS_POOL.slice(0, 16 - gN)];
    C0 = gN;
    // Three of these channels are used to show the adding: one GPS, one BeiDou and one more from anywhere.
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a));
    const g = rnd(0, C0), c = rnd(C0, 16);
    let x; do x = rnd(0, 16); while (x === g || x === c);
    picked = [g, x, c];
  }
  shuffleChannels();
  const isG = i => CH_IDS[i][0] === 'G';
  function sceneSynthesis() {
    const n = narrow(), en = isEn(), AH = areaH();
    const beat = BEAT.reduce((b, s0, i) => t >= s0 ? i : b, 0);
    if (beat === 1 && synBeat !== 1) shuffleChannels();
    synBeat = beat;
    const gx = n ? 16 : 36, gy = n ? 34 : 50, cell = n ? 38 : 54, gap = n ? 6 : 8;
    const sumX = n ? W * 0.8 : W * 0.5, sumY = gy + 2 * (cell + gap) - gap / 2;
    const chipSig = (i, x) => bit(3 + i, Math.floor((x + T * 40) / 90)) * bit(9 + i, Math.floor((x + T * 40) / 9));
    const cellRect = i => [gx + (i % 4) * (cell + gap), gy + Math.floor(i / 4) * (cell + gap), cell, cell];
    const bigLabel = i => isG(i)
      ? (en ? ' · GPS satellite · L1 C/A (from step 03)' : ' · GPS 衛星 · L1 C/A（來自 03）')
      : (en ? ' · BeiDou satellite · B1I (from step 03)' : ' · 北斗衛星 · B1I（來自 03）');
    function channel(i, [x, y, w, h], big) {
      const c = isG(i) ? C.gps : C.bds;
      box(x, y, w, h, c, '#0b1b2c', 6);
      txt(CH_IDS[i] + (big ? bigLabel(i) : ''), x + (big ? 14 : w / 2), y + (big ? 18 : h * 0.28),
        { size: big ? (n ? 12 : 14) : (n ? 10 : 12), color: c, align: big ? 'left' : 'center', weight: 700, mono: !big });
      ctx.save(); ctx.beginPath(); ctx.rect(x + 4, y + h * 0.45, w - 8, h * 0.5); ctx.clip();
      trace(x + 6, x + w - 6, y + h * 0.7, h * 0.16, xx => chipSig(i, (xx - x) * (big ? 1 : 3)), c, big ? 2 : 1.2);
      ctx.restore();
    }

    // Beat 0: one GPS (G) and one BeiDou (C) channel, full width.
    const bigH = n ? 76 : 96;
    const bigRects = { [G0]: [gx, n ? 26 : 30, W - gx * 2, bigH], [C0]: [gx, (n ? 26 : 30) + bigH + (n ? 14 : 20), W - gx * 2, bigH] };
    if (beat === 0) {
      channel(G0, bigRects[G0], true); channel(C0, bigRects[C0], true);
      wrapText(en ? 'G = GPS · C = BeiDou — and a receiver hears many at once…' : 'G 開頭是 GPS、C 開頭是北斗。但接收機同時收到的，不只兩顆…', W / 2, bigRects[C0][1] + bigH + (n ? 26 : 40), W - 40, 18, { size: n ? 12 : 15, color: C.dim, align: 'center', weight: 700 });
    } else {
      // Beat 1: the two shrink into the grid and the other channels join.
      const k = ease((t - BEAT[1]) / 0.7);
      txt(en ? 'GPU · CUDA: 16 channels in parallel by default' : 'GPU · CUDA：預設 16 個通道同時計算', gx, gy - 18, { size: n ? 12 : 14, color: C.dim, weight: 700 });
      if (beat >= 2) {
        ctx.save(); ctx.globalAlpha *= revealAt(2);
        for (let i = 0; i < 16; i++) {
          const [x, y] = cellRect(i), sx = x + cell, sy = y + cell / 2, c = isG(i) ? C.gps : C.bds;
          line(sx, sy, sumX - 24, sumY, c + '30', 1);
          const p = (T * 0.8 + i * 0.13) % 1;
          dot(sx + (sumX - 24 - sx) * p, sy + (sumY - sy) * p, 2.2, c);
        }
        ctx.restore();
      }
      for (let i = 0; i < 16; i++) {
        if (i === G0 || i === C0) continue;
        const a = Math.min(1, Math.max(0, (t - BEAT[1] - 0.4) * 6 - i * 0.6));
        if (!a) continue;
        ctx.save(); ctx.globalAlpha *= a; channel(i, cellRect(i), false); ctx.restore();
      }
      [G0, C0].forEach(i => { const r = cellRect(i); channel(i, bigRects[i].map((v, j) => v + (r[j] - v) * k), false); });
      const gN = CH_IDS.filter(id => id[0] === 'G').length, cN = 16 - gN;
      const legend = en ? `This example: GPS ${gN} + BeiDou ${cN} — the split follows the sky` : `此例 GPS ${gN} + 北斗 ${cN}，比例依當下可見衛星而定`;
      txt(legend, gx, gy + 4 * (cell + gap) + (n ? 8 : 12), { size: n ? 11 : 12, color: C.dim, weight: 700 });
    }
    if (beat >= 2) {
      ctx.save(); ctx.globalAlpha *= revealAt(2);
      dot(sumX, sumY, 24, '#0e2f45');
      ctx.strokeStyle = C.acc; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sumX, sumY, 24, 0, Math.PI * 2); ctx.stroke();
      txt('Σ', sumX, sumY + 1, { size: 24, color: C.acc, align: 'center', weight: 700 });
      txt(en ? 'add' : '相加', sumX, sumY + 40, { size: 12, color: C.dim, align: 'center' });
      ctx.restore();
    }
    // Right of the grid on desktop, below it on phones.
    const rx0 = n ? 16 : sumX + 50, rx1 = W - (n ? 16 : 24);
    const ry0 = n ? gy + 4 * (cell + gap) + 22 : 24, ry1 = n ? AH - 6 : AH - 14;
    // The example waves are the three channels picked from the grid on the left.
    const WAVE_P = [[0.8, 0.05, 3, 0], [0.6, 0.07, 3.6, 1.7], [0.7, 0.04, 2.4, 3.1]];
    const waves = picked.map((ci, k) => {
      const [A, f, sp, ph] = WAVE_P[k];
      return [CH_IDS[ci], isG(ci) ? C.gps : C.bds, x => A * Math.sin(x * f + T * sp + ph)];
    });
    if (beat === 2 || beat === 3) {
      ctx.save(); ctx.globalAlpha *= revealAt(beat);
      picked.forEach(ci => {
        const [x, y, w, h] = cellRect(ci);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
      });
      ctx.restore();
    }
    if (beat === 2) {
      // "Add" made concrete: at one instant, read each wave's value and add the numbers.
      ctx.save(); ctx.globalAlpha *= revealAt(2);
      const rowH = (ry1 - ry0) / (n ? 4.4 : 5.4), amp = rowH * 0.32, lab = n ? 34 : 44;
      const scanX = rx0 + lab + (rx1 - rx0 - lab) * 0.6;
      const vals = waves.map(([, , f]) => f(scanX));
      waves.forEach(([id, c, f], i) => {
        const y = ry0 + rowH * (i + 0.5);
        txt((i ? '+ ' : '  ') + id, rx0, y, { size: n ? 11 : 13, color: c, weight: 700, mono: true });
        trace(rx0 + lab, rx1, y, amp, f, c, 1.6);
        dot(scanX, y - vals[i] * amp, 3.5, '#fff');
      });
      const sy = ry0 + rowH * 3.7, total = vals.reduce((a, b) => a + b, 0);
      line(rx0, ry0 + rowH * 3.05, rx1, ry0 + rowH * 3.05, '#2f5577');
      txt('= ' + (en ? 'sum' : '相加'), rx0, sy, { size: n ? 11 : 13, color: C.acc, weight: 700 });
      trace(rx0 + lab, rx1, sy, amp * 1.4, x => waves.reduce((a, [, , f]) => a + f(x), 0) / 2.1 * 1.0, C.acc, 2);
      dot(scanX, sy - total / 2.1 * amp * 1.4, 4, '#fff');
      line(scanX, ry0 + 4, scanX, sy + amp * 1.6, '#ffffff55', 1, [3, 4]);
      if (!n) {
        const f2 = v => (v < 0 ? '(' + v.toFixed(2).replace('-', '−') + ')' : v.toFixed(2));
        txt(`${f2(vals[0])} + ${f2(vals[1])} + ${f2(vals[2])} = ${total.toFixed(2).replace('-', '−')}`, rx0, ry1 - 8, { size: 13, color: C.text, weight: 700, mono: true });
      }
      ctx.restore();
    }
    if (beat === 3) {
      // Why add: the antenna receives everything at once. The receiver tries satellite codes one by one;
      // a code that is in the mix matches, a code that is not (G31 here) finds nothing.
      ctx.save(); ctx.globalAlpha *= revealAt(3);
      const mix = x => waves.reduce((a, [, , f]) => a + f(x), 0) / 2.1;
      const absent = ['G31', 'G28', 'G03', 'G10'].find(id => !CH_IDS.includes(id));
      const keys = [[waves[0][0], waves[0][1], true, picked[0]], [waves[2][0], waves[2][1], true, picked[2]], [absent, C.dim, false, -1]];
      const kt = T / 2.4, ki = Math.floor(kt) % 3, kp = kt - Math.floor(kt);
      const [kid, kc, hit, kcell] = keys[ki];
      const y0 = ry0 + (n ? 8 : 6), wy = ry0 + (n ? 26 : 40), amp = n ? 8 : 18;
      txt(en ? `Mixed signal: ${waves.map(w => w[0]).join(', ')} on top of each other` : `混合訊號：${waves.map(w => w[0]).join('、')} 疊在一起`, rx0, y0, { size: n ? 11 : 13, color: C.acc, weight: 700 });
      trace(rx0, rx1, wy, amp, mix, C.acc, 2);
      // The code being tried, drawn as a chip strip under the mix.
      const ky = wy + amp + (n ? 18 : 36), kh = n ? 8 : 14;
      txt(en ? `Receiver tries ${kid}’s code` : `接收機拿 ${kid} 的碼來試`, rx0, ky, { size: n ? 11 : 14, color: kc, weight: 700 });
      const sx0 = rx0 + (n ? 165 : 200);
      for (let x = sx0; x < rx1; x += 9) {
        const v = bit(ki * 7 + 2, Math.floor((x + T * 30) / 9));
        ctx.fillStyle = kc + (v > 0 ? 'ee' : '44'); ctx.fillRect(x, ky - kh / 2, 7, kh);
      }
      // Result: how well it matches.
      const fill = ease(Math.min(1, kp / 0.35)) * (hit ? 0.92 : 0.06);
      const my = ky + (n ? 24 : 46), mw = rx1 - rx0 - (n ? 96 : 120);
      txt(en ? 'match' : '對上程度', rx0, my, { size: n ? 11 : 13, color: C.dim });
      ctx.fillStyle = '#16304a'; ctx.fillRect(rx0 + (n ? 60 : 80), my - 6, mw, 12);
      ctx.fillStyle = hit ? kc : '#3c5a78'; ctx.fillRect(rx0 + (n ? 60 : 80), my - 6, mw * fill, 12);
      if (kp > 0.35) {
        // The matching channel lights up in the grid on the left; a code that is absent lights nothing.
        if (hit) {
          const [cx0, cy0, cw0, ch0] = cellRect(kcell), pulse = 0.6 + 0.4 * Math.sin(T * 8);
          ctx.save();
          ctx.shadowColor = kc; ctx.shadowBlur = 22 * pulse;
          ctx.fillStyle = kc + '44'; ctx.fillRect(cx0 - 4, cy0 - 4, cw0 + 8, ch0 + 8);
          ctx.strokeStyle = kc; ctx.lineWidth = 3; ctx.strokeRect(cx0 - 4, cy0 - 4, cw0 + 8, ch0 + 8);
          ctx.restore();
          txt('✓', cx0 + cw0 + 2, cy0 - 2, { size: n ? 14 : 18, color: kc, align: 'center', weight: 700 });
        }
        const res = hit ? (en ? `✓ Match — ${kid} found` : `✓ 對上了：找到 ${kid}`) : (en ? `✗ No match — ${kid} is not in the sky` : `✗ 對不上：天上沒有 ${kid}`);
        txt(res, rx0, my + (n ? 22 : 40), { size: n ? 13 : 18, color: hit ? kc : '#ff8f7a', weight: 700 });
      }
      if (!n) txt(en ? 'Like picking out a friend’s voice in a noisy room.' : '就像在吵雜的教室裡，仍聽得出熟人的聲音。', rx0, ry1 - 6, { size: 13, color: C.text, weight: 700 });
      ctx.restore();
    }
    if (beat === 4) {
      // Back on GeoTrust's side: the mix must become numbers for the SDR. Sample one instant → one (I, Q) pair.
      ctx.save(); ctx.globalAlpha *= revealAt(4);
      const mix = x => waves.reduce((a, [, , f]) => a + f(x), 0) / 2.1;
      const r = n ? 34 : 54;
      const ang = T * 1.4, mag = 0.75 + 0.2 * Math.sin(T * 0.9), len = r * mag;
      let cx, cy;
      if (!n) {
        // Strip: the mixed signal, with the instant being stored marked.
        txt(en ? 'Mixed signal → take one instant' : '混合訊號 → 取一個時間點', rx0, ry0 + 6, { size: 13, color: C.acc, weight: 700 });
        trace(rx0, rx1, ry0 + 36, 14, mix, C.acc + 'aa', 1.6);
        const sx = rx0 + 60;
        line(sx, ry0 + 18, sx, ry0 + 56, '#ffffffaa', 1, [3, 3]);
        dot(sx, ry0 + 36 - mix(sx) * 14, 4, '#fff');
        cx = rx0 + r + 6; cy = ry0 + 140;
        line(sx, ry0 + 58, cx, cy - r - 8, '#ffffff55', 1.2, [3, 4]);
        txt(en ? '↓ stored as one (I, Q) pair' : '↓ 存成一組 (I, Q)', sx + 12, ry0 + 72, { size: 12, color: C.text, weight: 700 });
      } else { cx = rx0 + r + 4; cy = (ry0 + ry1) / 2; }
      const px = cx + Math.cos(ang) * len, py = cy - Math.sin(ang) * len;
      ctx.strokeStyle = '#2f5577'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      line(cx - r - 6, cy, cx + r + 6, cy, '#2f5577'); line(cx, cy - r - 6, cx, cy + r + 6, '#2f5577');
      line(cx, cy, px, py, C.text, 2.5); dot(px, py, 4.5, '#fff');
      line(px, py, px, cy, C.acc, 1.4, [3, 3]); line(px, py, cx, py, C.pur, 1.4, [3, 3]);
      dot(px, cy, 3.5, C.acc); dot(cx, py, 3.5, C.pur);
      txt('I', cx + r + 9, cy, { size: 12, color: C.acc, weight: 700, mono: true });
      txt('Q', cx, cy - r - 12, { size: 12, color: C.pur, align: 'center', weight: 700, mono: true });
      // The pair as actual numbers, and the stream they form over time.
      const tx0 = cx + r + 28, iy = cy - (n ? 18 : 28), qy = cy + (n ? 18 : 28), amp = n ? 10 : 18;
      trace(tx0 + 12, rx1, iy, amp, x => Math.cos(ang - (x - tx0) * 0.05) * mag, C.acc, 2);
      trace(tx0 + 12, rx1, qy, amp, x => Math.sin(ang - (x - tx0) * 0.05) * mag, C.pur, 2);
      txt('I', tx0, iy, { size: 12, color: C.acc, weight: 700, mono: true });
      txt('Q', tx0, qy, { size: 12, color: C.pur, weight: 700, mono: true });
      const fmt2 = v => (v < 0 ? '−' : ' ') + Math.abs(v).toFixed(2);
      const pair = `(I, Q) = (${fmt2(Math.cos(ang) * mag)}, ${fmt2(Math.sin(ang) * mag)})`;
      if (n) txt(pair, tx0, ry1 - 2, { size: 11, color: C.text, weight: 700, mono: true });
      else {
        const ty = cy + r + 30;
        txt(pair, rx0, ty, { size: 14, color: C.text, weight: 700, mono: true });
        txt(en ? 'length = strength · angle = phase' : '指針長度 = 強度 · 角度 = 相位', rx0, ty + 24, { size: 13, color: C.dim, weight: 700 });
        txt(en ? 'one pair per instant = one sample' : '每個時間點一組 = 一個樣本', rx0, ty + 46, { size: 13, color: C.acc, weight: 700 });
      }
      ctx.restore();
    }
    if (beat === 5) {
      ctx.save(); ctx.globalAlpha *= revealAt(5);
      const r = n ? 24 : 44, cy = n ? ry0 + 40 : ry0 + 74;
      [[1, en ? 'frequency up (+)' : '頻率偏高（＋）', C.gps], [-1, en ? 'frequency down (−)' : '頻率偏低（－）', C.bds]].forEach(([dir, lab, c], k) => {
        const cx = rx0 + r + 6 + k * ((rx1 - rx0) / 2), ang = dir * T * 1.6;
        const px = cx + Math.cos(ang) * r, py = cy - Math.sin(ang) * r;
        ctx.strokeStyle = '#2f5577'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        line(cx, cy, px, py, c, 2.5); dot(px, py, 4, '#fff');
        txt(`${dir > 0 ? '↺' : '↻'} ${lab}`, cx, cy - r - (n ? 10 : 14), { size: n ? 10 : 13, color: c, align: 'center', weight: 700 });
        const tx0 = cx - r, tx1 = cx - r + (rx1 - rx0) / 2 - 16, amp = n ? 7 : 14;
        const iy = cy + r + (n ? 18 : 34), qy = iy + (n ? 22 : 40);
        txt('I', tx0 - 2, iy - amp - (n ? 6 : 8), { size: n ? 10 : 12, color: C.acc, weight: 700, mono: true });
        trace(tx0 + 10, tx1, iy, amp, x => Math.cos(ang - dir * (x - tx0) * 0.06), C.acc, 1.8);
        txt('Q', tx0 - 2, qy - amp - (n ? 6 : 8), { size: n ? 10 : 12, color: C.pur, weight: 700, mono: true });
        trace(tx0 + 10, tx1, qy, amp, x => Math.sin(ang - dir * (x - tx0) * 0.06), C.pur, 1.8);
      });
      if (!n) {
        txt(en ? 'I alone: the two look the same' : '只看 I：兩個一模一樣', rx0, ry1 - 30, { size: 13, color: C.text, weight: 700 });
        txt(en ? 'with Q: they move opposite ways → direction known' : '加上 Q：方向相反 → 分得出頻率往上或往下', rx0, ry1 - 8, { size: 13, color: C.acc, weight: 700 });
      }
      ctx.restore();
    }
    caption(beat, en ? [
      'Step 03 built each satellite’s signal — G05 for GPS, C06 for BeiDou. But at any moment a receiver hears many satellites together.',
      'By default the GPU (CUDA) computes 16 satellites at once, and more if the hardware allows. Each keeps its own delay, Doppler and PRN code; the GPS/BeiDou split follows which satellites are in view.',
      '“Adding” means: at one instant, take every satellite’s value and add the numbers. Repeat for every instant and you get one mixed signal.',
      'Why add? Because an antenna receives every satellite at once. The receiver tries each satellite’s PRN code in turn: if it matches, that satellite is found; if not, it isn’t in the sky.',
      'Back on GeoTrust’s side: to hand the mix to the SDR it must become numbers. Each instant is stored as a pair (I, Q), like the horizontal and vertical position of a clock hand — length is strength, angle is phase.',
      'Why two numbers? With I alone, a frequency shifted up or down looks the same; Q tells the direction. The SDR takes I/Q directly — about 20.8 million pairs per second.',
    ] : [
      '上一步做出了每顆衛星的訊號，例如 GPS 的 G05、北斗的 C06。但接收機在同一時刻，會同時收到很多顆衛星。',
      'GPU（CUDA）預設同時計算 16 顆衛星，硬體效能足夠時還能再增加。每顆都帶著自己的延遲、都卜勒與 PRN 碼；GPS 與北斗各幾顆，取決於當下看得到哪些衛星。',
      '「相加」就是在同一個時間點，把每顆衛星的訊號數值加起來。每個時間點都這樣做，就得到一條混合訊號。',
      '為什麼要相加？因為天線本來就同時收到所有衛星。接收機拿每顆衛星的 PRN 碼一一去試：對得上，就找到那顆衛星；對不上，代表天上沒有它。',
      '回到 GeoTrust 這端：混合訊號要交給 SDR，得先變成數字。每個時間點存成一組 (I, Q)，像時鐘指針的水平與垂直位置：長度是強度，角度是相位。',
      '為什麼要兩個數字？只記 I，頻率往上或往下偏移看起來一樣；加上 Q 才分得出方向。SDR 直接使用 I/Q，每秒約 2,080 萬組。',
    ], en ? 'Next → turn the numbers into radio waves' : '下一步 → 把 I/Q 變成電波送出去');
  }

  // ---------- 05 Transmit: laptop → SDR → antenna → receiver, all inside the lab ----------
  function sceneTransmit() {
    const n = narrow(), en = isEn(), beat = beatOf(), AH = areaH();
    const y = AH * 0.46, s = n ? 0.7 : 1.15;
    const xs = n ? [W * 0.14, W * 0.4, W * 0.62, W * 0.84] : [W * 0.12, W * 0.37, W * 0.6, W * 0.86];
    // The lab boundary appears on the last beat: everything happens indoors.
    if (beat === 2) {
      ctx.save(); ctx.globalAlpha *= revealAt(2);
      ctx.setLineDash([6, 6]); ctx.strokeStyle = C.acc + '88'; ctx.lineWidth = 1.2;
      ctx.strokeRect(6, y - 92 * s, W - 12, 210 * s); ctx.setLineDash([]);
      txt(en ? 'LAB · controlled · repeatable' : '實驗室 · 條件可控 · 可重現', 16, y - 92 * s - 12, { size: n ? 11 : 13, color: C.acc, weight: 700 });
      ctx.restore();
    }
    // Laptop.
    box(xs[0] - 48 * s, y - 40 * s, 96 * s, 62 * s, C.gps, '#0b1b2c', 6);
    ctx.fillStyle = C.gps; ctx.fillRect(xs[0] - 60 * s, y + 24 * s, 120 * s, 6 * s);
    txt('I/Q', xs[0], y - 9 * s, { size: 15 * s, color: C.gps, align: 'center', weight: 700, mono: true });
    // Cable with I/Q packets.
    line(xs[0] + 60 * s, y, xs[1] - 46 * s, y, C.gps + '55', 1.2);
    for (let k = 0; k < 4; k++) {
      const p = (T * 0.6 + k / 4) % 1;
      ctx.fillStyle = C.gps; ctx.fillRect(xs[0] + 60 * s + (xs[1] - 46 * s - xs[0] - 60 * s) * p - 4, y - 4, 8, 8);
    }
    // SDR and antenna light up on beat 1.
    dimIf(beat < 1, () => {
      box(xs[1] - 46 * s, y - 26 * s, 92 * s, 52 * s, C.acc, '#0b1b2c', 6);
      txt('SDR', xs[1], y, { size: 15 * s, color: C.acc, align: 'center', weight: 700, mono: true });
      line(xs[1] + 46 * s, y, xs[2] - 6, y, C.acc + '55', 1.2);
      line(xs[2], y + 26 * s, xs[2], y - 30 * s, C.acc, 2.5);
      ctx.fillStyle = C.acc; ctx.beginPath(); ctx.moveTo(xs[2] - 14 * s, y + 26 * s); ctx.lineTo(xs[2] + 14 * s, y + 26 * s); ctx.lineTo(xs[2], y + 6 * s); ctx.fill();
    });
    if (beat >= 1) {
      for (let k = 0; k < 4; k++) {
        const r = ((T * 50 + k * 30) % (xs[3] - xs[2] - 50 * s));
        ctx.strokeStyle = `rgba(138,255,221,${0.8 - r / (xs[3] - xs[2]) * 0.8})`; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(xs[2], y - 30 * s, r, -0.5, 0.5); ctx.stroke();
      }
    }
    // Receiver locks satellites one by one on beat 2.
    dimIf(beat < 2, () => {
      box(xs[3] - 50 * s, y - 50 * s, 100 * s, 100 * s, C.text, '#0b1b2c', 8);
      const lockN = beat < 2 ? 0 : Math.min(8, Math.floor((t - BEAT[2]) * 2));
      for (let i = 0; i < 8; i++) {
        const a = i * 0.785 + 0.3, r = (i % 2 ? 26 : 16) * s;
        dot(xs[3] + Math.cos(a) * r, y - 8 * s + Math.sin(a) * r, 3 * s, i < lockN ? (i % 2 ? C.bds : C.gps) : '#2b4a66');
      }
      if (lockN === 8) txt(en ? 'FIX ✓' : '定位 ✓', xs[3], y + 34 * s, { size: 13 * s, color: C.acc, align: 'center', weight: 700 });
    });
    const labels = en ? ['Laptop', 'USRP (UHD)', 'Antenna', 'Receiver'] : ['筆電', 'USRP（UHD）', '天線', '接收機'];
    const subs = en ? ['I/Q stream', 'numbers → RF', 'transmits', 'track · fix'] : ['即時串流 I/Q', '數字 → 射頻', '發射', '捕獲・追蹤・定位'];
    labels.forEach((l, i) => {
      const on = i === 0 || (i < 3 ? beat >= 1 : beat >= 2);
      txt(l, xs[i], y + 70 * s, { size: n ? 12 : 15, color: on ? C.text : '#3c5a78', align: 'center', weight: 700 });
      txt(subs[i], xs[i], y + 92 * s, { size: n ? 10 : 12, color: on ? C.dim : '#2f4a64', align: 'center' });
    });
    caption(beat, en ? [
      'I/Q samples are still just numbers. The laptop streams them live to the SDR.',
      'The SDR (a USRP, driven by UHD) turns those numbers into a radio signal, and the antenna transmits it.',
      'The receiver acquires, tracks and computes a position just as it would outdoors — except every condition is controlled and repeatable in the lab.',
    ] : [
      'I/Q 樣本還只是數字。筆電把它們即時串流給 SDR。',
      'SDR（USRP，經 UHD 驅動）把數字轉成射頻訊號，再由天線發射出去。',
      '接收機就像在戶外一樣捕獲、追蹤衛星並完成定位；差別在於，所有條件都在實驗室裡可控、可重現。',
    ], '');
  }

  const scenes = [sceneEphemeris, scenePropagation, sceneCoding, sceneSynthesis, sceneTransmit];

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    // Narrow stages use a taller virtual canvas so labels stay legible.
    W = r.width < 560 ? 360 : 800;
    H = r.width < 560 ? 510 : 500;
    canvas.style.aspectRatio = `${W} / ${H}`;
    scale = r.width / W;
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.width * H / W * dpr);
  }
  function draw() {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.globalAlpha = ease(t / 0.45);
    scenes[step]();
    ctx.globalAlpha = 1;
  }
  function labels() {
    playBtn.textContent = isEn() ? (playing ? 'Pause Ⅱ' : 'Play ▷') : (playing ? '暫停 Ⅱ' : '播放 ▷');
    playBtn.setAttribute('aria-pressed', String(playing));
    navBtns.forEach(b => { b.textContent = b.dataset.dir < 0 ? (isEn() ? '‹ Back' : '‹ 上一段') : (isEn() ? 'Next ›' : '下一段 ›'); });
    root.classList.toggle('is-paused', !playing);
  }
  function go(i) {
    step = (i + steps.length) % steps.length;
    // Reduced motion shows each scene in its finished state.
    t = reduced.matches ? STEP_S[step] - 1 : 0;
    canvas.style.cursor = step === 1 ? 'grab' : '';
    canvas.tabIndex = step === 1 ? 0 : -1;
    steps.forEach((b, k) => {
      b.setAttribute('aria-expanded', String(k === step));
      b.parentElement.classList.toggle('is-active', k === step);
      b.parentElement.classList.toggle('is-done', k < step);
    });
    count.textContent = `${String(step + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}`;
    labels(); draw();
  }
  // Step 02 is interactive: drag (or arrow keys) moves the satellite along the sky arc.
  function setTheta(clientX) {
    const r = canvas.getBoundingClientRect(), { rx, ax } = propGeom();
    const px = (clientX - r.left) / scale;
    theta = Math.min(172, Math.max(8, Math.acos(Math.min(1, Math.max(-1, (rx - px) / ax))) * 180 / Math.PI));
    if (!dragged) { dragged = true; playing = false; labels(); }
    draw();
  }
  canvas.addEventListener('pointerdown', e => {
    if (step !== 1) return;
    dragging = true; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; setTheta(e.clientX);
  });
  canvas.addEventListener('pointermove', e => { if (dragging) setTheta(e.clientX); });
  const endDrag = () => { dragging = false; if (step === 1) canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('keydown', e => {
    if (step !== 1 || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    theta = Math.min(172, Math.max(8, theta + (e.key === 'ArrowRight' ? 4 : -4)));
    if (!dragged) { dragged = true; playing = false; labels(); }
    draw();
  });
  steps.forEach((b, i) => b.addEventListener('click', () => { playing = false; go(i); }));
  // Back / next walk beat by beat (crossing into the neighbouring step), so nothing has to be rewatched.
  const BEATS_N = [3, 1, 3, 6, 3];
  const beatNow = () => Math.min(BEATS_N[step] - 1, BEAT.reduce((b, s0, i) => t >= s0 ? i : b, 0));
  function seekBeat(dir) {
    playing = false;
    let b = beatNow() + dir;
    if (b >= BEATS_N[step]) { go(step + 1); return; }
    if (b < 0) { go(step - 1); b = BEATS_N[step] - 1; }
    t = BEAT[b] + 0.7;   // past the fade-in, so the beat shows at once
    labels(); draw();
  }
  navBtns.forEach(b => b.addEventListener('click', () => seekBeat(Number(b.dataset.dir))));
  playBtn.addEventListener('click', () => { playing = !playing; if (playing && t >= STEP_S[step]) go(step + 1); labels(); });
  document.addEventListener('languagechange', () => setTimeout(() => { labels(); draw(); }));
  reduced.addEventListener('change', () => { if (reduced.matches) playing = false; go(step); });
  new IntersectionObserver(e => { visible = e[0].isIntersecting; }, { threshold: 0.2 }).observe(canvas);
  new ResizeObserver(() => { resize(); draw(); }).observe(canvas);

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    if (visible && !document.hidden && !reduced.matches) {
      T += dt;
      if (playing) {
        t += dt;
        if (t >= STEP_S[step]) go(step + 1);
      } else {
        // Paused: let the current beat finish animating, but never move on to the next beat or step.
        const b = beatNow(), end = b + 1 < BEATS_N[step] ? BEAT[b + 1] : STEP_S[step];
        t = Math.min(t + dt, Math.max(t, end - 0.01));
      }
      draw();
    }
    timer.style.width = playing ? `${Math.min(100, t / STEP_S[step] * 100)}%` : '0';
    requestAnimationFrame(frame);
  }
  resize(); go(0);
  requestAnimationFrame(now => { last = now; frame(now); });
})();
