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
    const sats = [['G', 160], ['G', 128], ['C', 100], ['G', 70], ['C', 44], ['G', 18]];
    // Sky.
    const rx = n ? W / 2 : 210, ry = n ? 214 : H - 40, R = n ? 150 : 200;
    ctx.beginPath(); ctx.arc(rx, ry, R, Math.PI, 0); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]);
    sats.forEach(([id, deg], i) => {
      const a = deg * Math.PI / 180, x = rx + Math.cos(a) * R * 0.92, y = ry - Math.sin(a) * R * 0.92;
      const bad = i === BAD && bias > 0, gone = i === BAD && out;
      const col = gone ? '#4b6680' : bad ? RED : id[0] === 'G' ? C.gps : C.bds;
      g.line(x, y, rx, ry, gone ? '#33475c' : bad ? RED : col + '77', bad ? 1.8 : 1.1, bad || gone ? [5, 5] : []);
      g.sat(x, y, col);
      g.txt(id === 'G' ? 'GPS' : (en ? 'BDS' : '北斗'), x, y - 16, { size: n ? 10 : 11, color: col, align: 'center', weight: 700 });
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


  // 02: where a scenario starts. The usual command-line loop with a prepared NMEA file, next to drawing the path in the GUI.
  scene('po-gui-cv', (g, t, en) => {
    const { ctx, W, H, n } = g;
    const local = t % 12;
    // How a dynamic scenario is set up: the usual command-line loop vs drawing the path in the GUI.
    const half = n ? H / 2 : W / 2;
    const boxes = en ? ['Write an NMEA file', 'Make the motion physical (walk / drive)', 'Load it from the command line', 'Run, check, edit again'] : ['寫好 NMEA 檔', '做成符合人走、車行的物理運動', '在命令列載入', '跑一次、檢查、再修改'];
    const lx = 14, ly = n ? 40 : 48, bw = n ? W - 28 : half - 40, bh = n ? 30 : 40;
    g.txt(en ? 'Typical SDR tools' : '一般 SDR 工具', lx, n ? 18 : 22, { size: n ? 13 : 15, color: C.bds, weight: 700 });
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

  // ---------- Shared helpers for the v3 chapters ----------
  // Wrapped text for canvas captions: CJK breaks per character, Latin per word.
  function wrapText(g, s, x, y, maxW, lh, size, color, weight = 500) {
    const { ctx, n } = g, px = size * (n ? 1.15 : 1.1);
    ctx.font = `${weight} ${px}px 'Noto Sans TC',sans-serif`;
    const parts = /[㐀-鿿]/.test(s) ? [...s] : s.split(/(?<= )/);
    let line = '', yy = y;
    for (const p of parts) {
      if (ctx.measureText(line + p).width > maxW && line) { g.txt(line.trimEnd(), x, yy, { size, color, weight }); line = p.trimStart(); yy += lh; }
      else line += p;
    }
    if (line) g.txt(line, x, yy, { size, color, weight });
    return yy;
  }
  // One line that shrinks until it fits the given width.
  function fit(g, s, x, y, maxW, o = {}) {
    const { ctx, n } = g;
    let size = o.size || 14;
    const face = o.mono ? "'JetBrains Mono',Consolas,monospace" : "'Noto Sans TC',sans-serif";
    for (; size > 9; size -= 0.5) { ctx.font = `${o.weight || 500} ${size * (n ? 1.15 : 1.1)}px ${face}`; if (ctx.measureText(s).width <= maxW) break; }
    g.txt(s, x, y, { ...o, size });
  }
  const pad2 = v => String(v).padStart(2, '0');
  const hms = s => { s = ((s % 86400) + 86400) % 86400; const ms = Math.round((s % 1) * 1000) % 1000; return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor(s % 3600 / 60))}:${pad2(Math.floor(s % 60))}.${String(ms).padStart(3, '0')}`; };

  // The example satellites' geometry from NKUST, computed from the same ephemeris file as the rest of the page.
  const GEO = (() => {
    const RE = 6378137, D = Math.PI / 180, CL = 299792458;
    const LAT = 22.75843215402263 * D, LON = 120.33823886027615 * D;
    const up = [Math.cos(LAT) * Math.cos(LON), Math.cos(LAT) * Math.sin(LON), Math.sin(LAT)];
    const east = [-Math.sin(LON), Math.cos(LON), 0], north = [-Math.sin(LAT) * Math.cos(LON), -Math.sin(LAT) * Math.sin(LON), Math.cos(LAT)];
    const SITE = up.map(v => v * RE), dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const near = (list, t) => list.reduce((b, r) => Math.abs(t - r[0]) < Math.abs(t - b[0]) ? r : b, list[0]);
    const ready = () => !!(window.GT_DATA && window.GnssOrbit && window.GT_EPH);
    const record = (id, t) => { const list = window.GT_DATA && window.GT_DATA.sats[id]; return list ? near(list, t) : null; };
    const pos = (id, t) => {
      const r = record(id, t); if (!r) return null;
      return GnssOrbit.position(GnssOrbit.fromRecord(id[0], +id.slice(1), r.slice(1)), t - r[0]);
    };
    function look(id, t) {
      const p = pos(id, t), q = pos(id, t + 1); if (!p || !q) return null;
      const d = p.map((v, i) => v - SITE[i]), r = Math.hypot(...d), r2 = Math.hypot(...q.map((v, i) => v - SITE[i]));
      return { az: Math.atan2(dot3(d, east), dot3(d, north)), el: Math.asin(dot3(d, up) / r) / D, range: r, rate: r2 - r };
    }
    return { D, CL, RE, SITE, up, east, north, dot3, ready, record, pos, look };
  })();
  const LAMBDA = { G: 299792458 / 1575.42e6, C: 299792458 / 1561.098e6 };
  const T0 = 4 * 3600, SPAN = 4 * 3600;
  // Both real-ephemeris chapters run the same clock: four hours around noon in Taiwan, about 33 s per loop.
  const sweep = t => T0 - SPAN / 2 + ((t * 0.03) % 1) * SPAN;
  const twTime = s => { const h = (s / 3600 + 8) % 24; return `${pad2(Math.floor(h))}:${pad2(Math.floor((h % 1) * 60))}`; };

  // 01: adding a constellation. Three stacks (scenario, signal computing, transmit hardware); a "new constellation" token drops
  // into each computing layer: dedicated hardware stops it, a typical SDR tool needs its code rewritten, GeoTrust adds a module.
  {
    const COLS = [
      { k: ['傳統儀器', 'Traditional instrument'], col: '#c3cfdc', layers: [['原廠軟體', 'Vendor software', 0], ['專用晶片／FPGA', 'Chips / FPGA', 1], ['專用射頻', 'Dedicated RF', 1]],
        res: ['換硬體或等原廠升級', 'New hardware or a vendor upgrade'], rc: RED, cost: ['約 US$20k–500k+', 'about US$20k–500k+'] },
      { k: ['一般 SDR 工具', 'Typical SDR tool'], col: C.pur, layers: [['NMEA＋命令列', 'NMEA + CLI', 0], ['軟體・單一星系', 'Software · one system', 0], ['通用 SDR', 'Common SDR', 1]],
        res: ['自己改寫程式', 'Rewrite the code yourself'], rc: C.bds, cost: ['USRP 約 US$3k＋電腦', 'USRP ~US$3k + computer'] },
      { k: ['GeoTrust', 'GeoTrust'], col: C.acc, layers: [['GUI 畫路徑', 'Route in the GUI', 0], ['軟體・CPU＋GPU', 'Software · CPU + GPU', 0], ['通用 SDR', 'Common SDR', 1]],
        res: ['加入軟體模組即可', 'Just add a software module'], rc: C.acc, cost: ['約 US$3.8k–5.5k・可量產', '~US$3.8k–5.5k · mass-producible'] },
    ];
    const LAYER = [['情境', 'Scenario'], ['運算', 'Computing'], ['發射', 'Transmit']];
    function hatch(ctx, x, y, w, h, col) {
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.clip();
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      for (let k = -h; k < w; k += 9) { ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); ctx.stroke(); }
      ctx.restore();
    }
    scene('po-why-cv', (g, t, en) => {
      const { ctx, W, n } = g;
      const L = en ? 1 : 0, cyc = t % 9, hit = cyc > 1.4, show = Math.min(1, Math.max(0, (cyc - 1.4) / 0.6));
      COLS.forEach((c, i) => {
        const boxes = [];
        let tx, ty0, ty1;
        if (!n) {
          const x = 20 + i * 260, w = 240;
          g.txt(c.k[L], x + w / 2, 20, { size: 16, color: c.col, align: 'center', weight: 700 });
          for (let j = 0; j < 3; j++) boxes.push([x, 88 + j * 72, w, 58]);
          tx = x + w / 2; ty0 = 54; ty1 = 0;
        } else {
          const y0 = 18 + i * 198, w = (W - 28 - 16) / 3;
          g.txt(c.k[L], 14, y0 + 10, { size: 15, color: c.col, weight: 700 });
          for (let j = 0; j < 3; j++) boxes.push([14 + j * (w + 8), y0 + 52, w, 60]);
          tx = boxes[1][0] + w / 2; ty0 = y0 + 12; ty1 = 0;
        }
        c.layers.forEach(([z, e, hw], j) => {
          const [x, y, w, h] = boxes[j], hot = hit && j === 1;
          ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fillStyle = '#0b1b2c'; ctx.fill();
          if (hw) { hatch(ctx, x, y, w, h, '#ffffff10'); ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); }
          ctx.strokeStyle = hot ? c.rc : hw ? '#56708c' : c.col + '99'; ctx.lineWidth = hot ? 2 : 1.2; ctx.stroke();
          g.txt(LAYER[j][L], x + 10, y + 14, { size: 10.5, color: C.dim, weight: 700 });
          g.txt(hw ? (en ? 'HARDWARE' : '硬體') : (en ? 'SOFTWARE' : '軟體'), x + w - 10, y + 14, { size: 10, color: hw ? '#9fb4c8' : c.col, align: 'right', weight: 700 });
          fit(g, en ? e : z, x + w / 2, y + 38, w - 16, { size: n ? 12.5 : 14, color: C.text, align: 'center', weight: 700 });
        });
        // The token "+ new system" waits above the column; once it is applied, a connector shows where it has to go.
        const tw = n ? 84 : 104, th = 24, col = hit ? c.rc : '#d9bf8c', ty = n ? ty0 : 54;
        ctx.globalAlpha = Math.min(1, cyc / 0.5);
        ctx.beginPath(); ctx.roundRect(tx - tw / 2, ty - th / 2, tw, th, 12); ctx.fillStyle = '#10243a'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
        g.txt((hit && i === 0 ? '✕ ' : '＋ ') + (en ? 'new system' : '新星系'), tx, ty, { size: 12, color: col, align: 'center', weight: 700 });
        ctx.globalAlpha = 1;
        if (hit) {
          const [bx0, by0, , bh0] = boxes[1], k = Math.min(1, (cyc - 1.4) / 0.5);
          ctx.globalAlpha = k;
          if (!n) {
            const gx = bx0 - 10, my = by0 + bh0 / 2;
            ctx.beginPath(); ctx.moveTo(tx - tw / 2, ty); ctx.lineTo(gx, ty); ctx.lineTo(gx, my); ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
            arrow(g, gx, my, bx0 - 1, my, col);
          } else arrow(g, tx, ty + th / 2 + 2, tx, by0 - 2, col);
          ctx.globalAlpha = 1;
        }
        // Outcome and cost.
        ctx.globalAlpha = show;
        if (!n) {
          const x = 20 + i * 260;
          g.txt(c.res[L], x + 120, 326, { size: 14.5, color: c.rc, align: 'center', weight: 700 });
          g.txt(c.cost[L], x + 120, 354, { size: 12.5, color: C.dim, align: 'center' });
        } else {
          const y0 = 18 + i * 198;
          g.txt(c.res[L], 14, y0 + 134, { size: 13.5, color: c.rc, weight: 700 });
          g.txt(c.cost[L], 14, y0 + 158, { size: 12, color: C.dim });
        }
        ctx.globalAlpha = 1;
      });
    }, { h: 380, nh: 610 });
  }

  // 02: the six questions, asked again every 1 ms. Values come from the example satellite; CPU, GPU and SDR bands show who answers.
  {
    const Q = [['現在幾點？', 'What time is it?', 'CPU'], ['衛星在哪？', 'Where is it?', 'CPU'], ['飛多久？', 'How long a flight?', 'CPU'],
               ['長什麼樣？', 'What shape?', 'GPU'], ['全部加起來', 'Add them up', 'GPU'], ['來得及嗎？', 'In time?', 'SDR']];
    const HW = { CPU: C.gps, GPU: C.acc, SDR: '#d9bf8c' };
    scene('po-journey-cv', (g, t, en) => {
      const { ctx, W, H, n } = g;
      const E = window.GT_EPH || {}, step = 0.9, k = Math.floor(t / step), act = k % 7, ms = Math.floor(k / 7);
      const look = GEO.ready() ? GEO.look(E.prn, T0) : null;
      const fd = look ? -look.rate / LAMBDA.G : 2900;
      const vals = [
        [`${hms(T0 + ms / 1000)}`, 'GPST'],
        [en ? `elev. ${(E.el ?? 45.2).toFixed(1)}°` : `仰角 ${(E.el ?? 45.2).toFixed(1)}°`, en ? 'from NKUST' : '從高科大看'],
        [`τ = ${(E.ms ?? 72.2).toFixed(1)} ms`, `f_{D} = ${fd >= 0 ? '+' : '−'}${Math.abs(fd / 1000).toFixed(2)} kHz`],
        [en ? 'data × code × carrier' : '電文 × 碼 × 載波', en ? 'one satellite' : '一顆衛星'],
        [en ? 'Σ 16 channels' : 'Σ 16 個通道', 'GPS + ' + (en ? 'BeiDou' : '北斗')],
        [en ? '20,800 samples' : '20,800 個樣本', en ? 'within 1 ms' : '1 ms 內交出'],
      ];
      const P = i => n ? [44, 46 + i * 80] : [72 + i * 131, 132];
      // Links between the questions and the pulse moving along them.
      for (let i = 0; i < 5; i++) { const [x1, y1] = P(i), [x2, y2] = P(i + 1); n ? g.line(x1, y1 + 24, x2, y2 - 24, C.line, 1.4) : g.line(x1 + 30, y1, x2 - 30, y2, C.line, 1.4); }
      if (act < 6) {
        const f = (t % step) / step;
        if (act > 0 && f < 0.5) {
          const [x1, y1] = P(act - 1), [x2, y2] = P(act), r = n ? 24 : 30, len = Math.hypot(x2 - x1, y2 - y1), u = (r + (len - 2 * r) * f * 2) / len;
          g.dot(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, 4, '#fff', 10);
        }
      }
      // The loop back: time moves on 1 ms and the first question is asked again.
      const loopCol = act === 6 ? '#d9bf8c' : '#2f5577';
      if (!n) {
        ctx.beginPath(); ctx.moveTo(P(5)[0], 96); ctx.lineTo(P(5)[0], 40); ctx.lineTo(P(0)[0], 40); ctx.strokeStyle = loopCol; ctx.lineWidth = 1.4; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
        arrow(g, P(0)[0], 40, P(0)[0], 92, loopCol);
        g.txt(en ? 'time + 1 ms → ask again from question 1' : '時間＋1 ms，再從第一問開始', W / 2, 30, { size: 12.5, color: act === 6 ? '#d9bf8c' : C.dim, align: 'center', weight: 700 });
      } else {
        const x = 12;
        ctx.beginPath(); ctx.moveTo(P(5)[0] - 26, P(5)[1]); ctx.lineTo(x, P(5)[1]); ctx.lineTo(x, P(0)[1]); ctx.strokeStyle = loopCol; ctx.lineWidth = 1.4; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
        arrow(g, x, P(0)[1], P(0)[0] - 26, P(0)[1], loopCol);
        g.txt(en ? 'time + 1 ms → start again' : '時間＋1 ms，再從第一問開始', W - 14, H - 14, { size: 12, color: act === 6 ? '#d9bf8c' : C.dim, align: 'right', weight: 700 });
      }
      Q.forEach(([z, e, hw], i) => {
        const [x, y] = P(i), on = i === act, done = i < act, col = HW[hw];
        ctx.beginPath(); ctx.arc(x, y, n ? 22 : 28, 0, Math.PI * 2); ctx.fillStyle = on ? col + '33' : '#0b1b2c'; ctx.fill();
        ctx.strokeStyle = on || done ? col : '#2f5577'; ctx.lineWidth = on ? 2.4 : 1.4; ctx.stroke();
        g.txt(String(i + 1), x, y, { size: n ? 15 : 18, color: on ? '#fff' : done ? col : C.dim, align: 'center', weight: 700, mono: true });
        const [v1, v2] = vals[i];
        if (!n) {
          g.txt(en ? e : z, x, y - 46, { size: 14, color: on ? '#fff' : C.text, align: 'center', weight: 700 });
          fit(g, v1, x, y + 48, 124, { size: 13, color: on ? col : C.text, align: 'center', weight: 700, mono: i !== 3 });
          fit(g, v2, x, y + 70, 124, { size: 11.5, color: C.dim, align: 'center', mono: i === 2 });
        } else {
          g.txt(en ? e : z, x + 36, y - 12, { size: 14, color: on ? '#fff' : C.text, weight: 700 });
          fit(g, v1, x + 36, y + 12, W - x - 120, { size: 12.5, color: on ? col : C.text, weight: 700, mono: i !== 3 });
          fit(g, v2, W - 64, y + 12, 50, { size: 10.5, color: C.dim, align: 'right', mono: i === 2 });
        }
      });
      // Who answers: CPU for 1–3, GPU for 4–5, the SDR for 6.
      [['CPU', 0, 2], ['GPU', 3, 4], ['SDR', 5, 5]].forEach(([hw, a, b]) => {
        const col = HW[hw], lit = act >= a && act <= b;
        if (!n) {
          const x1 = P(a)[0] - 58, x2 = P(b)[0] + 58, y = 246;
          ctx.fillStyle = col + (lit ? '30' : '14'); ctx.fillRect(x1, y, x2 - x1, 26); ctx.fillStyle = col; ctx.fillRect(x1, y, x2 - x1, 2);
          g.txt(hw, (x1 + x2) / 2, y + 14, { size: 12.5, color: col, align: 'center', weight: 700, mono: true });
        } else {
          const y1 = P(a)[1] - 30, y2 = P(b)[1] + 30, x = W - 30;
          ctx.fillStyle = col + (lit ? '30' : '14'); ctx.fillRect(x, y1, 22, y2 - y1); ctx.fillStyle = col; ctx.fillRect(x + 20, y1, 2, y2 - y1);
          ctx.save(); ctx.translate(x + 11, (y1 + y2) / 2); ctx.rotate(-Math.PI / 2); g.txt(hw, 0, 0, { size: 11, color: col, align: 'center', weight: 700, mono: true }); ctx.restore();
        }
      });
    }, { h: 290, nh: 540 });
  }

  // 03: why time comes first. Left: one receiver sample, converted to each system's clock, minus each flight time.
  // Right: what a time error does: the satellite is placed further along its orbit, and every range from it goes wrong.
  {
    const ERR = [['1 ms', '≈ 4 m', 0.004], ['1 s', '≈ 4 km', 0.03], ['14 s', '≈ 53 km', 0.11]];
    scene('po-time-cv', (g, t, en) => {
      const { ctx, W, H, n } = g;
      const E = window.GT_EPH || {}, k = Math.floor(t / 1.2), trx = T0 + k / 1000;
      const gms = E.ms ?? 72.2, bms = E.bdsMs ?? 73.3;
      // Left panel.
      const lx = n ? 14 : 16, lw = n ? W - 28 : 372;
      g.box(lx, 14, lw, 64, C.acc + '88');
      g.txt(en ? 'One receiver sample' : '接收端的一個樣本', lx + 14, 32, { size: 12, color: C.dim, weight: 700 });
      g.txt(`${hms(trx)} GPST`, lx + 14, 58, { size: n ? 17 : 20, color: C.acc, weight: 700, mono: true });
      // BeiDou on top, GPS below.
      const rows = [
        { c: C.bds, name: en ? 'BeiDou' : '北斗', a: [en ? 'to BeiDou Time (−14 s)' : '換成北斗時間（−14 s）', hms(trx - 14) + ' BDT'], b: [en ? `minus flight ${bms.toFixed(1)} ms → sent` : `扣掉飛行 ${bms.toFixed(1)} ms → 發射`, hms(trx - 14 - bms / 1000) + ' BDT'] },
        { c: C.gps, name: 'GPS', a: [en ? 'GPS Time (as is)' : 'GPS 時間（不必換算）', hms(trx) + ' GPST'], b: [en ? `minus flight ${gms.toFixed(1)} ms → sent` : `扣掉飛行 ${gms.toFixed(1)} ms → 發射`, hms(trx - gms / 1000) + ' GPST'] },
      ];
      rows.forEach((r, i) => {
        const y = 96 + i * 122, h = 104;
        g.box(lx, y, lw, h, r.c + '99');
        g.txt(r.name, lx + 14, y + 20, { size: 14, color: r.c, weight: 700 });
        [r.a, r.b].forEach(([lab, val], j) => {
          const yy = y + 48 + j * 30;
          if (n) { g.txt(lab, lx + 12, yy - 2, { size: 11, color: C.dim }); g.txt(val, lx + lw - 12, yy + 12, { size: 12.5, color: j ? r.c : C.text, align: 'right', weight: 700, mono: true }); }
          else { g.txt(lab, lx + 12, yy, { size: 12, color: C.dim }); g.txt(val, lx + lw - 12, yy, { size: 13, color: j ? r.c : C.text, align: 'right', weight: 700, mono: true }); }
        });
      });
      // Right panel.
      const rx = n ? 0 : 400, ry = n ? 372 : 0, rw = n ? W : 400;
      const cx = rx + rw / 2, gy = ry + (n ? 250 : 300), R = n ? 230 : 250, oy = gy + R * 0.95;
      g.txt(en ? 'Get the time wrong, and the satellite moves' : '時間錯了，衛星就放錯地方', cx, ry + 22, { size: n ? 14 : 15, color: C.text, align: 'center', weight: 700 });
      // Earth's surface and the orbit.
      ctx.beginPath(); ctx.arc(cx, oy, R * 0.95 - (n ? 10 : 0), Math.PI * 1.15, Math.PI * 1.85); ctx.strokeStyle = '#2c74a8'; ctx.lineWidth = 2; ctx.stroke();
      const Ro = R * 0.95 + (n ? 170 : 190);
      ctx.beginPath(); ctx.arc(cx, oy, Ro, Math.PI * 1.32, Math.PI * 1.68); ctx.strokeStyle = C.line; ctx.setLineDash([3, 6]); ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
      const e = ERR[Math.floor(t / 3) % 3], grow = Math.min(1, (t % 3) / 0.8);
      const a0 = Math.PI * 1.44 + Math.sin(t * 0.15) * 0.02, a1 = a0 + e[2] * grow;
      const sp = a => [cx + Ro * Math.cos(a), oy + Ro * Math.sin(a)];
      const [sx, sy] = sp(a0), [gx2, gy2] = sp(a1), rxp = [cx, oy - R * 0.95 + (n ? 10 : 0)];
      g.line(sx, sy, rxp[0], rxp[1] - 10, C.acc + '88', 1.2);
      g.line(gx2, gy2, rxp[0], rxp[1] - 10, RED + 'aa', 1.2, [5, 4]);
      ctx.beginPath(); ctx.arc(cx, oy, Ro + 14, a0, a1); ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.stroke();
      g.sat(sx, sy, C.bds);
      ctx.globalAlpha = 0.85; ctx.strokeStyle = RED; ctx.setLineDash([3, 3]); ctx.strokeRect(gx2 - 8, gy2 - 7, 16, 14); ctx.setLineDash([]); ctx.globalAlpha = 1;
      g.txt(en ? 'right time' : '正確時刻', sx - 6, sy - 22, { size: 12, color: C.bds, align: 'right', weight: 700 });
      g.txt(en ? 'wrong time' : '時間錯了', gx2 + 10, gy2 - 22, { size: 12, color: RED, weight: 700 });
      ctx.fillStyle = C.acc; ctx.beginPath(); ctx.moveTo(rxp[0] - 10, rxp[1] + 4); ctx.lineTo(rxp[0] + 10, rxp[1] + 4); ctx.lineTo(rxp[0], rxp[1] - 12); ctx.fill();
      g.txt(en ? 'receiver' : '接收機', rxp[0], rxp[1] + 20, { size: 11.5, color: C.dim, align: 'center', weight: 700 });
      // The readout.
      const by = ry + (n ? 318 : 334);
      g.txt(`Δt = ${e[0]}`, cx - 12, by, { size: n ? 16 : 18, color: RED, align: 'right', weight: 700, mono: true });
      g.txt(en ? `→ satellite off by ${e[1]}` : `→ 衛星位置差 ${e[1]}`, cx - 4, by, { size: n ? 14 : 15, color: C.text, weight: 700 });
      g.txt(en ? 'distances exaggerated for visibility' : '距離經過放大，方便觀看', cx, by + 24, { size: 10.5, color: C.dim, align: 'center' });
    }, { h: 380, nh: 740 });
  }

  // 04: ephemeris → position → sky, on a continuous clock. The parameters stay fixed while they are valid; what moves is t,
  // and with it t − t_oe and the mean anomaly. When the clock passes into a newer ephemeris set, the switch is marked.
  {
    const WE = 7.2921151467e-5, GM = 3.986005e14;
    let tracks = null, orbit = null, lastRec = null, lastClock = 0, swapAt = -9;
    function build() {
      const prn = window.GT_EPH.prn, list = window.GT_DATA.sats[prn];
      tracks = [];
      for (const id of Object.keys(window.GT_DATA.sats)) {
        if (id[0] !== 'G' && id[0] !== 'C') continue;
        const r = GEO.record(id, T0);
        if (GnssOrbit.fromRecord(id[0], +id.slice(1), r.slice(1)).kind === 'GEO') continue;
        tracks.push(id);
      }
      orbit = [];
      if (!list) return;
      for (let s = 0; s <= 43200; s += 600) {
        const p = GEO.pos(prn, T0 + s), th = WE * s;
        orbit.push([p[0] * Math.cos(th) - p[1] * Math.sin(th), p[0] * Math.sin(th) + p[1] * Math.cos(th), p[2]]);
      }
    }
    scene('po-orbit-cv', (g, t, en) => {
      const { ctx, W, H, n } = g;
      if (!tracks && GEO.ready()) build();
      const clock = sweep(t), prn = window.GT_EPH && window.GT_EPH.prn;
      const cols = n ? [[0, 0, W, 340], [0, 356, W, 270], [0, 640, W, 340]] : [[0, 0, 252, H], [276, 0, 250, H], [552, 0, 248, H]];
      // Panel 1: fixed parameters, then the values that move with t.
      const [ax, ay, aw] = cols[0];
      g.txt(en ? '① Its broadcast ephemeris' : '① 這顆衛星的廣播星曆', ax + 14, ay + 22, { size: 14, color: C.text, weight: 700 });
      const rec = tracks && prn ? GEO.record(prn, clock) : null;
      if (rec) {
        if (lastRec !== null && lastRec !== rec[0] && clock > lastClock) swapAt = t;   // forward in time only, not at the loop restart
        lastRec = rec[0]; lastClock = clock;
        const eph = GnssOrbit.fromRecord('G', +prn.slice(1), rec.slice(1)), D = GEO.D;
        const fresh = t - swapAt < 2.5;
        g.txt(fresh ? (en ? '↻ newer set in use' : '↻ 換上新一組星曆') : (en ? 'fixed while valid' : '有效期間內固定不變'), ax + 14, ay + 42, { size: 11.5, color: fresh ? '#d9bf8c' : C.dim, weight: 700 });
        const rows = [['√A', `${eph.sqrtA.toFixed(3)}`, en ? 'orbit size' : '軌道大小'], ['e', eph.e.toFixed(5), en ? 'shape' : '形狀'],
                      ['i₀', `${(eph.i0 / D).toFixed(2)}°`, en ? 'tilt' : '傾角'], ['Ω₀', `${(eph.omega0 / D).toFixed(2)}°`, en ? 'orientation' : '軌道面方向'],
                      ['ω', `${(eph.omega / D).toFixed(2)}°`, en ? 'perigee' : '近地點方向'], ['M₀', `${(eph.m0 / D).toFixed(2)}°`, en ? 'start point' : '起始位置']];
        const rh = n ? 26 : 29;
        rows.forEach(([k, v, d], i) => {
          const y = ay + 68 + i * rh;
          if (fresh) { ctx.fillStyle = '#d9bf8c14'; ctx.fillRect(ax + 8, y - rh / 2 + 1, aw - 16, rh - 2); }
          g.txt(k, ax + 16, y, { size: 13.5, color: '#d9bf8c', weight: 700, mono: true });
          g.txt(d, ax + 54, y, { size: 11, color: C.dim });
          g.txt(v, ax + aw - 14, y, { size: 12.5, color: C.text, align: 'right', weight: 700, mono: true });
        });
        const dy = ay + 68 + 6 * rh;
        g.line(ax + 10, dy, ax + aw - 10, dy, '#8affdd44', 1, [3, 3]);
        g.txt(en ? 'put in t (changes)' : '代入的時間（會變）', ax + 14, dy + 16, { size: 11.5, color: C.acc, weight: 700 });
        const tk = clock - rec[0], A = eph.sqrtA ** 2, M = ((eph.m0 + (Math.sqrt(GM / A ** 3) + eph.deltaN) * tk) / D % 360 + 360) % 360;
        const sgn = tk < 0 ? '−' : '+', at = Math.abs(tk);
        [['t', `${hms(clock).slice(0, 8)} GPST`], ['t − t_{oe}', `${sgn}${Math.floor(at / 60)} min ${pad2(Math.floor(at % 60))} s`], ['M', `${M.toFixed(2)}°`]].forEach(([k, v], i) => {
          const y = dy + 40 + i * (n ? 25 : 27);
          g.txt(k, ax + 16, y, { size: 13, color: C.acc, weight: 700 });
          g.txt(v, ax + aw - 14, y, { size: 12.5, color: C.acc, align: 'right', weight: 700, mono: true });
        });
      }
      // Panel 2: the same parameters with this t → a point on the orbit.
      const [bx, by, bw, bh] = cols[1];
      g.txt(en ? '② put in t → position' : '② 代入 t → 軌道上的位置', bx + 10, by + 22, { size: 14, color: C.text, weight: 700 });
      const ox = bx + bw / 2, oy = by + (n ? 128 : bh / 2 + 6), sc = (n ? 88 : 100) / 26.6e6, yaw = 0.5, pitch = 1.15;
      const proj = p => { const x1 = p[0] * Math.cos(yaw) - p[1] * Math.sin(yaw), y1 = p[0] * Math.sin(yaw) + p[1] * Math.cos(yaw); return [ox + x1 * sc, oy - (p[2] * Math.cos(pitch) - y1 * Math.sin(pitch)) * sc]; };
      const er = GEO.RE * sc, eg = ctx.createRadialGradient(ox - er * 0.3, oy - er * 0.3, er * 0.1, ox, oy, er);
      eg.addColorStop(0, '#2c74a8'); eg.addColorStop(1, '#0e2c4a');
      ctx.beginPath(); ctx.arc(ox, oy, er, 0, Math.PI * 2); ctx.fillStyle = eg; ctx.fill();
      if (orbit && orbit.length && prn) {
        ctx.beginPath(); orbit.forEach((p, i) => { const q = proj(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
        ctx.strokeStyle = C.gps + '88'; ctx.lineWidth = 1.4; ctx.stroke();
        const p = GEO.pos(prn, clock), th = WE * (clock - T0);
        const q = proj([p[0] * Math.cos(th) - p[1] * Math.sin(th), p[0] * Math.sin(th) + p[1] * Math.cos(th), p[2]]);
        g.sat(q[0], q[1], C.gps); g.txt(en ? 'GPS satellite' : 'GPS 衛星', q[0], q[1] - 16, { size: 12, color: C.gps, align: 'center', weight: 700 });
        ['x', 'y', 'z'].forEach((k, i) => g.txt(`${k} ${(p[i] / 1e3).toFixed(0).padStart(7)} km`, bx + 10, by + bh - (n ? 58 : 62) + i * (n ? 20 : 22), { size: 12, color: C.text, weight: 700, mono: true }));
      }
      if (!n) { arrow(g, 254, H / 2, 272, H / 2, C.dim); arrow(g, 528, H / 2, 548, H / 2, C.dim); }
      // Panel 3: the sky from NKUST at this moment.
      const [cx0, cy0, cw] = cols[2];
      g.txt(en ? '③ seen from NKUST' : '③ 從高科大看出去', cx0 + 10, cy0 + 22, { size: 14, color: C.text, weight: 700 });
      g.txt(en ? `Taiwan ${twTime(clock)}` : `台灣時間 ${twTime(clock)}`, cx0 + cw - 10, cy0 + 22, { size: 12, color: C.dim, align: 'right', weight: 700, mono: true });
      const sx = cx0 + cw / 2, sr = n ? 116 : 92, sy = cy0 + (n ? 168 : 150);
      ctx.strokeStyle = C.line; ctx.lineWidth = 1;
      [1, 2 / 3, 1 / 3].forEach(f => { ctx.beginPath(); ctx.arc(sx, sy, sr * f, 0, Math.PI * 2); ctx.stroke(); });
      g.txt(en ? 'N' : '北', sx, sy - sr - 10, { size: 11, color: C.dim, align: 'center', weight: 700 });
      const P = (az, el) => [sx + Math.sin(az) * sr * (90 - el) / 90, sy - Math.cos(az) * sr * (90 - el) / 90];
      let cur = null;
      if (tracks) tracks.forEach(id => {
        const l = GEO.look(id, clock); if (!l || l.el < 0) return;
        const [x, y] = P(l.az, l.el);
        if (id === prn) cur = l; else g.dot(x, y, 2.6, (id[0] === 'G' ? C.gps : C.bds) + '88');
      });
      if (cur) {
        const [x, y] = P(cur.az, cur.el);
        g.line(sx, sy, x, y, '#8affdd66', 1, [3, 4]); g.dot(x, y, 6, C.gps, 12);
        const az = ((cur.az / GEO.D) + 360) % 360;
        g.txt(en ? `azimuth ${az.toFixed(0)}°` : `方位 ${az.toFixed(0)}°`, cx0 + 10, sy + sr + 26, { size: 13, color: C.text, weight: 700, mono: true });
        g.txt(en ? `elevation ${cur.el.toFixed(1)}°` : `仰角 ${cur.el.toFixed(1)}°`, cx0 + cw - 10, sy + sr + 26, { size: 13, color: C.acc, align: 'right', weight: 700, mono: true });
      } else if (tracks) g.txt(en ? 'below the horizon now' : '此刻在地平線下', sx, sy + sr + 26, { size: 12, color: C.dim, align: 'center' });
      if (!tracks) g.txt(en ? 'Loading the ephemeris…' : '載入星曆中…', W / 2, H / 2, { size: 13, color: C.dim, align: 'center' });
    }, { h: 380, nh: 990 });
  }

  // 05: flight time and Doppler for one GPS and one BeiDou MEO satellite over the same four hours, from the real ephemeris.
  // Left: the two lines of sight from NKUST right now. Right: the whole pass as two charts, with now marked.
  {
    let series = null;
    function build() {
      const E = window.GT_EPH;
      series = [[E.prn, C.gps, LAMBDA.G], [E.bds, C.bds, LAMBDA.C]].map(([id, col, lam]) => {
        const pts = [];
        for (let s = T0 - SPAN / 2; s <= T0 + SPAN / 2; s += 60) { const l = GEO.look(id, s); pts.push({ s, el: l.el, ms: l.range / GEO.CL * 1000, khz: -l.rate / lam / 1000 }); }
        return { id, col, lam, pts };
      });
    }
    scene('po-prop-cv', (g, t, en) => {
      const { ctx, W, H, n } = g;
      if (!series && GEO.ready()) build();
      if (!series) { g.txt(en ? 'Loading the ephemeris…' : '載入星曆中…', W / 2, H / 2, { size: 13, color: C.dim, align: 'center' }); return; }
      const clock = sweep(t), now = series.map(s => { const l = GEO.look(s.id, clock); return { ...s, l, ms: l.range / GEO.CL * 1000, khz: -l.rate / s.lam / 1000 }; });
      // Left: side view from NKUST.
      const lw = n ? W : 372, gx = lw / 2, gy = n ? 292 : 330;
      const half = Math.asin(Math.min(0.99, (lw / 2) / 900));
      ctx.beginPath(); ctx.arc(gx, gy + 900, 900, Math.PI * 1.5 - half, Math.PI * 1.5 + half); ctx.strokeStyle = '#2c74a8'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = C.acc; ctx.beginPath(); ctx.moveTo(gx - 10, gy + 4); ctx.lineTo(gx + 10, gy + 4); ctx.lineTo(gx, gy - 12); ctx.fill();
      g.txt(en ? 'NKUST' : '高科大', gx, gy + 20, { size: 11.5, color: C.dim, align: 'center', weight: 700 });
      g.txt(en ? 'Side view: distance to scale' : '側視圖：距離依比例', 14, 20, { size: 12.5, color: C.dim, weight: 700 });
      const used = [];
      now.forEach((s, i) => {
        if (s.l.el < 0) return;
        const dir = Math.sin(s.l.az) >= 0 ? 1 : -1, R = s.l.range / 26e6 * (n ? 230 : 230), a = s.l.el * GEO.D;
        const x = gx + dir * Math.cos(a) * R, y = gy - 12 - Math.sin(a) * R;
        g.line(x, y, gx, gy - 12, s.col + '77', 1.2, [5, 5]);
        const p = (t * 0.7 + i * 0.5) % 1; g.dot(x + (gx - x) * p, y + (gy - 12 - y) * p, 3.5, s.col, 10);
        g.sat(x, y, s.col);
        let ly = y - 32; if (used.some(u => Math.abs(u - ly) < 34)) ly += 64; used.push(ly);
        const lx = Math.min(lw - 12, Math.max(12, x)), al = x < 90 ? 'left' : x > lw - 90 ? 'right' : 'center';
        g.txt(`${s.id[0] === 'G' ? 'GPS' : (en ? 'BeiDou' : '北斗')} · ${(s.l.range / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })} km`, lx, ly, { size: 12, color: s.col, align: al, weight: 700, mono: true });
        g.txt(en ? `elev. ${s.l.el.toFixed(0)}°` : `仰角 ${s.l.el.toFixed(0)}°`, lx, ly + 16, { size: 11, color: C.dim, align: al });
      });
      // Right: two charts over the pass.
      const cx0 = n ? 44 : 430, cx1 = W - 16, charts = n ? [[340, 520], [560, 740]] : [[40, 170], [220, 350]];
      const X = s => cx0 + (s - (T0 - SPAN / 2)) / SPAN * (cx1 - cx0);
      [['ms', en ? 'Flight time (ms)' : '飛行時間（ms）', 64, 96], ['khz', en ? 'Doppler (kHz)' : '都卜勒（kHz）', -5, 5]].forEach(([key, title, lo, hi], ci) => {
        const [y0, y1] = charts[ci], Y = v => y1 - (v - lo) / (hi - lo) * (y1 - y0);
        g.txt(title, cx0, y0 - 14, { size: 12.5, color: C.text, weight: 700 });
        g.line(cx0, y1, cx1, y1, C.line, 1); g.line(cx0, y0, cx0, y1, C.line, 1);
        [lo, (lo + hi) / 2, hi].forEach(v => { g.line(cx0 - 4, Y(v), cx1, Y(v), '#17304a', 1); g.txt(String(v), cx0 - 6, Y(v), { size: 10, color: C.dim, align: 'right', mono: true }); });
        series.forEach(s => {
          ctx.beginPath(); let on = false;
          s.pts.forEach(p => { if (p.el < 0) { on = false; return; } const x = X(p.s), y = Y(Math.max(lo, Math.min(hi, p[key]))); on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true; });
          ctx.strokeStyle = s.col; ctx.lineWidth = 1.8; ctx.stroke();
        });
        g.line(X(clock), y0, X(clock), y1, '#ffffff55', 1, [3, 3]);
        // Now: a dot on each curve, and one readout per system above the chart.
        now.forEach((s, i) => {
          if (s.l.el < 0) return;
          const v = s[key], txt = key === 'ms' ? `${v.toFixed(1)} ms` : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)} kHz`;
          g.dot(X(clock), Y(Math.max(lo, Math.min(hi, v))), 4.5, '#fff', 10);
          g.txt(txt, cx1 - (1 - i) * (n ? 100 : 112), y0 - 14, { size: 12, color: s.col, align: 'right', weight: 700, mono: true });
        });
      });
      const [, yb] = charts[1];
      [T0 - SPAN / 2, T0, T0 + SPAN / 2].forEach((s, i) => g.txt(twTime(s), X(s), yb + 16, { size: 10.5, color: C.dim, align: ['left', 'center', 'right'][i], mono: true }));
    }, { h: 380, nh: 780 });
  }

  // 06: one satellite's signal in six steps: data, code, the multiplication, the carrier (the waveform that is sent), the
  // flight time written in as a code delay, and the receiver sliding its own copy of the code until a peak shows the delay.
  // The buttons jump to any step; playback carries on from there unless paused.
  {
    const CAPS = [
      ['① 導航電文：衛星要說的內容', '軌道、時鐘與時間資訊，以 +1／−1 表示，每秒 50 個位元；每個位元持續 20 ms，變化很慢。',
       '① Navigation data: what the satellite says', 'Orbit, clock and time information as +1 / −1 at 50 bits a second; each bit lasts 20 ms and changes slowly.'],
      ['② PRN 碼：每顆衛星專屬的碼', '一串快速跳動的 ±1，每 1 ms 重複一次。每顆衛星的碼都不同，接收機靠它分辨是哪一顆：GPS 每 1 ms 有 1023 個碼片，北斗有 2046 個。',
       '② PRN code: each satellite’s own code', 'A fast ±1 sequence that repeats every 1 ms. Every satellite’s code is different, which is how a receiver tells them apart: 1023 chips per 1 ms for GPS, 2046 for BeiDou.'],
      ['③ 相乘：電文決定碼要不要翻轉', '電文是 +1 時，碼維持原樣；電文是 −1 時，整段碼上下翻轉。',
       '③ Multiply: the data decides whether the code flips', 'Where the data is +1 the code passes unchanged; where it is −1 the whole stretch flips upside down.'],
      ['④ 放上載波：這就是發出去的波形', '載波頻率由系統規定、固定不變：GPS 1575.42 MHz、北斗 1561.098 MHz。相乘結果每翻轉一次，載波相位就跳 180°（BPSK）。GeoTrust 在基頻只計算偏離中心的部分，再由 SDR 搬回 1.5 GHz。',
       '④ Onto the carrier: the waveform that is sent', 'The carrier frequency is fixed by each system: 1575.42 MHz for GPS, 1561.098 MHz for BeiDou. Each flip of the product jumps the carrier phase by 180° (BPSK). GeoTrust computes only the offset from centre at baseband; the SDR moves it back up to 1.5 GHz.'],
      ['⑤ 寫進飛行時間：碼要晚 τ 才到', '接收機是用「碼晚到多久」來量距離。所以接收端此刻收到的，必須正好是衛星 τ 之前送出的那一段碼：τ 決定碼從哪一個碼片開始。',
       '⑤ Write in the flight time: the code arrives τ late', 'A receiver measures distance by how late the code arrives. So what reaches it now must be exactly the stretch of code the satellite sent τ earlier: τ decides which chip the code starts on.'],
      ['⑥ 接收機：用對的碼，找出延遲', '接收機自己會產生每顆衛星的碼複本，一格一格往後挪，每挪一次就和收到的訊號逐項相乘再加總。剛好對齊時，總和突然變大（尖峰）；挪了多少就是晚到多久，乘上光速就是距離。換成別顆衛星的碼，怎麼挪都對不齊，就沒有尖峰。',
       '⑥ The receiver: the right code finds the delay', 'A receiver makes its own copy of each satellite’s code, slides it along one step at a time, and each time multiplies it with what arrived and adds it all up. When they line up the sum jumps (a peak); how far it slid is how late the signal is, and times the speed of light that is the distance. Another satellite’s code never lines up, so there is no peak.'],
    ];
    const N = CAPS.length, DATA = [1, -1, -1, 1, -1, 1, 1, -1], FLIP = '#ff8f7a', DUR = 6.5;
    const chip = (seed, k) => (Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453 % 1 + 1) % 1 > 0.5 ? 1 : -1;
    const noise = i => { const s = Math.sin(i * 78.233 + 1.7) * 43758.5453; return ((s - Math.floor(s)) - 0.5) * 2; };
    let beat = 0, playing = !reduced.matches, start = 0, now = 0;
    const root = document.querySelector('.ps3-ctrl'), playBtn = root?.querySelector('.ps3-play');
    const render = () => {
      if (!playBtn) return;
      const en = isEn();
      playBtn.textContent = en ? (playing ? 'Pause Ⅱ' : 'Play ▷') : (playing ? '暫停 Ⅱ' : '播放 ▷');
      playBtn.setAttribute('aria-pressed', String(playing));
    };
    const goTo = i => { beat = (i + N) % N; start = now; render(); };
    root?.querySelector('.ps3-prev').addEventListener('click', () => goTo(beat - 1));
    root?.querySelector('.ps3-next').addEventListener('click', () => goTo(beat + 1));
    playBtn?.addEventListener('click', () => { playing = !playing; start = now; render(); });
    document.addEventListener('languagechange', () => setTimeout(render));
    render();
    scene('po-signal-cv', (g, t, en) => {
      const { ctx, W, H, n } = g;
      now = t;
      if (playing && t - start > DUR) goTo(beat + 1);
      const local = t - start, rv = Math.min(1, local / 0.5);
      const SH = n ? 400 : 300;
      const x0 = n ? 14 : 168, x1 = W - (n ? 14 : 24), BIT = n ? 110 : 150, CH = n ? 9 : 10, shift = t * 30, amp = n ? 13 : 15;
      const dIdx = x => Math.floor((x + shift) / BIT), dVal = k => DATA[((k % 8) + 8) % 8];
      const data = x => dVal(dIdx(x)), code = (x, seed = 13) => chip(seed, Math.floor((x + shift) / CH));
      const trace = (y, f, col, w = 1.8, a = amp, xa = x0, xb = x1) => { ctx.beginPath(); for (let x = xa; x <= xb; x += 1) { const v = f(x); x === xa ? ctx.moveTo(x, y - v * a) : ctx.lineTo(x, y - v * a); } ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
      const label = (y, zh, enT, sub, col) => {
        if (n) { g.txt(en ? enT : zh, x0, y - amp - 12, { size: 12.5, color: col, weight: 700 }); g.txt(sub, x1, y - amp - 12, { size: 11, color: C.dim, align: 'right', mono: true }); }
        else { g.txt(en ? enT : zh, x0 - 14, y - 7, { size: 13, color: col, align: 'right', weight: 700 }); g.txt(sub, x0 - 14, y + 11, { size: 11, color: C.dim, align: 'right', mono: true }); }
      };
      const windows = [];
      for (let k = dIdx(x0); k * BIT - shift < x1; k++) { const a = Math.max(x0, k * BIT - shift), b = Math.min(x1, (k + 1) * BIT - shift); if (b > a) windows.push({ a, b, d: dVal(k) }); }
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, SH); ctx.clip();
      if (beat < 4) {
        const rows = n ? [52, 128, 204, 306] : [34, 92, 150, 232];
        label(rows[0], '導航電文', 'Navigation data', '50 bps', C.pur);
        trace(rows[0], data, C.pur);
        if (!n) windows.forEach(({ a, b, d }) => { if (b - a > 34) g.txt(d > 0 ? '+1' : '−1', (a + b) / 2, rows[0] - amp - 8, { size: 11.5, color: C.pur, align: 'center', weight: 700, mono: true }); });
        if (beat >= 1) {
          ctx.globalAlpha = beat === 1 ? rv : 1;
          label(rows[1], '這顆衛星的碼', 'This satellite’s code', '1.023 Mcps', C.gps);
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
          label(rows[2], '電文 × 碼', 'data × code', en ? 'what is sent' : '送出的內容', C.acc);
          windows.forEach(({ a, b, d }) => { ctx.save(); ctx.beginPath(); ctx.rect(a, rows[2] - amp - 4, b - a, amp * 2 + 8); ctx.clip(); trace(rows[2], x => d * code(x), d > 0 ? C.acc : FLIP); ctx.restore(); });
          ctx.globalAlpha = 1;
        }
        if (beat >= 3) {
          // The waveform that leaves the antenna: drawn larger, carrier cycles visible, every phase jump marked.
          ctx.globalAlpha = rv;
          const big = amp * 1.8, y = rows[3];
          label(y, '× 載波＝發出的波形', '× carrier = sent', 'BPSK', '#fff');
          const prod = x => data(x) * code(x);
          ctx.beginPath(); for (let x = x0; x <= x1; x += 0.5) { const v = prod(x) * Math.sin((x + shift) * 2 * Math.PI / (CH * 1.6)); x === x0 ? ctx.moveTo(x, y - v * big) : ctx.lineTo(x, y - v * big); }
          ctx.strokeStyle = C.bds; ctx.lineWidth = 1.6; ctx.stroke();
          let prev = prod(x0);
          for (let x = x0 + 1; x <= x1; x++) { const v = prod(x); if (v !== prev) { g.line(x, y - big - 6, x, y + big + 6, '#ffffffaa', 1.2, [2, 3]); prev = v; } }
          g.txt(en ? 'dashed: the phase jumps 180°' : '虛線：相位跳 180°', x1, y + big + 18, { size: 12, color: C.dim, align: 'right', weight: 700 });
          ctx.globalAlpha = 1;
        }
      } else if (beat === 4) {
        // The flight time as a code delay: what the satellite sent, and the same code arriving τ later.
        const E = window.GT_EPH || {}, D = n ? 66 : 96, ya = n ? 70 : 76, yb = n ? 200 : 186, rcode = x => code(x - D);
        label(ya, '衛星送出的碼', 'Code as sent', en ? 'at the satellite' : '衛星端', C.gps);
        trace(ya, x => code(x), C.gps);
        label(yb, '接收機收到的碼', 'Code as received', en ? `τ later` : `晚 τ 到`, C.acc);
        trace(yb, rcode, C.acc, 1.8, amp, x0 + D, x1);
        g.line(x0, yb, x0 + D, yb, '#2f5577', 1.2, [3, 4]);
        // Link the same chip edges in both rows.
        const ex = x0 + 40 - ((shift) % CH);
        for (let k = 0; k < 3; k++) { const xa = ex + k * CH * 5; g.line(xa, ya + amp + 4, xa + D, yb - amp - 4, '#ffffff33', 1, [3, 3]); }
        const by = (ya + yb) / 2;
        arrow(g, x0 + 10, by, x0 + D + 10, by, '#d9bf8c');
        g.txt(`τ = ${(E.ms ?? 72.2).toFixed(1)} ms`, x0 + D + 20, by, { size: 14, color: '#d9bf8c', weight: 700, mono: true });
        g.txt(en ? '(the delay is scaled down to fit)' : '（延遲經過縮小，方便觀看）', x1, yb + amp + 22, { size: 11, color: C.dim, align: 'right' });
      } else {
        // The receiver: the noisy input, its own copy of the code sliding along, and the sum at each offset.
        const D = n ? 66 : 96, yr = n ? 48 : 40, yl = n ? 130 : 108, recv = x => 0.35 * code(x - D) + 0.8 * noise(Math.floor(x * 1.3));
        label(yr, '收到的訊號', 'What arrives', en ? 'under the noise' : '埋在雜訊下', '#9fb4c8');
        trace(yr, recv, '#9fb4c8aa', 1, amp * 1.1);
        const sweepP = Math.min(1, local / (DUR * 0.62)), maxOff = D * 1.7, off = sweepP * maxOff;
        label(yl, '接收機的碼複本', 'Receiver’s copy', en ? `slid ${off.toFixed(0)}` : `往後挪 ${off.toFixed(0)}`, C.acc);
        trace(yl, x => code(x - off), C.acc, 1.6, amp, Math.min(x1, x0 + off), x1);
        // The sum at each offset tried so far.
        const py0 = n ? 236 : 162, py1 = SH - (n ? 30 : 26), px0 = x0, px1 = x1, PX = o => px0 + o / maxOff * (px1 - px0);
        g.line(px0, py1, px1, py1, C.line, 1);
        g.txt(en ? 'sum at each offset' : '每個位置的相乘總和', px0, py0 - (n ? 66 : 4), { size: 12, color: C.text, weight: 700 });
        const corr = (o, own) => (own ? Math.max(0, 1 - Math.abs(o - D) / (CH * 0.9)) : 0) + Math.abs(noise(Math.floor(o) * 3 + (own ? 0 : 50))) * 0.1;
        [[true, C.acc], [false, RED]].forEach(([own, col]) => {
          ctx.beginPath();
          for (let o = 0; o <= off; o += 1) { const x = PX(o), y = py1 - corr(o, own) * (py1 - py0 - 18); o ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.strokeStyle = col; ctx.lineWidth = own ? 2 : 1.2; ctx.setLineDash(own ? [] : [4, 3]); ctx.stroke(); ctx.setLineDash([]);
        });
        const lgx = n ? px0 : px1, lgy = n ? py0 - 46 : py0 + 8, lga = n ? 'left' : 'right';
        g.txt(en ? 'solid: this satellite’s code' : '實線：這顆衛星的碼', lgx, lgy, { size: 11.5, color: C.acc, align: lga, weight: 700 });
        g.txt(en ? 'dashed: another satellite’s code, no peak' : '虛線：別顆衛星的碼，沒有尖峰', lgx, lgy + (n ? 17 : 20), { size: 11.5, color: RED, align: lga, weight: 700 });
        if (off >= D) {
          const x = PX(D), y = py1 - (py1 - py0 - 18);
          g.dot(x, y, 5, '#fff', 12);
          g.line(x, y, x, py1, '#ffffff55', 1, [3, 3]);
          g.txt(en ? 'peak: lined up → the delay τ' : '尖峰：對齊了 → 延遲就是 τ', x - 12, y + 2, { size: 12.5, color: C.acc, align: 'right', weight: 700 });
        }
      }
      ctx.restore();
      // Caption.
      const cx = n ? 12 : 20, cw = W - cx * 2, cy = SH + 8, ch = H - cy - 10;
      g.box(cx, cy, cw, ch, '#2f5577');
      for (let i = 0; i < N; i++) g.dot(cx + 18 + i * 14, cy + 18, 4, i <= beat ? C.acc : '#2b4a66');
      g.txt('GPS L1 C/A · BeiDou B1I', cx + cw - 14, cy + 18, { size: 11, color: C.dim, align: 'right', mono: true });
      const c = CAPS[beat];
      ctx.globalAlpha = rv;
      g.txt(en ? c[2] : c[0], cx + 16, cy + 44, { size: n ? 14 : 16.5, color: '#fff', weight: 700 });
      wrapText(g, en ? c[3] : c[1], cx + 16, cy + (n ? 72 : 74), cw - 32, n ? 21 : 24, n ? 13 : 14.5, C.text);
      ctx.globalAlpha = 1;
    }, { h: 470, nh: 720 });
  }

  // 07: one instant across every channel. GPS channels add into Σ GPS and BeiDou channels into Σ BeiDou; each sum is moved
  // to its side of the band and the two are added; the total at the cursor is one (I, Q) sample. Doppler values are illustrative.
  {
    const CHS = [['G', 1, 1.0, 0.0, 0.9, 1245], ['G', 2, 1.3, 1.2, 0.8, -2310], ['G', 3, 0.8, 2.3, 0.7, 3080],
                 ['C', 1, 1.6, 0.6, 0.85, 860], ['C', 2, 1.15, 3.1, 0.75, -1520], ['C', 3, 0.65, 4.2, 0.8, 2140]];
    const trail = [];
    scene('po-syn-cv', (g, t, en) => {
      const { ctx, W, H, n } = g;
      const L0 = n ? 66 : 112, L1 = n ? W - 112 : 440, VX = n ? W - 12 : 540, rh = n ? 38 : 38, top = 62, amp = 11;
      const cu = 0.62, sx = L0 + (L1 - L0) * cu, U = x => (x - L0) / (L1 - L0) * 6 + t * 0.9;
      const ch = (c, x) => { const ph = 2 * Math.PI * c[2] * U(x) / 2 + c[3]; return [c[4] * Math.cos(ph), c[4] * Math.sin(ph)]; };
      const shiftBy = (z, x, sgn) => { const a = sgn * 2 * Math.PI * 0.9 * U(x) / 2, c = Math.cos(a), s = Math.sin(a); return [z[0] * c - z[1] * s, z[0] * s + z[1] * c]; };
      const sum = (sys, x) => CHS.filter(c => c[0] === sys).reduce((a, c) => { const v = ch(c, x); return [a[0] + v[0], a[1] + v[1]]; }, [0, 0]);
      const total = x => { const a = shiftBy(sum('G', x), x, 1), b = shiftBy(sum('C', x), x, -1); return [a[0] + b[0], a[1] + b[1]]; };
      const sysName = s => s === 'G' ? 'GPS' : (en ? 'BeiDou' : '北斗');
      g.txt(en ? 'Channel' : '通道', 10, 22, { size: 11.5, color: C.dim, weight: 700 });
      g.txt(en ? 'Waveform' : '波形', L0, 22, { size: 11.5, color: C.dim, weight: 700 });
      g.txt(en ? 'Doppler' : '都卜勒', VX, 22, { size: 11.5, color: C.dim, align: 'right', weight: 700 });
      const wave = (y, f, col, a, w) => { ctx.beginPath(); for (let x = L0; x <= L1; x += 2) { const v = f(x); x === L0 ? ctx.moveTo(x, y - v * a) : ctx.lineTo(x, y - v * a); } ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
      let row = 0;
      const Y = () => top + row * rh;
      ['G', 'C'].forEach(sys => {
        const col = sys === 'G' ? C.gps : C.bds;
        CHS.filter(c => c[0] === sys).forEach(c => {
          const y = Y();
          g.txt(`${sysName(sys)} ${c[1]}`, 10, y, { size: 12, color: col, weight: 700 });
          wave(y, x => ch(c, x)[0], col + 'bb', amp, 1.3);
          g.dot(sx, y - ch(c, sx)[0] * amp, 3, col, 6);
          g.txt(`${c[5] >= 0 ? '+' : '−'}${Math.abs(c[5]).toLocaleString('en-US')} Hz`, VX, y, { size: 11.5, color: C.text, align: 'right', mono: true });
          row++;
        });
        // The constellation's own sum, then its move to one side of the band.
        const y = Y();
        g.line(10, y - rh / 2 + 2, VX, y - rh / 2 + 2, '#2f5577', 1, [3, 4]);
        g.txt(`Σ ${sysName(sys)}`, 10, y, { size: 12.5, color: col, weight: 700 });
        wave(y, x => shiftBy(sum(sys, x), x, sys === 'G' ? 1 : -1)[0], col, amp * 0.55, 1.8);
        g.txt(sys === 'G' ? '→ +7.161 MHz' : '→ −7.161 MHz', VX, y, { size: n ? 10.5 : 11.5, color: col, align: 'right', weight: 700, mono: true });
        row++;
      });
      // The total.
      const ty = Y() + 10;
      g.line(10, ty - rh / 2 - 2, VX, ty - rh / 2 - 2, C.acc + '66', 1);
      g.txt(en ? 'Σ total' : 'Σ 合成', 10, ty, { size: 13, color: C.acc, weight: 700 });
      wave(ty, x => total(x)[0], C.acc, amp * 0.4, 2);
      const [I, Q] = total(sx);
      g.dot(sx, ty - I * amp * 0.4, 5, '#fff', 12);
      g.txt(en ? 'one I/Q stream' : '一路 I/Q', VX, ty, { size: 11.5, color: C.acc, align: 'right', weight: 700 });
      g.line(sx, top - 16, sx, ty + 18, '#ffffff55', 1, [3, 3]);
      g.txt(en ? 'same instant' : '同一個瞬間', sx, n ? 38 : 40, { size: 11.5, color: C.text, align: 'center', weight: 700 });
      // The I/Q plane and the sample as two numbers.
      const qx = n ? W / 2 : 680, qy = n ? ty + 150 : 196, qr = n ? 88 : 100;
      if (!n) arrow(g, VX + 10, ty - 6, qx - qr - 10, qy + 24, C.acc + 'aa');
      g.line(qx - qr, qy, qx + qr, qy, C.line, 1); g.line(qx, qy - qr, qx, qy + qr, C.line, 1);
      g.txt('I', qx + qr + 8, qy, { size: 13, color: C.dim, weight: 700, mono: true }); g.txt('Q', qx, qy - qr - 10, { size: 13, color: C.dim, align: 'center', weight: 700, mono: true });
      const k = qr / 4.2, px = qx + I * k, py = qy - Q * k;
      trail.push([px, py]); if (trail.length > 70) trail.shift();
      trail.forEach(([x, y], i) => { ctx.globalAlpha = i / trail.length * 0.6; g.dot(x, y, 2, C.acc); }); ctx.globalAlpha = 1;
      g.dot(px, py, 6, '#fff', 14);
      const n0 = Math.floor(t * 2400) % 20800;
      g.txt(`I = ${I >= 0 ? '+' : '−'}${Math.abs(I).toFixed(2)}   Q = ${Q >= 0 ? '+' : '−'}${Math.abs(Q).toFixed(2)}`, qx, qy + qr + 22, { size: 13.5, color: C.acc, align: 'center', weight: 700, mono: true });
      g.txt(en ? `sample ${n0.toLocaleString('en-US')} of 20,800 in this 1 ms` : `本 1 ms 的第 ${n0.toLocaleString('en-US')}／20,800 個樣本`, qx, qy + qr + 44, { size: 11.5, color: C.dim, align: 'center' });
    }, { h: 440, nh: 720 });
  }

  // 08: the same 332,800 computations, one at a time, four at a time, and on the GPU. Each cell is 400 samples × 1 channel;
  // the bar is the 1 ms the block is allowed. An illustration of why parallel hardware is needed, not a measurement.
  {
    const COLS = 52, ROWS = 16, CELLS = COLS * ROWS;
    const LANES = [
      { zh: ['CPU 一個核心', '一次算 1 格'], en: ['One CPU core', 'one cell at a time'], rate: 0.12, col: RED, res: ['1 ms 到了還沒算完 → 斷訊', 'Not done at 1 ms → signal breaks'] },
      { zh: ['CPU 四個核心', '一次算 4 格'], en: ['Four CPU cores', 'four cells at a time'], rate: 0.48, col: C.bds, res: ['快了 4 倍，仍然來不及', '4× faster, still too slow'] },
      { zh: ['GPU', '數千個單元同時算'], en: ['GPU', 'thousands of units at once'], rate: 3.4, col: C.acc, res: ['很快算完，還有餘裕 ✓', 'Done early, with room to spare ✓'] },
    ];
    scene('po-load-cv', (g, t, en) => {
      const { ctx, W, H, n } = g;
      const cyc = t % 7.5, p = Math.min(1, cyc / 5.5), done = cyc >= 5.5;
      LANES.forEach((ln, li) => {
        const [title, sub] = en ? ln.en : ln.zh;
        const gx = n ? 14 : 16 + li * 262, gy = n ? 76 + li * 168 : 62, gw = n ? W - 28 : 246, cw = gw / COLS, chh = n ? 5.5 : 7.5;
        if (n) { g.txt(title, gx, gy - 26, { size: 13.5, color: ln.col, weight: 700 }); g.txt(sub, gx + gw, gy - 26, { size: 11.5, color: C.dim, align: 'right' }); }
        else { g.txt(title, gx, 22, { size: 14.5, color: ln.col, weight: 700 }); g.txt(sub, gx, 42, { size: 12, color: C.dim }); }
        const f = Math.min(1, p * ln.rate), filled = li === 2 ? Math.floor(f * COLS) * ROWS : Math.floor(f * CELLS);
        for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
          const k = c * ROWS + r;
          ctx.fillStyle = k < filled ? ln.col + 'cc' : '#16304a';
          ctx.fillRect(gx + c * cw + 0.5, gy + r * chh + 0.5, cw - 1, chh - 1);
        }
        const gh = ROWS * chh;
        if (done) g.txt(en ? ln.res[1] : ln.res[0], n ? gx : gx, gy + gh + 18, { size: n ? 12.5 : 13, color: ln.col, weight: 700 });
        else g.txt(`${Math.round(f * 100)}%`, gx + gw, gy + gh + 18, { size: 12, color: C.dim, align: 'right', mono: true });
      });
      // The 1 ms the block is allowed.
      const bx = 16, bw = W - 32, by = n ? H - 44 : 268;
      ctx.fillStyle = '#16304a'; ctx.fillRect(bx, by, bw, 12);
      ctx.fillStyle = done ? RED : '#d9bf8c'; ctx.fillRect(bx, by, bw * p, 12);
      g.txt(en ? 'time used of the 1 ms' : '已經過的時間（上限 1 ms）', bx, by - 12, { size: 12, color: C.text, weight: 700 });
      g.txt(done ? (en ? '1 ms is up' : '1 ms 到') : `${(p).toFixed(2)} ms`, bx + bw, by - 12, { size: 12, color: done ? RED : '#d9bf8c', align: 'right', weight: 700, mono: true });
    }, { h: 296, nh: 590 });
  }

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
