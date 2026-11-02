// Project overview page: capability spotlight, chapter scenes and formulas. Helpers come from scene-kit.js.

// Without JavaScript every 'go deeper' section and capability panel stays open; with it they start collapsed.
document.querySelectorAll('details.po-deep[open]').forEach(d => { d.open = false; });

// Core features spotlight: highlight each spec cell in turn; hovering a cell holds it.
// Clicking (or Enter/Space) opens that cell's explanation below the row and pins the highlight.
(() => {
  const cells = [...document.querySelectorAll('.hero-specs > div')];
  const panel = document.getElementById('spec-detail');
  if (cells.length < 2 || !panel) return;
  const articles = [...panel.querySelectorAll('[data-spec-detail]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let active = 0, held = false, open = -1;
  const show = i => { active = i; cells.forEach((c, k) => c.classList.toggle('is-active', k === i)); };
  function setOpen(i) {
    open = i;
    panel.hidden = i < 0;
    articles.forEach((a, k) => { a.hidden = k !== i; });
    cells.forEach((c, k) => c.setAttribute('aria-expanded', String(k === i)));
    if (i >= 0) show(i);
  }
  cells.forEach((c, i) => {
    c.addEventListener('mouseenter', () => { held = true; if (open < 0) show(i); });
    c.addEventListener('mouseleave', () => { held = false; });
    c.addEventListener('click', () => setOpen(open === i ? -1 : i));
    c.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(open === i ? -1 : i); }
    });
  });
  setOpen(-1);
  panel.querySelector('.sd-close').addEventListener('click', () => { const i = open; setOpen(-1); cells[i]?.focus(); });
  setInterval(() => {
    if (held || open >= 0 || reduced.matches || document.hidden) return;
    show((active + 1) % cells.length);
  }, 3200);
  show(0);
})();

// ---------- Chapter animations ----------
(() => {
  const { reduced, isEn, C, RED, arrow, scene } = window.GTScene;

  // 04 Time: GPST and BDT clocks, the receiver's sample axis, and each satellite's transmit time behind it.
  scene('po-time-cv', (g, t, en) => {
    const { W, n } = g;
    const E = window.GT_EPH || {}, sow = (E.sow ?? 187200) + t, cw = n ? (W - 36) / 2 : 250;
    [[en ? 'GPS Time (GPST)' : 'GPS 時間（GPST）', E.gpsWeek ?? 2437, sow, C.gps], [en ? 'BeiDou Time (BDT)' : '北斗時間（BDT）', E.bdsWeek ?? 1081, sow - 14, C.bds]].forEach(([lab, wk, s0, c], i) => {
      const x = 12 + i * (cw + 12), y = 12;
      g.box(x, y, cw, 62, c + '99');
      g.txt(lab, x + 12, y + 18, { size: 12, color: c, weight: 700 });
      g.txt(`${en ? 'wk' : '週'} ${wk} · ${s0.toFixed(3)} s`, x + 12, y + 42, { size: n ? 12 : 15, color: C.text, weight: 700, mono: true });
    });
    if (!n) {
      g.txt('BDT = GPST − 14 s', 548, 30, { size: 13, color: C.acc, weight: 700 });
      g.txt(en ? 'BDS week = GPS week − 1356' : '北斗週 = GPS 週 − 1356', 548, 56, { size: 13, color: C.acc, weight: 700 });
    }
    else g.txt('BDT = GPST − 14 s', W / 2, 92, { size: 12, color: C.acc, weight: 700, align: 'center' });
    // Receiver sample axis.
    const ay = n ? 140 : 132, cx = n ? W - 30 : 700, x0 = 16;
    g.txt(en ? 'Receiver samples' : '接收端樣本', x0, ay - 22, { size: 12, color: C.dim, weight: 700 });
    g.line(x0, ay, W - 10, ay, C.line, 2);
    const step = n ? 12 : 16, off = (t * 40) % step;
    for (let x = W - 10 - off; x > x0; x -= step) g.line(x, ay - 5, x, ay + 5, '#3d6a90', 1.5);
    g.line(cx, ay - 16, cx, ay + 16, C.acc, 2.5);
    g.txt(en ? 'receive time of this sample' : '這個樣本的接收時刻', cx, ay - 26, { size: 12, color: C.acc, align: 'right', weight: 700 });
    // Two satellites, each transmitted earlier by its own travel time.
    const scale = n ? 3.6 : 6;
    [[E.prn || 'G13', +(E.ms ?? 72.2).toFixed(1), C.gps], [E.bds || 'C24', +(E.bdsMs ?? 73.3).toFixed(1), C.bds]].forEach(([id, tau, c], i) => {
      const y = ay + (n ? 80 : 74) + i * (n ? 86 : 70), tx = cx - tau * scale;
      g.txt(`${id} ${en ? 'transmits' : '發射'}`, x0, y - 22, { size: 12, color: c, weight: 700 });
      g.line(x0, y, W - 10, y, c + '55', 2);
      g.line(tx, y - 12, tx, y + 12, c, 2.5);
      g.line(cx, ay + 16, tx, y - 12, '#ffffff33', 1, [4, 4]);
      // A pulse travelling from the transmit point up to the receive cursor.
      const p = ((t * 0.5) + i * 0.4) % 1;
      g.dot(tx + (cx - tx) * p, y + (ay - y) * p, 4, c, 10);
      g.txt(en ? `sent ${tau} ms earlier` : `早 ${tau} ms 發出`, tx + 10, y + 22, { size: 12, color: C.text, weight: 700 });
    });
  });

  // 06 Propagation: the pulse leaves from where the satellite was (ghost) and arrives after it has moved on.
  scene('po-prop-cv', (g, t, en) => {
    const { ctx, W, n } = g;
    const gw = n ? W : 470, ox = gw / 2, oy = n ? 560 : 640, Re = n ? 360 : 440, Rs = n ? 510 : 600;
    const rxp = { x: ox, y: oy - Re };
    ctx.beginPath(); ctx.arc(ox, oy, Re, Math.PI * 1.1, Math.PI * 1.9); ctx.fillStyle = '#123a5c'; ctx.fill();
    ctx.beginPath(); ctx.arc(ox, oy, Rs, Math.PI * 1.15, Math.PI * 1.85);
    ctx.setLineDash([3, 6]); ctx.strokeStyle = C.line; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
    // Satellite sweeps left → right; the arriving pulse left from an earlier position.
    const span = n ? 0.36 : 0.33, ang = th => Math.PI * 1.5 + (th - 0.5) * span * 2;
    const ph = (t * 0.06) % 1, lag = 0.07;
    const pos = th => ({ x: ox + Rs * Math.cos(ang(th)), y: oy + Rs * Math.sin(ang(th)) });
    const now = pos(ph), then = pos(Math.max(0, ph - lag));
    ctx.beginPath(); ctx.arc(then.x, then.y, 13, 0, Math.PI * 2);
    ctx.setLineDash([3, 3]); ctx.strokeStyle = C.acc; ctx.lineWidth = 1.4; ctx.stroke(); ctx.setLineDash([]);
    g.line(then.x, then.y, rxp.x, rxp.y - 14, C.acc + '66', 1.2, [5, 5]);
    const q = (t * 0.9) % 1;
    g.dot(then.x + (rxp.x - then.x) * q, then.y + (rxp.y - 14 - then.y) * q, 4.5, '#fff', 12);
    g.sat(now.x, now.y, C.gps);
    const clampX = x => Math.min(gw - 56, Math.max(56, x));
    g.txt(en ? 'left from here' : '訊號離開時', clampX(then.x), then.y + 24, { size: 11, color: C.acc, align: 'center', weight: 700 });
    g.txt(en ? 'satellite now' : '衛星現在', clampX(now.x), now.y - 22, { size: 11, color: C.gps, align: 'center', weight: 700 });
    ctx.fillStyle = C.acc; ctx.beginPath(); ctx.moveTo(rxp.x - 12, rxp.y + 4); ctx.lineTo(rxp.x + 12, rxp.y + 4); ctx.lineTo(rxp.x, rxp.y - 14); ctx.fill();
    g.txt(en ? '↻ Earth rotates (Sagnac)' : '↻ 地球自轉（Sagnac）', rxp.x, rxp.y + 24, { size: 11, color: C.dim, align: 'center', weight: 700 });
    // Readout from GPS geometry at the current elevation.
    const el = Math.atan2(rxp.y - now.y, Math.abs(now.x - rxp.x));
    const RE = 6371, RS = 26560, c = 299792.458, VMAX = 860, lam = 0.1903;
    const range = Math.sqrt(RS * RS - (RE * Math.cos(el)) ** 2) - RE * Math.sin(el);
    const fd = (now.x < rxp.x ? 1 : -1) * VMAX * Math.cos(el) / lam;
    const sign = fd >= 0 ? '+' : '−';
    const rx = n ? 16 : 500, ry = n ? 262 : 34, lh = n ? 30 : 40, vx = rx + (n ? 368 : 280);
    g.box(rx - 10, ry - 22, vx - rx + 20, lh * 4 + 36, C.line);
    [
      [en ? 'Elevation' : '仰角', `${(el * 180 / Math.PI).toFixed(0)}°`, C.text, false],
      [en ? 'Distance' : '距離', `${Math.round(range).toLocaleString('en-US')} km`, C.text, false],
      [en ? 'Flight time' : '飛行時間', `${(range / c * 1000).toFixed(1)} ms`, C.acc, false],
      [en ? 'Frequency shift' : '頻率偏移', `${sign}${Math.abs(fd / 1000).toFixed(1)} kHz`, fd >= 0 ? C.gps : C.bds, true],
    ].forEach(([kz, v, col, mono], i) => {
      g.txt(kz, rx, ry + i * lh, { size: 13, color: C.dim, weight: 700, mono });
      g.txt(v, vx, ry + i * lh, { size: 16, color: col, weight: 700, mono: true, align: 'right' });
    });
    g.txt(fd >= 0 ? (en ? 'approaching → frequency up' : '靠近中 → 頻率變高') : (en ? 'receding → frequency down' : '遠離中 → 頻率變低'),
      rx, ry + lh * 4 + (n ? 0 : 4), { size: 13, color: fd >= 0 ? C.gps : C.bds, weight: 700 });
  });


  // 06: one LO at the midpoint; the NCO pushes GPS to +7.161 MHz and BeiDou to −7.161 MHz inside a 20.8 Msps band.
  scene('po-eng-spec', (g, t, en) => {
    const { ctx, W, H, n } = g;
    const x0 = 24, x1 = W - 24, base = n ? H - 120 : H - 72, top = n ? 120 : 92, amp = base - top;
    const fx = f => x0 + (f + 12) / 24 * (x1 - x0);
    const cyc = t % 9, k = Math.min(1, cyc / 2.6), ease = 1 - (1 - k) ** 3;
    const win = Math.min(1, Math.max(0, (cyc - 2.8) / 1));
    const sinc2 = u => Math.abs(u) < 1e-6 ? 1 : (Math.sin(Math.PI * u) / (Math.PI * u)) ** 2;
    const gC = 7.161 * ease, bC = -7.161 * ease;
    // Sampling band.
    if (win > 0) {
      ctx.globalAlpha = win;
      ctx.fillStyle = '#8affdd10'; ctx.fillRect(fx(-10.4), top - 26, fx(10.4) - fx(-10.4), amp + 26);
      g.line(fx(-10.4), top - 26, fx(-10.4), base, C.acc + 'aa', 1, [4, 4]);
      g.line(fx(10.4), top - 26, fx(10.4), base, C.acc + 'aa', 1, [4, 4]);
      g.txt(en ? 'Sampling band 20.8 Msps (±10.4 MHz)' : '取樣頻寬 20.8 Msps（±10.4 MHz）', fx(0), top - 14, { size: n ? 10 : 12, color: C.acc, align: 'center', weight: 700 });
      ctx.globalAlpha = 1;
    }
    // Main lobes.
    [[gC, 1.023, 1, C.gps], [bC, 2.046, 0.55, C.bds]].forEach(([c, w, h, col]) => {
      ctx.beginPath(); ctx.moveTo(fx(-12), base);
      for (let f = -12; f <= 12; f += 0.04) {
        const jit = 1 + 0.04 * Math.sin(f * 9 + t * 5);
        ctx.lineTo(fx(f), base - amp * h * sinc2((f - c) / w) * jit);
      }
      ctx.lineTo(fx(12), base); ctx.closePath();
      ctx.fillStyle = col + '30'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
    });
    g.txt('GPS L1 C/A', fx(gC), base - amp - 12, { size: n ? 11 : 13, color: C.gps, align: 'center', weight: 700 });
    g.txt(en ? 'BeiDou B1I' : '北斗 B1I', fx(bC), base - amp * 0.55 - 12, { size: n ? 11 : 13, color: C.bds, align: 'center', weight: 700 });
    // NCO shifts.
    const ay = base + (n ? 34 : 30);
    if (ease > 0.05) {
      arrow(g, fx(0), ay, fx(gC), ay, C.gps); arrow(g, fx(0), ay, fx(bC), ay, C.bds);
      g.txt('NCO +7.161 MHz', fx(gC / 2), ay + 14, { size: n ? 9.5 : 11, color: C.gps, align: 'center', mono: true });
      g.txt('NCO −7.161 MHz', fx(bC / 2), ay + 14, { size: n ? 9.5 : 11, color: C.bds, align: 'center', mono: true });
    }
    // Axis: baseband offset below, RF frequency in brackets.
    g.line(x0, base, x1, base, C.line, 1.2);
    g.line(fx(0), top - 40, fx(0), base + 6, C.text + '88', 1.2, [3, 4]);
    g.txt(`LO 1568.259 MHz`, fx(0), top - 50, { size: n ? 11 : 13, color: C.text, align: 'center', weight: 700, mono: true });
    [[-7.161, '1561.098'], [7.161, '1575.42']].forEach(([f, rf]) => {
      g.line(fx(f), base, fx(f), base + 6, C.dim, 1);
      g.txt(`${rf} MHz`, fx(f), base + (n ? 70 : 64), { size: n ? 9.5 : 11, color: C.dim, align: 'center', mono: true });
    });
    g.txt(en ? 'One complex I/Q stream · one transmit channel' : '一路複數 I/Q · 一個發射通道', W / 2, H - (n ? 14 : 12), { size: n ? 11 : 12, color: C.dim, align: 'center' });
  });

  // 07: three 1 ms blocks, each with its own frequency. Top: phase restarts at every edge. Bottom: phase carried over.
  const PF = [2.6, 3.1, 2.8, 3.4, 2.7, 3.2, 2.9, 3.3], PS = PF.reduce((a, b) => a + b, 0);
  const PRE = PF.map((_, i) => PF.slice(0, i).reduce((a, b) => a + b, 0));
  const cum = b => Math.floor(b / 8) * PS + PRE[b % 8];
  scene('po-eng-phase', (g, t, en) => {
    const { ctx, W, H, n } = g;
    const xs = 16, xe = W - 16, ppb = n ? 150 : 250, scroll = t * 0.45, amp = n ? 34 : 30;
    const rows = n ? [[150, true], [330, false]] : [[115, true], [245, false]];
    // Block edges.
    for (let b = Math.floor(scroll); b <= scroll + (xe - xs) / ppb + 1; b++) {
      const x = xs + (b - scroll) * ppb;
      if (b % 2 === 0) { ctx.fillStyle = '#ffffff06'; ctx.fillRect(Math.max(xs, x), 40, Math.min(ppb, xe - Math.max(xs, x)), H - 60); }
      if (x < xs || x > xe) continue;
      g.line(x, 40, x, H - 20, C.line, 1, [4, 5]);
    }
    g.txt(en ? 'each band = one 1 ms block' : '每一格 = 一個 1 ms 區塊', W - 16, 22, { size: n ? 10 : 11, color: C.dim, align: 'right' });
    rows.forEach(([cy, reset]) => {
      const col = reset ? RED : C.acc;
      g.txt(reset ? (en ? '✗ Phase reset each block → jumps (cycle slip)' : '✗ 每塊重設相位 → 交界跳變，接收機週跳')
                  : (en ? '✓ Phase carried over → continuous' : '✓ 繼承相位、只換頻率 → 波形連續'),
        xs, cy - amp - 22, { size: n ? 11 : 13, color: col, weight: 700 });
      ctx.beginPath();
      for (let x = xs; x <= xe; x += 1) {
        const tau = (x - xs) / ppb + scroll, b = Math.floor(tau), u = tau - b, f = PF[b % 8];
        const ph = 2 * Math.PI * (reset ? f * u : cum(b) + f * u);
        const y = cy - amp * Math.sin(ph);
        const jump = reset && u < (1 / ppb) * 1.01;
        if (x === xs || jump) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
      if (reset) {
        for (let b = Math.ceil(scroll); b <= scroll + (xe - xs) / ppb; b++) {
          const x = xs + (b - scroll) * ppb;
          if (x < xs + 4 || x > xe - 4) continue;
          const a = Math.sin(2 * Math.PI * PF[(b - 1) % 8]), y1 = cy - amp * a;
          g.line(x, y1, x, cy, RED, 2.5);
          ctx.beginPath(); ctx.arc(x, (y1 + cy) / 2, 11, 0, Math.PI * 2); ctx.strokeStyle = RED + 'cc'; ctx.lineWidth = 1.4; ctx.stroke();
        }
      }
    });
  });

  // 08: CPU prepares block n+1 while the GPU synthesises block n; finished blocks fill a ring buffer the SDR drains
  // at a fixed rate. An occasional slow block (jitter) dips the buffer but never empties it.
  {
    let w = 5, r = 0, prog = 0, blk = 5, prevT = 0;
    const hash = i => { const s = Math.sin(i * 127.1) * 43758.5453; return s - Math.floor(s); };
    const dur = i => (i % 9 === 6 ? 2.6 : 0.62 + 0.3 * hash(i));
    scene('po-eng-pipe', (g, t, en) => {
      const { ctx, W, H, n } = g;
      let dt = t - prevT; prevT = t; if (dt < 0 || dt > 0.3) dt = 0;
      const s = dt / 0.55;
      r += s;
      if (w - r < 8) { prog += s / dur(blk); if (prog >= 1) { prog = 0; w++; blk++; } }
      const level = Math.max(0, w - r), slow = dur(blk) > 2;
      // Layout.
      const L = n
        ? { cpu: [12, 46, 182, 74], gpu: [206, 46, 182, 74], cx: 200, cy: 236, R: 74, sdr: [100, 336, 200, 84] }
        : { cpu: [16, 48, 220, 82], gpu: [16, 190, 220, 82], cx: 420, cy: 160, R: 96, sdr: [584, 108, 200, 104] };
      const card = ([x, y, bw, bh], title, sub, p, col) => {
        g.box(x, y, bw, bh, col + '99');
        g.txt(title, x + 12, y + 18, { size: n ? 11 : 13, color: col, weight: 700 });
        g.txt(sub, x + 12, y + 40, { size: n ? 9.5 : 11.5, color: C.text });
        ctx.fillStyle = '#ffffff12'; ctx.fillRect(x + 12, y + bh - 16, bw - 24, 5);
        ctx.fillStyle = col; ctx.fillRect(x + 12, y + bh - 16, (bw - 24) * Math.min(1, p), 5);
      };
      card(L.cpu, 'CPU', en ? `block ${blk + 1}: satellite geometry` : `區塊 ${blk + 1}：衛星幾何`, Math.min(1, prog * 2.2 + 0.15), C.gps);
      card(L.gpu, 'GPU · CUDA Streams', slow ? (en ? `block ${blk}: I/Q — slow (jitter)` : `區塊 ${blk}：I/Q 合成（運算抖動）`) : (en ? `block ${blk}: I/Q synthesis` : `區塊 ${blk}：I/Q 合成`), prog, slow ? C.bds : C.acc);
      // Ring buffer: eight slots; filled slots are blocks written but not yet sent.
      const { cx, cy, R } = L;
      for (let i = 0; i < 8; i++) {
        const a0 = -Math.PI / 2 + i * Math.PI / 4 + 0.05, a1 = a0 + Math.PI / 4 - 0.1;
        let fill = 0;
        for (let kb = Math.floor(r); kb < w; kb++) if (((kb % 8) + 8) % 8 === i) fill = kb === Math.floor(r) ? 1 - (r - kb) : 1;
        ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.arc(cx, cy, R - 20, a1, a0, true); ctx.closePath();
        ctx.fillStyle = '#ffffff0d'; ctx.fill();
        if (fill > 0) { ctx.globalAlpha = 0.35 + 0.65 * fill; ctx.fillStyle = C.acc; ctx.fill(); ctx.globalAlpha = 1; }
      }
      const ptr = (v, col, lab) => {
        const a = -Math.PI / 2 + (v % 8) * Math.PI / 4;
        g.line(cx + Math.cos(a) * (R - 30), cy + Math.sin(a) * (R - 30), cx + Math.cos(a) * (R + 8), cy + Math.sin(a) * (R + 8), col, 2.2);
        g.txt(lab, cx + Math.cos(a) * (R + 22), cy + Math.sin(a) * (R + 22), { size: n ? 9 : 10.5, color: col, align: 'center', weight: 700 });
      };
      ptr(w + prog, C.bds, en ? 'write' : '寫入');
      ptr(r, C.gps, en ? 'read' : '讀出');
      g.txt('Ring Buffer', cx, cy - 8, { size: n ? 11 : 13, color: C.text, align: 'center', weight: 700 });
      g.txt(`${level.toFixed(1)} / 8`, cx, cy + 14, { size: n ? 12 : 14, color: level < 2 ? C.bds : C.acc, align: 'center', weight: 700, mono: true });
      // Flow arrows.
      if (n) { arrow(g, 103, 122, cx - R * 0.6, cy - R * 0.85, C.dim); arrow(g, 297, 122, cx + R * 0.55, cy - R * 0.88, C.dim); arrow(g, cx, cy + R + 4, cx, 334, C.dim); }
      else { arrow(g, 126, 132, 126, 186, C.dim); arrow(g, 238, 231, cx - R - 8, cy + 30, C.dim); arrow(g, cx + R + 8, cy, 582, cy, C.dim); }
      // SDR: transmits continuously.
      const [sx, sy, sw, sh] = L.sdr;
      g.box(sx, sy, sw, sh, C.acc + '99');
      g.txt('SDR · UHD', sx + 12, sy + 18, { size: n ? 11 : 13, color: C.acc, weight: 700 });
      g.txt('underrun (U): 0', sx + 12, sy + 42, { size: n ? 10 : 12, color: C.text, mono: true });
      g.txt(en ? 'end-to-end < 0.1 s' : '端到端延遲 < 0.1 s', sx + 12, sy + 64, { size: n ? 10 : 12, color: C.text });
      for (let i = 0; i < 3; i++) {
        const ph = ((t * 1.4 + i / 3) % 1);
        ctx.beginPath(); ctx.arc(sx + sw - 26, sy + 24, 6 + ph * 18, -0.9, 0.9);
        ctx.strokeStyle = `rgba(138,255,221,${0.8 * (1 - ph)})`; ctx.lineWidth = 1.5; ctx.stroke();
      }
    });
  }

  // 09: a pseudorange bias is injected into one satellite; its residual grows past the RAIM threshold, the receiver
  // flags it, excludes it, and the position returns to the truth.
  scene('po-eng-raim', (g, t, en) => {
    const { ctx, W, H, n } = g;
    const p = t % 11, BAD = 2, THR = 0.6;
    const bias = p < 2 ? 0 : p < 5 ? (p - 2) / 3 : p < 9.5 ? 1 : 0;
    const out = p >= 6 && p < 9.5, flagged = (p >= 2 && p < 6);
    const sats = [['G05', 160], ['G13', 128], ['C23', 100], ['G21', 70], ['C32', 44], ['G27', 18]];
    // Sky.
    const rx = n ? W / 2 : 210, ry = n ? 214 : H - 40, R = n ? 150 : 200;
    ctx.beginPath(); ctx.arc(rx, ry, R, Math.PI, 0); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]);
    sats.forEach(([id, deg], i) => {
      const a = deg * Math.PI / 180, x = rx + Math.cos(a) * R * 0.92, y = ry - Math.sin(a) * R * 0.92;
      const bad = i === BAD && bias > 0, gone = i === BAD && out;
      const col = gone ? '#4b6680' : bad ? RED : id[0] === 'G' ? C.gps : C.bds;
      g.line(x, y, rx, ry, gone ? '#33475c' : bad ? RED : col + '77', bad ? 1.8 : 1.1, bad || gone ? [5, 5] : []);
      g.sat(x, y, col);
      g.txt(id, x, y - 16, { size: n ? 10 : 11, color: col, align: 'center', weight: 700, mono: true });
      if (bad && !gone) g.txt(en ? '+ range bias' : '＋偽距偏差', (x + rx) / 2 + 8, (y + ry) / 2, { size: n ? 10 : 11, color: RED, weight: 700 });
      if (gone) g.txt(en ? '✕ excluded' : '✕ 已剔除', x, y + 20, { size: n ? 10 : 11, color: '#9fb4c8', align: 'center', weight: 700 });
    });
    // Receiver: true position (ring) and solution (dot).
    const off = out ? 0 : bias * (n ? 26 : 34);
    ctx.beginPath(); ctx.arc(rx, ry, 9, 0, Math.PI * 2); ctx.strokeStyle = C.acc; ctx.lineWidth = 1.5; ctx.stroke();
    g.dot(rx + off, ry - off * 0.4, 4.5, off > 3 ? RED : C.acc, 8);
    if (off > 3) g.txt(en ? 'position error' : '定位誤差', rx + off + 10, ry - off * 0.4 - 10, { size: n ? 10 : 11, color: RED });
    // Residual bars.
    const bx = n ? 30 : 470, bw = n ? W - 60 : 300, by = n ? H - 30 : H - 60, bh = n ? 120 : 170;
    g.txt(en ? 'RAIM residual per satellite' : '各衛星 RAIM 殘差', bx, by - bh - 22, { size: n ? 11 : 13, color: C.text, weight: 700 });
    const ty = by - THR * bh;
    g.line(bx - 4, ty, bx + bw, ty, RED + 'aa', 1, [5, 4]);
    g.txt(en ? 'threshold' : '門檻', bx + bw, ty - 10, { size: n ? 9.5 : 10.5, color: RED, align: 'right' });
    sats.forEach(([id], i) => {
      const gone = i === BAD && out;
      let res = 0.16 + 0.07 * Math.sin(t * 1.3 + i * 1.7);
      if (!out) res += i === BAD ? bias * 0.72 : bias * 0.1;
      const x = bx + i * (bw / 6) + 6, cw = bw / 6 - 12, hgt = Math.min(1, res) * bh;
      ctx.fillStyle = gone ? '#2a3b4d' : res > THR ? RED : C.acc + 'bb';
      ctx.fillRect(x, by - hgt, cw, hgt);
      g.txt(id, x + cw / 2, by + 12, { size: n ? 9 : 10, color: C.dim, align: 'center', mono: true });
    });
    // Status line.
    const st = p < 2 ? (en ? 'Normal: every residual is under the threshold' : '正常：殘差都在門檻內')
      : p < 5.2 ? (en ? 'Injecting: C23 pseudorange drifts away' : '注入：C23 偽距逐步偏移')
      : p < 6 ? (en ? 'RAIM: residual over threshold → fault detected' : 'RAIM：殘差超過門檻 → 偵測到異常')
      : p < 9.5 ? (en ? 'C23 excluded → position back on the truth' : '剔除 C23 → 定位回到正確位置')
      : (en ? 'Reset' : '重置');
    g.txt(st, n ? W / 2 : 16, n ? 26 : 24, { size: n ? 12 : 14, color: flagged ? RED : C.acc, weight: 700, align: n ? 'center' : 'left' });
  });


  // 01: what the three ways to test cost, in USD on a log scale.
  {
    const COST = [
      { zh: '戶外實測', en: 'Outdoor test', lo: 100, hi: 5000, col: '#9fb4c8', note: ['接收機＋天線，消費級到測量級；外出人力與時間另計', 'Receiver + antenna, consumer to survey grade; travel and time extra'] },
      { zh: '傳統硬體模擬器', en: 'Hardware simulator', lo: 20000, hi: 500000, col: C.gps, note: ['依星系、頻點與通道數，依廠商報價', 'Depends on systems, bands and channels; vendor quote'] },
      { zh: 'GeoTrust', en: 'GeoTrust', lo: 3800, hi: 5500, col: C.acc, note: ['USRP B210 約 US$3,000＋電腦（依 GPU 等級）', 'USRP B210 about US$3,000 + a computer (by GPU tier)'] },
    ];
    const fmt = v => v >= 1e6 ? `${v / 1e6}M` : v >= 1000 ? `${v / 1000}k` : String(v);
    scene('po-why-cv', (g, t, en) => {
      const { ctx, W, H, n } = g;
      const grow = Math.min(1, t / 1.4), e = 1 - (1 - grow) ** 3;
      g.txt(en ? 'Equipment cost (USD, log scale)' : '設備成本（美金，對數刻度）', 14, 24, { size: n ? 14 : 16, color: C.text, weight: 700 });
      const x0 = n ? 14 : 190, x1 = W - (n ? 14 : 30), L = Math.log10, X = v => x0 + (x1 - x0) * (L(v) - 2) / (L(1e6) - 2);
      [100, 1000, 10000, 100000, 1000000].forEach(v => {
        g.line(X(v), 50, X(v), H - 34, '#1d3650', 1);
        g.txt('US$' + fmt(v), X(v), H - 18, { size: n ? 10 : 12, color: C.dim, align: v === 100 ? 'left' : v === 1e6 ? 'right' : 'center', mono: true });
      });
      COST.forEach((c, i) => {
        const y = n ? 82 + i * 90 : 76 + i * 78;
        if (n) g.txt(en ? c.en : c.zh, x0, y - 22, { size: 14, color: c.col, weight: 700 });
        else g.txt(en ? c.en : c.zh, 14, y, { size: 15, color: c.col, weight: 700 });
        const a = X(c.lo), b = X(c.lo) + (X(c.hi) - X(c.lo)) * e;
        ctx.fillStyle = c.col + '33'; ctx.fillRect(a, y - 13, Math.max(4, b - a), 26);
        ctx.fillStyle = c.col; ctx.fillRect(a, y - 13, 3, 26); ctx.fillRect(b - 3, y - 13, 3, 26);
        if (grow > 0.9) {
          const label = `US$${c.lo.toLocaleString('en-US')} – ${c.hi.toLocaleString('en-US')}${c.hi >= 500000 ? '+' : ''}`, roomy = b + 10 < x1 - (n ? 150 : 210);
          g.txt(label, roomy ? b + 10 : a, roomy ? y : y - 24, { size: n ? 12 : 14, color: C.text, weight: 700, mono: true });
          g.txt(en ? c.note[1] : c.note[0], a, y + (n ? 26 : 24), { size: n ? 10.5 : 12, color: C.dim });
        }
      });
    }, { h: 360, nh: 520 });
  }

  // 02: where a scenario starts. The usual command-line loop with a prepared NMEA file, next to drawing the path in the GUI.
  scene('po-gui-cv', (g, t, en) => {
    const { ctx, W, H, n } = g;
    const local = t % 12;
    // How a dynamic scenario is set up: the usual command-line loop vs drawing the path in the GUI.
    const half = n ? H / 2 : W / 2;
    const boxes = en ? ['Write an NMEA file', 'Make the motion physical (walk / drive)', 'Load it from the command line', 'Run, check, edit again'] : ['寫好 NMEA 檔', '做成符合人走、車行的物理運動', '在命令列載入', '跑一次、檢查、再修改'];
    const lx = 14, ly = n ? 40 : 48, bw = n ? W - 28 : half - 40, bh = n ? 30 : 40;
    g.txt(en ? 'Typical SDR simulators' : '一般 SDR 模擬工具', lx, n ? 18 : 22, { size: n ? 13 : 15, color: C.bds, weight: 700 });
    const hot = Math.floor(local * 1.1) % 4;
    boxes.forEach((s, i) => {
      const y = ly + i * (bh + (n ? 8 : 14));
      g.box(lx, y, bw, bh, i === hot ? C.bds : '#2f5577');
      g.txt(`${i + 1}  ${s}`, lx + 12, y + bh / 2, { size: n ? 11.5 : 13.5, color: i === hot ? '#fff' : C.text, weight: i === hot ? 700 : 500 });
    });
    const loopY0 = ly + bh / 2, loopY1 = ly + 3 * (bh + (n ? 8 : 14)) + bh / 2;
    g.line(lx + bw + 10, loopY1, lx + bw + 20, loopY1, C.bds, 1.4); g.line(lx + bw + 20, loopY1, lx + bw + 20, loopY0, C.bds, 1.4);
    arrow(g, lx + bw + 20, loopY0, lx + bw + 6, loopY0, C.bds);
    g.txt(en ? 'repeat' : '反覆', lx + bw + 24, (loopY0 + loopY1) / 2, { size: 11, color: C.bds, weight: 700 });
    // GeoTrust: draw the path, signals follow.
    const rx = n ? 14 : half + 20, ry = n ? H / 2 + 20 : 48, rw = n ? W - 28 : half - 34, rh = n ? H / 2 - 40 : H - 70;
    g.txt(en ? 'GeoTrust: draw it in the GUI' : 'GeoTrust：在 GUI 直接畫路徑', rx, ry - (n ? 6 : 26), { size: n ? 13 : 15, color: C.acc, weight: 700 });
    g.box(rx, ry, rw, rh, C.acc + '88');
    ctx.strokeStyle = '#1d3650'; ctx.lineWidth = 1;
    for (let x = rx + 20; x < rx + rw; x += 28) g.line(x, ry + 6, x, ry + rh - 6, '#16304a', 1);
    for (let y = ry + 20; y < ry + rh; y += 28) g.line(rx + 6, y, rx + rw - 6, y, '#16304a', 1);
    const P = u => [rx + 30 + (rw - 60) * u, ry + rh * 0.62 - Math.sin(u * Math.PI * 1.6) * rh * 0.3];
    const drawn = Math.min(1, (local % 6) / 3);
    ctx.beginPath(); for (let u = 0; u <= drawn; u += 0.01) { const [x, y] = P(u); u ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = C.acc; ctx.lineWidth = 3; ctx.stroke();
    const [cx, cy] = P(drawn); g.dot(cx, cy, 6, '#fff', 12);
    g.txt(drawn < 1 ? (en ? 'drawing the route…' : '畫出路徑中…') : (en ? 'signals follow the path live' : '訊號即時跟著路徑走'), rx + 12, ry + rh - 14, { size: n ? 11.5 : 13, color: C.acc, weight: 700 });
  }, { h: 340, nh: 560 });

  // 02: the six stations, told like the homepage walkthrough: one stage, a caption that explains it, and tabs, back,
  // play and next. The stage shows what happens to G13 at the selected station; nothing has to be watched to the end.
  {
    const ST = [
      { hw: 'CPU', zh: ['現在是幾點？', '接收端的樣本時刻是 04:00:00 GPS 時間（台灣約中午 12:00）。往回扣掉飛行時間，就是 G13 發出這段訊號的時刻。'],
        en: ['What time is it?', 'The receiver sample time is 04:00:00 GPS time (about noon in Taiwan). Step back by the flight time to get when G13 sent this piece of signal.'], go: 'time' },
      { hw: 'CPU', zh: ['那一刻，G13 在哪裡？', '把時刻代入 G13 的廣播星曆：它在高科大上空、仰角 {el}，正在升起。'],
        en: ['Where is G13 at that moment?', 'Put the time into G13’s broadcast ephemeris: it is above NKUST at {el} elevation and rising.'], go: 'orbit' },
      { hw: 'CPU', zh: ['訊號要飛多久？', '距離 {km}，訊號要飛 {ms}；G13 正在靠近，頻率略為偏高。'],
        en: ['How long does the signal fly?', '{km} away, so it flies {ms}; G13 is approaching, so the frequency is slightly high.'], go: 'propagation' },
      { hw: 'GPU', zh: ['G13 的訊號長什麼樣？', '導航電文 × G13 專屬的 PRN 碼 × 載波。延遲決定碼從哪裡開始，頻移決定載波轉多快。'],
        en: ['What does G13’s signal look like?', 'Navigation data × G13’s own PRN code × the carrier. The delay sets where the code starts; the shift sets how fast the carrier turns.'], go: 'signal' },
      { hw: 'GPU', zh: ['其他衛星呢？', '所有看得到的 GPS 與北斗衛星各占一個通道，在同一個瞬間相加成一路 I/Q。'],
        en: ['What about the other satellites?', 'Every visible GPS and BeiDou satellite gets a channel; all are added in the same instant into one I/Q stream.'], go: 'synthesis' },
      { hw: 'SDR', zh: ['怎麼不間斷地送出？', '每 1 ms 的樣本必須在 1 ms 內算完，經過緩衝準時送進 SDR，變成真正的電波。'],
        en: ['How does it go out without a gap?', 'Each 1 ms of samples must be done within 1 ms and sent through a buffer to the SDR on time, becoming a real radio signal.'], go: 'realtime' },
    ];
    const DUR = 7;
    const curStation = () => cur;
    let cur = 0, playing = !reduced.matches, start = 0, now = 0;
    const root = document.getElementById('pj4');
    const tabs = root ? [...root.querySelectorAll('.pj4-tabs button')] : [];
    const playBtn = root?.querySelector('.pj4-play'), go = root?.querySelector('.pj4-go');
    const fill = s => {
      const E = window.GT_EPH || {};
      return s.replace('{el}', `${(E.el ?? 45.2).toFixed(1)}°`).replace('{km}', `${(E.km ?? 21641).toLocaleString('en-US')} km`).replace('{ms}', `${(E.ms ?? 72.2).toFixed(1)} ms`);
    };
    const render = () => {
      if (!root) return;
      const en = isEn();
      tabs.forEach((b, i) => { b.setAttribute('aria-selected', String(i === cur)); b.classList.toggle('is-done', i < cur); });
      playBtn.textContent = en ? (playing ? 'Pause Ⅱ' : 'Play ▷') : (playing ? '暫停 Ⅱ' : '播放 ▷');
      playBtn.setAttribute('aria-pressed', String(playing));
      go.href = '#' + ST[cur].go;
      go.textContent = en ? `Station ${cur + 1} in depth ↓` : `深入第${'一二三四五六'[cur]}站 ↓`;
    };
    const goTo = (i, stop) => { cur = (i + 6) % 6; start = now; if (stop) playing = false; render(); };
    tabs.forEach((b, i) => b.addEventListener('click', () => goTo(i, true)));
    root?.querySelector('.pj4-prev').addEventListener('click', () => goTo(cur - 1, true));
    root?.querySelector('.pj4-next').addEventListener('click', () => goTo(cur + 1, true));
    playBtn?.addEventListener('click', () => { playing = !playing; start = now; render(); });
    document.addEventListener('languagechange', () => setTimeout(render));
    render();
    // Wrap a caption to a width, by words in English and by characters in Chinese.
    function wrap(g, s, x, y, maxW, lh, size, color, weight = 500) {
      const { ctx, n } = g, px = size * (n ? 1.15 : 1.1);
      ctx.font = `${weight} ${px}px 'Noto Sans TC',sans-serif`;
      const parts = /[\u3400-\u9fff]/.test(s) ? [...s] : s.split(/(?<= )/);
      let line = '', yy = y;
      for (const p of parts) {
        if (ctx.measureText(line + p).width > maxW && line) { g.txt(line.trimEnd(), x, yy, { size, color, weight }); line = p.trimStart(); yy += lh; }
        else line += p;
      }
      if (line) g.txt(line, x, yy, { size, color, weight });
      return yy;
    }
    // Each station is laid out for the short stage it gets: the drawing on the left, the key value on the right
    // (stacked on phones), with every label placed in its own space.
    function stage(g, t, en, e, W, H) {
      const { ctx, n } = g;
      const E = window.GT_EPH || {}, el = E.el ?? 45.2, ms = E.ms ?? 72.2, km = E.km ?? 21641;
      const vx = n ? W / 2 : W * 0.8, vy = n ? H - 44 : H / 2 - 10;
      const value = (big, small, col = C.acc) => {
        g.txt(big, vx, vy, { size: n ? 24 : 30, color: col, align: 'center', weight: 700, mono: true });
        if (small) g.txt(small, vx, vy + (n ? 24 : 30), { size: n ? 12 : 14, color: C.dim, align: 'center', weight: 600 });
      };
      if (!n) g.line(W * 0.64, 24, W * 0.64, H - 24, '#1d3650', 1);
      const earth = (x, y, r) => {
        const gr = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        gr.addColorStop(0, '#2c74a8'); gr.addColorStop(1, '#0e2c4a');
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = gr; ctx.fill();
      };
      const cur = curStation();
      if (cur === 0) {
        // Two clocks, 72 ms apart.
        const r = n ? 42 : 50, cy = n ? 76 : H / 2 - 10, xs = n ? [W * 0.24, W * 0.76] : [W * 0.14, W * 0.46];
        [[xs[0], en ? 'G13 sends' : 'G13 發射', C.gps, ms], [xs[1], en ? 'receiver gets it' : '接收機收到', C.acc, 0]].forEach(([x, lab, col, back]) => {
          ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
          for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.line(x + Math.cos(a) * r * 0.84, cy + Math.sin(a) * r * 0.84, x + Math.cos(a) * r, cy + Math.sin(a) * r, col + '88', 1.4); }
          const a = -Math.PI / 2 + ((t * 0.5 - back / 1000 * 30) % 1) * Math.PI * 2;
          g.line(x, cy, x + Math.cos(a) * r * 0.76, cy + Math.sin(a) * r * 0.76, col, 2.4);
          g.txt(lab, x, cy + r + 18, { size: 14, color: col, align: 'center', weight: 700 });
        });
        arrow(g, xs[0] + r + 10, cy, xs[1] - r - 10, cy, '#d9bf8c');
        g.txt(`${ms.toFixed(1)} ms`, (xs[0] + xs[1]) / 2, cy - 14, { size: 13, color: '#d9bf8c', align: 'center', weight: 700, mono: true });
        value('04:00:00', en ? 'GPS time of the sample' : '這個樣本的 GPS 時間');
      } else if (cur === 1) {
        // Orbit, G13 moving into place, and the line of sight from NKUST.
        const R = n ? 40 : 46, ox = n ? W / 2 : W * 0.3, oy = n ? 100 : H / 2 + 12;
        ctx.beginPath(); ctx.ellipse(ox, oy, R * 2.6, R * 1.05, -0.3, 0, Math.PI * 2); ctx.strokeStyle = C.gps + '66'; ctx.lineWidth = 1.4; ctx.stroke();
        earth(ox, oy, R);
        const a = -2.4 + e * 1.6, ca = Math.cos(-0.3), sa = Math.sin(-0.3);   // ends up and to the right, clear of NKUST
        const ex = Math.cos(a) * R * 2.6, ey = Math.sin(a) * R * 1.05, sx = ox + ex * ca - ey * sa, sy = oy + ex * sa + ey * ca;
        const nx = ox + R * 0.45, ny = oy - R * 0.9;
        g.line(nx, ny, sx, sy, '#8affdd88', 1.2, [4, 4]);
        g.dot(nx, ny, 4, C.acc, 8);
        g.txt('NKUST', nx + 10, ny + 4, { size: 12, color: C.acc, weight: 700 });
        g.sat(sx, sy, C.gps); g.txt('G13', sx, sy - 16, { size: 12, color: C.gps, align: 'center', weight: 700, mono: true });
        value(`${el.toFixed(1)}°`, en ? 'elevation above NKUST, rising' : '高科大上空的仰角・正在升起');
      } else if (cur === 2) {
        // A pulse crossing from G13 to the receiver.
        const sx = n ? W - 60 : W * 0.5, sy = 30, rx = n ? 50 : W * 0.08, ry = n ? 150 : H - 34;
        g.sat(sx, sy, C.gps); g.txt('G13', sx + 28, sy, { size: 12, color: C.gps, weight: 700, mono: true });
        ctx.fillStyle = C.text; ctx.beginPath(); ctx.moveTo(rx - 10, ry + 8); ctx.lineTo(rx + 10, ry + 8); ctx.lineTo(rx, ry - 10); ctx.fill();
        g.txt(en ? 'receiver' : '接收機', rx + 18, ry + 2, { size: 13, color: C.dim, weight: 600 });
        g.line(sx, sy, rx, ry, '#ffffff33', 1.2, [4, 5]);
        const p = (t * 0.5) % 1; g.dot(sx + (rx - sx) * p, sy + (ry - sy) * p, 6, '#fff', 14);
        g.txt(`${km.toLocaleString('en-US')} km`, (sx + rx) / 2 + 14, (sy + ry) / 2 - 12, { size: 13, color: C.text, weight: 700, mono: true });
        value(`${ms.toFixed(1)} ms`, en ? 'flight time' : '訊號的飛行時間');
      } else if (cur === 3) {
        // data × code × carrier = signal, one row each.
        const x0 = n ? 92 : 140, x1 = n ? W - 14 : W * 0.6, span = x1 - x0, sc = t * 0.05, rh = n ? 34 : (H - 24) / 4;
        const d = u => (Math.floor(u * 2) % 2 ? -1 : 1), c = u => (Math.sin(Math.floor(u * 22) * 12.9898) * 43758.5 % 1 + 1) % 1 > 0.5 ? 1 : -1, k = u => Math.cos(u * 55);
        const rows = [[en ? 'data' : '導航電文', C.pur, d], [en ? '× PRN code' : '× PRN 碼', C.gps, c], [en ? '× carrier' : '× 載波', C.bds, k], [en ? '= signal' : '= 訊號', C.acc, u => d(u) * c(u) * k(u)]];
        rows.forEach(([lab, col, f], i) => {
          const y = 18 + rh * i + rh / 2;
          g.txt(lab, x0 - 12, y, { size: 13, color: col, align: 'right', weight: 700 });
          ctx.beginPath();
          for (let j = 0; j <= span; j += 2) { const v = f(sc + j / span); j ? ctx.lineTo(x0 + j, y - v * rh * 0.32) : ctx.moveTo(x0 + j, y - v * rh * 0.32); }
          ctx.strokeStyle = col; ctx.lineWidth = i === 3 ? 2 : 1.5; ctx.stroke();
        });
        if (!n) value(en ? 'BPSK' : '三層相乘', en ? 'data × code × carrier' : '電文 × 碼 × 載波');
      } else if (cur === 4) {
        // Satellites converge into one Σ.
        const sats = [[0.06, C.gps, 'G13'], [0.18, C.gps, 'G05'], [0.3, C.bds, 'C23'], [0.42, C.gps, 'G21'], [0.54, C.bds, 'C32']];
        const sx = n ? W / 2 : W * 0.3, sy = n ? 140 : H - 40, top = 34;
        sats.forEach(([fx, col, id], i) => {
          const x = n ? 30 + i * (W - 60) / 4 : W * fx, y = top;
          g.sat(x, y, col); g.txt(id, x, y - 16, { size: 11, color: col, align: 'center', weight: 700, mono: true });
          g.line(x, y + 8, sx, sy - 20, col + '55', 1.2);
          const p = ((t * 0.6) + i / 5) % 1; g.dot(x + (sx - x) * p, y + 8 + (sy - 20 - y - 8) * p, 3, col, 6);
        });
        ctx.beginPath(); ctx.arc(sx, sy, 18, 0, Math.PI * 2); ctx.fillStyle = '#04211c'; ctx.fill(); ctx.strokeStyle = C.acc; ctx.lineWidth = 2; ctx.stroke();
        g.txt('Σ', sx, sy + 1, { size: 18, color: C.acc, align: 'center', weight: 700 });
        if (!n) value(en ? 'one I/Q' : '一路 I/Q', en ? 'all channels added in one instant' : '所有通道在同一瞬間相加');
        else g.txt(en ? 'one I/Q stream' : '一路 I/Q', sx + 28, sy, { size: 13, color: C.acc, weight: 700 });
      } else {
        // 1 ms blocks streaming into the SDR, which radiates without a gap.
        const y = n ? 80 : H / 2 - 4, bw = n ? 34 : 50, ax = n ? W - 70 : W * 0.52;
        const off = (t * 50) % (bw + 8);
        ctx.save(); ctx.beginPath(); ctx.rect(14, y - 20, ax - 60, 40); ctx.clip();
        for (let x = 14 - off; x < ax - 40; x += bw + 8) {
          ctx.fillStyle = '#8affdd26'; ctx.fillRect(x, y - 16, bw, 32); ctx.strokeStyle = C.acc; ctx.lineWidth = 1; ctx.strokeRect(x, y - 16, bw, 32);
          g.txt('1 ms', x + bw / 2, y, { size: 11, color: C.acc, align: 'center', mono: true });
        }
        ctx.restore();
        g.box(ax - 40, y - 22, 62, 44, C.acc);
        g.txt('SDR', ax - 9, y, { size: 14, color: C.acc, align: 'center', weight: 700, mono: true });
        g.line(ax + 12, y - 22, ax + 22, y - 52, C.acc, 2);
        for (let j = 0; j < 3; j++) { const p = (t * 1.1 + j / 3) % 1; ctx.beginPath(); ctx.arc(ax + 22, y - 52, 6 + p * 30, -1.2, 0.3); ctx.strokeStyle = `rgba(138,255,221,${1 - p})`; ctx.lineWidth = 1.6; ctx.stroke(); }
        value('≤ 1 ms', en ? 'every block, on time' : '每個區塊都準時送出');
      }
    }
    scene('po-journey-cv', (g, t, en) => {
      const { ctx, W, H, n } = g;
      now = t;
      if (playing && t - start > DUR) goTo(cur + 1, false);
      const local = t - start, k = Math.min(1, local / 1.2), e = 1 - (1 - k) ** 3;
      const bar = root?.querySelector('.pj4-progress i');
      if (bar) bar.style.transform = `scaleX(${playing ? Math.min(1, local / DUR) : 0})`;
      const SH = Math.round(H * (n ? 0.56 : 0.62));
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, SH); ctx.clip();
      stage(g, t, en, e, W, SH);
      ctx.restore();
      // Caption: the station's question, its answer for G13, and who runs it.
      const cx = n ? 12 : 20, cw = W - cx * 2, cy = SH + 8, ch = H - cy - 10;
      g.box(cx, cy, cw, ch, '#2f5577');
      for (let i = 0; i < 6; i++) g.dot(cx + 18 + i * 14, cy + 18, 4, i <= cur ? C.acc : '#2b4a66');
      g.txt(`${ST[cur].hw}`, cx + cw - 14, cy + 18, { size: 11, color: '#d9bf8c', align: 'right', weight: 700, mono: true });
      const d = en ? ST[cur].en : ST[cur].zh;
      ctx.globalAlpha = k;
      g.txt(`${cur + 1}. ${d[0]}`, cx + 16, cy + (n ? 44 : 40), { size: n ? 15 : 17, color: '#fff', weight: 700 });
      wrap(g, fill(d[1]), cx + 16, cy + (n ? 74 : 68), cw - 32, n ? 22 : 24, n ? 13 : 14.5, C.text);
      ctx.globalAlpha = 1;
    }, { h: 330, nh: 480 });
  }

  // 04: ephemeris → position → sky. Left: G13's real broadcast parameters. Middle: the time put in gives a point on the
  // orbit. Right: that point seen from NKUST, as a direction and a height. Every value comes from the same data file.
  {
    const RE = 6378137, D = Math.PI / 180, WE = 7.2921151467e-5;
    const LAT = 22.75843215402263 * D, LON = 120.33823886027615 * D, T0 = 4 * 3600, SPAN = 4 * 3600, STEP = 120;
    const up = [Math.cos(LAT) * Math.cos(LON), Math.cos(LAT) * Math.sin(LON), Math.sin(LAT)];
    const east = [-Math.sin(LON), Math.cos(LON), 0], north = [-Math.sin(LAT) * Math.cos(LON), -Math.sin(LAT) * Math.sin(LON), Math.cos(LAT)];
    const SITE = up.map(v => v * RE), dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    let tracks = null, orbit = null, hero = null, eph = null, prn = 'G13', date = '';
    const near = (list, t) => list.reduce((b, r) => Math.abs(t - r[0]) < Math.abs(t - b[0]) ? r : b, list[0]);
    function build(data) {
      prn = (window.GT_EPH && window.GT_EPH.prn) || 'G13'; date = data.date;
      const at = (sys, num, list, t) => { const r = near(list, t); return GnssOrbit.position(GnssOrbit.fromRecord(sys, num, r.slice(1)), t - r[0]); };
      const look = p => { const d = p.map((v, i) => v - SITE[i]), r = Math.hypot(...d); return [Math.atan2(dot3(d, east), dot3(d, north)), Math.asin(dot3(d, up) / r) / D]; };
      tracks = [];
      for (const [id, list] of Object.entries(data.sats)) {
        const sys = id[0]; if (sys !== 'G' && sys !== 'C') continue;
        const num = +id.slice(1);
        if (GnssOrbit.fromRecord(sys, num, list[0].slice(1)).kind === 'GEO') continue;
        const pts = [];
        for (let s = -SPAN / 2; s <= SPAN / 2; s += STEP) pts.push(look(at(sys, num, list, T0 + s)));
        tracks.push({ id, sys, pts });
      }
      const list = data.sats[prn];
      if (!list) return;
      eph = GnssOrbit.fromRecord('G', +prn.slice(1), near(list, T0).slice(1));
      orbit = []; hero = [];
      for (let s = 0; s <= 43200; s += 600) {
        const p = at('G', +prn.slice(1), list, T0 + s), th = WE * s;
        orbit.push([p[0] * Math.cos(th) - p[1] * Math.sin(th), p[0] * Math.sin(th) + p[1] * Math.cos(th), p[2]]);
      }
      for (let s = -SPAN / 2; s <= SPAN / 2; s += STEP) hero.push(at('G', +prn.slice(1), list, T0 + s));
    }
    const tryBuild = () => { if (!tracks && window.GT_DATA && window.GnssOrbit) build(window.GT_DATA); };
    document.addEventListener('gt-eph', tryBuild);

    scene('po-orbit-cv', (g, t, en) => {
      const { ctx, W, H, n } = g;
      tryBuild();
      const N = tracks ? tracks[0].pts.length : 1, idx = Math.round(((t * 0.03) % 1) * (N - 1)), secs = -SPAN / 2 + idx * STEP, clock = T0 + secs;
      const hh = Math.floor(clock / 3600), mm = Math.floor(clock % 3600 / 60), pad = v => String(v).padStart(2, '0');
      const cols = n ? [[0, 0, W, 250], [0, 280, W, 260], [0, 570, W, 330]] : [[0, 0, 250, H], [276, 0, 250, H], [552, 0, 248, H]];
      // Panel 1: the ephemeris.
      const [ax, ay, aw] = cols[0];
      g.txt(en ? `① ${prn} broadcast ephemeris` : `① ${prn} 的廣播星曆`, ax + 14, ay + 22, { size: 14, color: C.text, weight: 700 });
      g.txt(date, ax + 14, ay + 42, { size: 11.5, color: C.dim, mono: true });
      if (eph) {
        const rows = [['√A', `${eph.sqrtA.toFixed(3)} m½`, en ? 'orbit size' : '軌道大小'], ['e', eph.e.toFixed(5), en ? 'shape' : '形狀（偏心率）'],
                      ['i₀', `${(eph.i0 / D).toFixed(2)}°`, en ? 'tilt' : '傾角'], ['Ω₀', `${(eph.omega0 / D).toFixed(2)}°`, en ? 'orientation' : '軌道面方向'],
                      ['ω', `${(eph.omega / D).toFixed(2)}°`, en ? 'perigee' : '近地點方向'], ['M₀', `${(eph.m0 / D).toFixed(2)}°`, en ? 'where it starts' : '起始位置']];
        const hot = Math.floor(t * 0.8) % rows.length;
        rows.forEach(([k, v, d], i) => {
          const y = ay + (n ? 70 : 76) + i * (n ? 28 : 40);
          if (i === hot) { ctx.fillStyle = '#d9bf8c18'; ctx.fillRect(ax + 8, y - 15, aw - 16, n ? 26 : 34); }
          g.txt(k, ax + 16, y, { size: 14, color: '#d9bf8c', weight: 700, mono: true });
          g.txt(v, ax + aw - 14, y, { size: 13, color: C.text, align: 'right', weight: 700, mono: true });
          if (!n) g.txt(d, ax + 56, y + 13, { size: 10.5, color: C.dim });
          else g.txt(d, ax + 56, y, { size: 10.5, color: C.dim });
        });
      }
      // Panel 2: put the time in → a point on the orbit.
      const [bx, by, bw, bh] = cols[1];
      g.txt(en ? '② put the time in → position' : '② 代入時刻 → 軌道上的位置', bx + 10, by + 22, { size: 14, color: C.text, weight: 700 });
      g.txt(`t = ${pad(hh)}:${pad(mm)} GPST`, bx + 10, by + 42, { size: 12, color: C.acc, weight: 700, mono: true });
      const ox = bx + bw / 2, oy = by + (n ? 150 : bh / 2 + 22), sc = (n ? 95 : 100) / 26.6e6, yaw = 0.5, pitch = 1.15;
      const proj = p => { const x1 = p[0] * Math.cos(yaw) - p[1] * Math.sin(yaw), y1 = p[0] * Math.sin(yaw) + p[1] * Math.cos(yaw); return [ox + x1 * sc, oy - (p[2] * Math.cos(pitch) - y1 * Math.sin(pitch)) * sc]; };
      const er = RE * sc, eg = ctx.createRadialGradient(ox - er * 0.3, oy - er * 0.3, er * 0.1, ox, oy, er);
      eg.addColorStop(0, '#2c74a8'); eg.addColorStop(1, '#0e2c4a');
      ctx.beginPath(); ctx.arc(ox, oy, er, 0, Math.PI * 2); ctx.fillStyle = eg; ctx.fill();
      if (orbit && hero) {
        ctx.beginPath(); orbit.forEach((p, i) => { const q = proj(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
        ctx.strokeStyle = C.gps + '88'; ctx.lineWidth = 1.4; ctx.stroke();
        const k = Math.round((secs + 43200) % 43200 / 600) % (orbit.length - 1), q = proj(orbit[k]);
        g.sat(q[0], q[1], C.gps); g.txt(prn, q[0], q[1] - 16, { size: 12, color: C.gps, align: 'center', weight: 700, mono: true });
        const p = hero[idx];
        g.txt(`x ${(p[0] / 1e3).toFixed(0)} km`, bx + 10, by + bh - (n ? 52 : 58), { size: 11.5, color: C.text, mono: true });
        g.txt(`y ${(p[1] / 1e3).toFixed(0)} km`, bx + 10, by + bh - (n ? 34 : 38), { size: 11.5, color: C.text, mono: true });
        g.txt(`z ${(p[2] / 1e3).toFixed(0)} km`, bx + 10, by + bh - (n ? 16 : 18), { size: 11.5, color: C.text, mono: true });
      }
      if (!n) { arrow(g, 250, H / 2, 272, H / 2, C.dim); arrow(g, 528, H / 2, 548, H / 2, C.dim); }
      // Panel 3: seen from NKUST.
      const [cx0, cy0, cw, ch] = cols[2];
      g.txt(en ? '③ seen from NKUST' : '③ 從高科大看出去', cx0 + 10, cy0 + 22, { size: 14, color: C.text, weight: 700 });
      const sx = cx0 + cw / 2, sr = n ? 120 : 92, sy = cy0 + (n ? 170 : 150);
      ctx.strokeStyle = C.line; ctx.lineWidth = 1;
      [1, 2 / 3, 1 / 3].forEach(f => { ctx.beginPath(); ctx.arc(sx, sy, sr * f, 0, Math.PI * 2); ctx.stroke(); });
      g.txt(en ? 'N' : '北', sx, sy - sr - 10, { size: 11, color: C.dim, align: 'center', weight: 700 });
      const P = (az, el) => [sx + Math.sin(az) * sr * (90 - el) / 90, sy - Math.cos(az) * sr * (90 - el) / 90];
      let cur = null;
      if (tracks) tracks.forEach(tk => {
        const p = tk.pts[idx]; if (p[1] < 0) return;
        const mine = tk.id === prn, [x, y] = P(p[0], p[1]);
        if (mine) cur = p; else g.dot(x, y, 2.6, (tk.sys === 'G' ? C.gps : C.bds) + '77');
      });
      if (cur) {
        const [x, y] = P(cur[0], cur[1]);
        g.line(sx, sy, x, y, '#8affdd66', 1, [3, 4]); g.dot(x, y, 6, C.gps, 12);
        const az = ((cur[0] / D) + 360) % 360;
        g.txt(en ? `azimuth ${az.toFixed(0)}°` : `方位 ${az.toFixed(0)}°`, cx0 + 10, sy + sr + 26, { size: 13, color: C.text, weight: 700, mono: true });
        g.txt(en ? `elevation ${cur[1].toFixed(1)}°` : `仰角 ${cur[1].toFixed(1)}°`, cx0 + cw - 10, sy + sr + 26, { size: 13, color: C.acc, align: 'right', weight: 700, mono: true });
      } else if (tracks) g.txt(en ? `${prn} is below the horizon now` : `${prn} 此刻在地平線下`, sx, sy + sr + 26, { size: 12, color: C.dim, align: 'center' });
      if (!tracks) g.txt(en ? 'Loading the ephemeris…' : '載入星曆中…', W / 2, H / 2, { size: 13, color: C.dim, align: 'center' });
    }, { h: 380, nh: 900 });
  }

  // 06: G13's signal, told in five beats like the homepage walkthrough: data, code, the multiplication rule, the carrier,
  // and finally the receiver's side, where only G13's own code pulls a peak out of the noise and another code does not.
  {
    const CAPS = [
      ['① 導航電文：衛星要說的內容', '軌道、時鐘修正與時間等資訊，以 +1／−1 表示，每秒 50 個位元，每個位元持續 20 ms，變化得很慢。',
       '① Navigation data: what the satellite says', 'Orbit, clock corrections and time, sent as +1 / −1 at 50 bits a second; each bit lasts 20 ms and changes slowly.'],
      ['② PRN 碼：G13 的指紋', '每顆衛星有一組專屬、快速跳動的 ±1 序列。一個電文位元裡塞了很多碼片：GPS 是 20,460 個，北斗 B1I 是 40,920 個。',
       '② PRN code: G13’s fingerprint', 'Each satellite has its own fast ±1 sequence. One data bit holds many chips: 20,460 for GPS, 40,920 for BeiDou B1I.'],
      ['③ 相乘：電文決定碼要不要翻轉', '電文是 +1 時，碼維持原樣；電文是 −1 時，碼整段上下翻轉。這就是送出去的內容。',
       '③ Multiply: the data decides whether the code flips', 'Where the data is +1 the code passes unchanged; where it is −1 the code flips upside down. That is what gets sent.'],
      ['④ 放上載波：翻轉變成相位跳 180°', '載波是 1575.42 MHz（北斗 1561.098 MHz）的正弦波。相乘結果每翻一次，載波的相位就跳 180°，這叫 BPSK。',
       '④ Onto the carrier: a flip becomes a 180° phase jump', 'The carrier is a 1575.42 MHz sine (BeiDou 1561.098 MHz). Each flip of the product makes the carrier jump 180° in phase: BPSK.'],
      ['⑤ 接收機：用對的碼，才找得到', '收到的訊號埋在雜訊下面。拿 G13 的碼去比對，會出現一個尖峰，位置就是延遲；拿 G05 的碼比對，什麼都沒有。',
       '⑤ The receiver: only the right code finds it', 'The signal arrives buried under noise. Matching it with G13’s code raises one peak, at the delay; matching with G05’s code finds nothing.'],
    ];
    const DATA = [1, -1, -1, 1, -1, 1, 1, -1], FLIP = '#ff8f7a', DUR = 8;
    const chip = (seed, k) => (Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453 % 1 + 1) % 1 > 0.5 ? 1 : -1;
    const noise = i => { const s = Math.sin(i * 78.233 + 1.7) * 43758.5453; return ((s - Math.floor(s)) - 0.5) * 2; };
    let beat = 0, playing = !reduced.matches, start = 0, now = 0;
    const root = document.querySelector('.ps3-ctrl');
    const playBtn = root?.querySelector('.ps3-play');
    const render = () => {
      if (!playBtn) return;
      const en = isEn();
      playBtn.textContent = en ? (playing ? 'Pause Ⅱ' : 'Play ▷') : (playing ? '暫停 Ⅱ' : '播放 ▷');
      playBtn.setAttribute('aria-pressed', String(playing));
    };
    const goTo = (i, stop) => { beat = (i + 5) % 5; start = now; if (stop) playing = false; render(); };
    root?.querySelector('.ps3-prev').addEventListener('click', () => goTo(beat - 1, true));
    root?.querySelector('.ps3-next').addEventListener('click', () => goTo(beat + 1, true));
    playBtn?.addEventListener('click', () => { playing = !playing; start = now; render(); });
    document.addEventListener('languagechange', () => setTimeout(render));
    render();
    function wrap(g, s, x, y, maxW, lh, size, color) {
      const { ctx, n } = g, px = size * (n ? 1.15 : 1.1);
      ctx.font = `500 ${px}px 'Noto Sans TC',sans-serif`;
      const parts = /[㐀-鿿]/.test(s) ? [...s] : s.split(/(?<= )/);
      let line = '', yy = y;
      for (const p of parts) {
        if (ctx.measureText(line + p).width > maxW && line) { g.txt(line.trimEnd(), x, yy, { size, color }); line = p.trimStart(); yy += lh; }
        else line += p;
      }
      if (line) g.txt(line, x, yy, { size, color });
    }
    scene('po-signal-cv', (g, t, en) => {
      const { ctx, W, H, n } = g;
      now = t;
      if (playing && t - start > DUR) goTo(beat + 1, false);
      const local = t - start, rv = Math.min(1, local / 0.8);
      const SH = Math.round(H * (n ? 0.6 : 0.66));
      const x0 = n ? 14 : 170, x1 = W - (n ? 14 : 24), BIT = n ? 110 : 150, CH = n ? 9 : 10, shift = t * 26;
      const amp = n ? 14 : 16;
      const dIdx = x => Math.floor((x + shift) / BIT), dVal = k => DATA[((k % 8) + 8) % 8];
      const data = x => dVal(dIdx(x)), code = (x, seed = 13) => chip(seed, Math.floor((x + shift) / CH));
      const trace = (y, f, col, w = 1.8, a = amp) => { ctx.beginPath(); for (let x = x0; x <= x1; x += 1.5) { const v = f(x); x === x0 ? ctx.moveTo(x, y - v * a) : ctx.lineTo(x, y - v * a); } ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
      const windows = [];
      for (let k = dIdx(x0); k * BIT - shift < x1; k++) { const a = Math.max(x0, k * BIT - shift), b = Math.min(x1, (k + 1) * BIT - shift); if (b > a) windows.push({ a, b, d: dVal(k) }); }
      const label = (y, zh, enS, sub, col) => {
        if (n) g.txt(`${en ? enS : zh} · ${sub}`, x0, y - amp - 12, { size: 12, color: col, weight: 700 });
        else { g.txt(en ? enS : zh, 18, y - 7, { size: 14, color: col, weight: 700 }); g.txt(sub, 18, y + 13, { size: 11, color: C.dim, mono: true }); }
      };
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, SH); ctx.clip();
      if (beat < 4) {
        const rows = n ? [40, 98, 156, 214] : [38, 100, 162, 224].map(v => v * SH / 300);
        // Row 1: data.
        label(rows[0], '導航電文', 'Navigation data', '50 bps', C.pur);
        trace(rows[0], data, C.pur);
        windows.forEach(({ a, b, d }) => { if (b - a > 34) g.txt(d > 0 ? '+1' : '−1', (a + b) / 2, rows[0] - amp - 8, { size: 12, color: C.pur, align: 'center', weight: 700, mono: true }); });
        if (beat >= 1) {
          ctx.globalAlpha = beat === 1 ? rv : 1;
          label(rows[1], 'G13 的 PRN 碼', 'G13’s PRN code', '1.023 Mcps', C.gps);
          trace(rows[1], x => code(x), C.gps);
          if (beat === 1) {
            const w = windows.find(w => w.b - w.a >= BIT - 1);
            if (w) { ctx.strokeStyle = '#8affdd88'; ctx.lineWidth = 1.2; ctx.strokeRect(w.a, rows[0] - amp - 18, BIT, rows[1] - rows[0] + amp * 2 + 24);
              g.txt(en ? '1 data bit = many chips' : '1 個電文位元 ＝ 許多碼片', w.a + BIT / 2, rows[1] + amp + 16, { size: 12, color: C.acc, align: 'center', weight: 700 }); }
          }
          ctx.globalAlpha = 1;
        }
        if (beat >= 2) {
          ctx.globalAlpha = beat === 2 ? rv : 1;
          if (beat === 2) windows.forEach(({ a, b, d }) => {
            ctx.fillStyle = d > 0 ? '#8affdd12' : '#ff8f7a1c'; ctx.fillRect(a, rows[0] - amp - 6, b - a, rows[2] - rows[0] + amp * 2 + 12);
            if (b - a > 44) g.txt(d > 0 ? (en ? 'unchanged' : '不變') : (en ? 'flipped' : '翻轉'), (a + b) / 2, rows[2] + amp + 14, { size: 12, color: d > 0 ? C.acc : FLIP, align: 'center', weight: 700 });
          });
          label(rows[2], '① × ②', '① × ②', en ? 'sent content' : '送出的內容', C.acc);
          windows.forEach(({ a, b, d }) => { ctx.save(); ctx.beginPath(); ctx.rect(a, rows[2] - amp - 4, b - a, amp * 2 + 8); ctx.clip(); trace(rows[2], x => d * code(x), d > 0 ? C.acc : FLIP); ctx.restore(); });
          ctx.globalAlpha = 1;
        }
        if (beat >= 3) {
          ctx.globalAlpha = rv;
          label(rows[3], en ? '× carrier' : '× 載波', '× carrier', 'BPSK', C.bds);
          const prod = x => data(x) * code(x);
          trace(rows[3], x => prod(x) * Math.cos((x + shift) * 1.3), C.bds, 1.3);
          // Mark each phase jump.
          let prev = prod(x0);
          for (let x = x0 + 1; x <= x1; x++) { const v = prod(x); if (v !== prev) { g.line(x, rows[3] - amp - 6, x, rows[3] + amp + 6, '#ffffff55', 1, [2, 3]); prev = v; } }
          g.txt(en ? 'dashed: phase jumps 180°' : '虛線：相位跳 180°', x1, rows[3] + amp + 16, { size: 12, color: C.dim, align: 'right', weight: 700 });
          ctx.globalAlpha = 1;
        }
      } else {
        // The receiver: noisy input, then two matches side by side.
        const y0 = n ? 46 : 46;
        label(y0, en ? 'What arrives' : '收到的訊號', 'What arrives', en ? 'under the noise' : '埋在雜訊下', '#9fb4c8');
        trace(y0, x => 0.25 * data(x) * code(x) + 0.9 * noise(Math.floor(x + shift)), '#9fb4c8aa', 1, amp * 1.2);
        const panels = n ? [[x0, 98, x1 - x0, (SH - 110) / 2 - 6], [x0, 98 + (SH - 110) / 2 + 6, x1 - x0, (SH - 110) / 2 - 6]] : [[x0, 96, (x1 - x0) / 2 - 10, SH - 108], [x0 + (x1 - x0) / 2 + 10, 96, (x1 - x0) / 2 - 10, SH - 108]];
        [['G13', true], ['G05', false]].forEach(([id, ok], i) => {
          const [px, py, pw, ph] = panels[i], col = ok ? C.acc : FLIP;
          g.box(px, py, pw, ph, col + '88');
          g.txt(en ? `match with ${id}’s code` : `用 ${id} 的碼比對`, px + 12, py + 18, { size: 13, color: col, weight: 700 });
          const by = py + ph - 14, top = py + 60, grow = Math.min(1, local / 1.6);
          g.line(px + 10, by, px + pw - 10, by, C.line, 1);
          ctx.beginPath();
          for (let k = 0; k <= 120; k++) {
            const x = px + 10 + (pw - 20) * k / 120, peak = ok ? Math.max(0, 1 - Math.abs(k - 74) / 2.5) * grow : 0;
            const y = by - (peak + Math.abs(noise(k * 3 + i * 40)) * 0.13) * (by - top);
            k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
          if (grow > 0.9) g.txt(ok ? (en ? 'peak = found, and its delay' : '尖峰＝找到了，位置就是延遲') : (en ? 'no peak = not this satellite' : '沒有尖峰＝不是這顆衛星'), px + 12, py + 40, { size: 12, color: col, weight: 700 });
        });
      }
      ctx.restore();
      // Caption.
      const cx = n ? 12 : 20, cw = W - cx * 2, cy = SH + 8, ch = H - cy - 10;
      g.box(cx, cy, cw, ch, '#2f5577');
      for (let i = 0; i < 5; i++) g.dot(cx + 18 + i * 14, cy + 18, 4, i <= beat ? C.acc : '#2b4a66');
      g.txt('GPS L1 C/A · BeiDou B1I', cx + cw - 14, cy + 18, { size: 11, color: C.dim, align: 'right', mono: true });
      const c = CAPS[beat];
      ctx.globalAlpha = rv;
      g.txt(en ? c[2] : c[0], cx + 16, cy + 46, { size: n ? 14 : 17, color: '#fff', weight: 700 });
      wrap(g, en ? c[3] : c[1], cx + 16, cy + (n ? 74 : 78), cw - 32, n ? 21 : 25, n ? 13 : 15, C.text);
      ctx.globalAlpha = 1;
    }, { h: 520, nh: 660 });
  }

  // 07: every channel at the same instant, the summed waveform, and that sum as points on the I/Q plane.
  {
    const CH7 = [['G13', C.gps, 1.0, 0.0, 0.9], ['G05', C.gps, 1.3, 1.2, 0.8], ['G21', C.gps, 0.8, 2.3, 0.7], ['C23', C.bds, 1.6, 0.6, 0.85], ['C32', C.bds, 1.15, 3.1, 0.75], ['C24', C.bds, 0.65, 4.2, 0.8]];
    const trail = [];
    scene('po-syn-cv', (g, t, en) => {
      const { ctx, W, H, n } = g;
      const L0 = n ? 52 : 64, L1 = n ? W - 64 : 470, rh = n ? 34 : 36, top = n ? 34 : 34, amp = n ? 11 : 12;
      const cu = 0.65, sx = L0 + (L1 - L0) * cu, phase = (x, f, ph) => 2 * Math.PI * f * ((x - L0) / (L1 - L0) * 6 + t * 1.2) / 2 + ph;
      let I = 0, Q = 0;
      CH7.forEach(([id, col, f, ph, a], j) => {
        const y = top + j * rh + rh / 2;
        g.txt(id, 10, y, { size: 12.5, color: col, weight: 700, mono: true });
        ctx.beginPath();
        for (let x = L0; x <= L1; x += 2) { const v = a * Math.cos(phase(x, f, ph)); x === L0 ? ctx.moveTo(x, y - v * amp) : ctx.lineTo(x, y - v * amp); }
        ctx.strokeStyle = col + 'bb'; ctx.lineWidth = 1.3; ctx.stroke();
        const vi = a * Math.cos(phase(sx, f, ph)), vq = a * Math.sin(phase(sx, f, ph));
        I += vi; Q += vq; g.dot(sx, y - vi * amp, 3.5, col, 6);
      });
      // The summed waveform.
      const sy = top + CH7.length * rh + (n ? 40 : 44), sAmp = n ? 9 : 10;
      g.txt(en ? 'Σ summed waveform' : 'Σ 疊加後的波形', 10, sy - (n ? 30 : 32), { size: 13, color: C.acc, weight: 700 });
      g.line(L0, sy, L1, sy, '#1d3650', 1);
      ctx.beginPath();
      for (let x = L0; x <= L1; x += 2) { let v = 0; CH7.forEach(([, , f, ph, a]) => { v += a * Math.cos(phase(x, f, ph)); }); x === L0 ? ctx.moveTo(x, sy - v * sAmp) : ctx.lineTo(x, sy - v * sAmp); }
      ctx.strokeStyle = C.acc; ctx.lineWidth = 2; ctx.stroke();
      g.dot(sx, sy - I * sAmp, 5, '#fff', 12);
      g.line(sx, top - 6, sx, sy + 40, '#ffffff55', 1, [3, 3]);
      g.txt(en ? 'same instant' : '同一個瞬間', sx, top - 14, { size: 12, color: C.text, align: 'center', weight: 700 });
      // The I/Q plane.
      const qx = n ? W / 2 : 668, qy = n ? H - 120 : H / 2 + 8, qr = n ? 90 : 104;
      if (n) arrow(g, W / 2, sy + 46, W / 2, qy - qr - 12, C.acc); else arrow(g, L1 + 14, sy, qx - qr - 14, qy, C.acc);
      g.txt(en ? 'as I/Q' : '換成 I/Q', n ? W / 2 + 10 : L1 + 30, n ? sy + 60 : (sy + qy) / 2 - 10, { size: 12, color: C.acc, weight: 700 });
      g.line(qx - qr, qy, qx + qr, qy, C.line, 1); g.line(qx, qy - qr, qx, qy + qr, C.line, 1);
      g.txt('I', qx + qr + 8, qy, { size: 13, color: C.dim, weight: 700, mono: true }); g.txt('Q', qx, qy - qr - 10, { size: 13, color: C.dim, align: 'center', weight: 700, mono: true });
      const k = qr / 4.6, px = qx + I * k, py = qy - Q * k;
      trail.push([px, py]); if (trail.length > 80) trail.shift();
      trail.forEach(([x, y], i) => { ctx.globalAlpha = i / trail.length * 0.6; g.dot(x, y, 2, C.acc); }); ctx.globalAlpha = 1;
      g.dot(px, py, 6, '#fff', 14);
      g.txt(en ? 'one sample = (I, Q)' : '一個樣本 = (I, Q)', qx, qy + qr + 18, { size: 13, color: C.acc, align: 'center', weight: 700 });
      g.txt(en ? 'I = the sum above · Q = the same sum a quarter-turn later' : 'I＝上面的總和・Q＝同一個總和轉 90° 的分量', qx, qy + qr + 38, { size: 11, color: C.dim, align: 'center' });
    }, { h: 380, nh: 680 });
  }

  // 08: the 1 ms deadline, as an illustration. Blocks arrive every 1 ms; each must be computed before the next one is due.
  {
    const LANES = [
      { zh: '一個一個算・衛星少', en: 'One by one · few satellites', us: 780, col: C.bds },
      { zh: '一個一個算・衛星多', en: 'One by one · many satellites', us: 1560, col: '#ff8f8f' },
      { zh: 'GPU 平行算・衛星多', en: 'GPU in parallel · many satellites', us: 280, col: C.acc },
    ];
    const hash = i => { const s = Math.sin(i * 91.7) * 43758.5453; return s - Math.floor(s); };
    scene('po-load-cv', (g, t, en) => {
      const { ctx, W, H, n } = g;
      const x0 = n ? 14 : 170, x1 = W - 14, slot = n ? 70 : 110, speed = 0.55;
      g.txt(en ? 'Every 1 ms a new block is due. Miss one deadline and the signal breaks.' : '每 1 ms 就有一個區塊到期；只要一次沒趕上，訊號就斷。', 14, 22, { size: n ? 12.5 : 15, color: C.text, weight: 700 });
      LANES.forEach((ln, li) => {
        const y = (n ? 72 : 76) + li * (n ? 92 : 86), hgt = n ? 30 : 34;
        if (n) g.txt(en ? ln.en : ln.zh, x0, y - 22, { size: 12, color: ln.col, weight: 700 });
        else g.txt(en ? ln.en : ln.zh, 14, y + 10, { size: 13.5, color: ln.col, weight: 700 });
        ctx.save(); ctx.beginPath(); ctx.rect(x0, y - 8, x1 - x0, hgt + 16); ctx.clip();
        const off = (t * speed * slot) % slot, first = Math.floor(t * speed);
        for (let k = -1; k < (x1 - x0) / slot + 2; k++) {
          const bx = x0 + k * slot - off, idx = first + k;
          ctx.strokeStyle = '#2f5577'; ctx.lineWidth = 1; ctx.strokeRect(bx + 2, y, slot - 4, hgt);
          const need = ln.us * (1 + (hash(idx + li * 7) - 0.5) * 0.06), w = (slot - 4) * Math.min(1, need / 1000);
          const late = need > 1000;
          ctx.fillStyle = late ? '#ff8f8f' : ln.col + 'cc'; ctx.fillRect(bx + 2, y, w, hgt);
          if (late) { ctx.fillStyle = '#ff8f8f55'; ctx.fillRect(bx + slot - 2, y, (slot - 4) * Math.min(1, need / 1000 - 1), hgt); }
        }
        ctx.restore();
        g.txt(ln.us > 1000 ? (en ? 'over 1 ms → gap → receiver loses lock' : '超過 1 ms → 斷訊 → 接收機失鎖') : ln.us > 600 ? (en ? 'fits, but little margin' : '來得及，但餘裕很少') : (en ? 'plenty of margin' : '餘裕充足'),
          x1, y + hgt + (n ? 16 : 18), { size: 12, color: ln.us > 1000 ? '#ff8f8f' : ln.us > 600 ? C.bds : C.acc, align: 'right', weight: 700 });
      });
      g.txt(en ? 'Each box = 1 ms (illustration).' : '每一格＝1 ms（示意）。', 14, H - 14, { size: n ? 10.5 : 12, color: C.dim });
    }, { h: 340, nh: 380 });
  }

  // 01: where GeoTrust stands. A qualitative map: equipment needed × how controllable; circle size = systems and bands.
  scene('po-pos-cv', (g, t, en) => {
    const { ctx, W, H, n } = g;
    const x0 = n ? 46 : 80, x1 = W - 24, y0 = H - (n ? 56 : 50), y1 = 26;
    const X = v => x0 + (x1 - x0) * v, Y = v => y0 - (y0 - y1) * v;
    arrow(g, x0, y0, x1, y0, C.line); arrow(g, x0, y0, x0, y1, C.line);
    g.txt(en ? 'Equipment needed: less → more' : '需要的設備：少 → 多', (x0 + x1) / 2, y0 + 26, { size: 13, color: C.dim, align: 'center', weight: 700 });
    ctx.save(); ctx.translate(x0 - (n ? 26 : 34), (y0 + y1) / 2); ctx.rotate(-Math.PI / 2);
    g.txt(en ? 'Controllable & repeatable: low → high' : '可控與可重現：低 → 高', 0, 0, { size: 13, color: C.dim, align: 'center', weight: 700 }); ctx.restore();
    const cyc = t;                                     // points appear once and stay
    const pts = [
      [0.16, 0.16, n ? 40 : 58, '#9fb4c8', en ? 'Outdoor test' : '戶外實測', 0.3],
      [0.8, 0.8, n ? 40 : 58, C.gps, en ? 'Hardware simulator' : '傳統硬體模擬器', 1.2],
      [0.2, 0.8, n ? 22 : 30, C.acc, 'GeoTrust', 2.2],
    ];
    pts.forEach(([vx, vy, r, col, name, at], i) => {
      const a = Math.min(1, Math.max(0, (cyc - at) / 0.8));
      if (a <= 0) return;
      let px = X(vx), py = Y(vy);
      if (i === 2) { const e = 1 - (1 - a) ** 3; px = X(0.08 + (vx - 0.08) * e); py = Y(0.08 + (vy - 0.08) * e); }
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fillStyle = col + '22'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = i === 2 ? 2 : 1.2; ctx.stroke();
      if (i === 2) { const p = (t * 0.6) % 1; ctx.beginPath(); ctx.arc(px, py, r + p * 26, 0, Math.PI * 2); ctx.strokeStyle = `rgba(138,255,221,${0.5 * (1 - p)})`; ctx.stroke(); }
      g.txt(name, px, py + r + 16, { size: i === 2 ? 15 : 13, color: col, align: 'center', weight: 700 });
      ctx.globalAlpha = 1;
    });
    if (cyc > 3.2) {
      ctx.globalAlpha = Math.min(1, (cyc - 3.2) / 0.8);
      const gx = X(0.2) + (n ? 30 : 44), gy = Y(0.8);
      g.txt(en ? '← low equipment, high control' : '← 設備門檻低，可控程度高', gx, gy - 6, { size: 13, color: C.acc, weight: 700 });
      g.txt(en ? 'smaller circle: GPS L1 + BeiDou B1I only' : '圓較小：只涵蓋 GPS L1＋北斗 B1I', gx + 18, gy + 16, { size: 12, color: C.dim });
      ctx.globalAlpha = 1;
    }
  }, { h: 360, nh: 440 });



  // Diagrams, tables and formula lists reveal on scroll; CSS does the motion, this only flags visibility.
  document.documentElement.classList.add('po-js');
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll('.po-table-wrap, .po-eqs, .po-bounds, .po-levels, .po-cmp, .po-steps, .po-stats').forEach(el => io.observe(el));
})();

// Formulas: typeset with KaTeX, again after each language switch (the swap restores the raw TeX).
(() => {
  // Formula rows are rendered one by one from their own TeX; inline formulas in text use auto-render.
  const render = () => {
    if (!window.katex) return;
    document.querySelectorAll('.po-tex').forEach(el => {
      if (!el.dataset.tex) el.dataset.tex = el.textContent.trim().slice(2, -2);
      katex.render(el.dataset.tex, el, { throwOnError: false });
    });
    if (window.renderMathInElement) renderMathInElement(document.querySelector('main'), {
      delimiters: [{ left: '\\(', right: '\\)', display: false }], ignoredClasses: ['po-tex'], throwOnError: false,
    });
  };
  render();
  document.addEventListener('languagechange', () => setTimeout(render, 30));
})();
