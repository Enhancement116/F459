// Project overview page: pipeline stepper, signal-layer waveform and scroll reveals.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const isEn = () => document.documentElement.lang === 'en';
  const onScreen = (el, cb) => new IntersectionObserver(entries => cb(entries[0].isIntersecting), { threshold: 0.15 }).observe(el);

  // ---------- 02 Pipeline: auto-advancing stepper with a travelling packet ----------
  const pipe = document.getElementById('po-pipe');
  if (pipe) {
    const nodes = [...pipe.querySelectorAll('.po-node')];
    const details = [...pipe.querySelectorAll('[data-step-detail]')];
    const flow = document.getElementById('po-pipe-flow');
    const packet = pipe.querySelector('.po-packet');
    const playBtn = document.getElementById('po-play');
    const count = document.getElementById('po-step-count');
    const span = 160 * (nodes.length - 1);
    flow.style.strokeDasharray = span;
    let step = 0, playing = !reduced.matches, visible = false, elapsed = 0;

    // Compact step buttons for narrow screens, where the diagram labels get small.
    const chips = document.createElement('div');
    chips.className = 'po-chips';
    nodes.forEach((n, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.chip = i;
      b.addEventListener('click', () => { playing = false; go(i); });
      chips.append(b);
    });
    pipe.querySelector('.po-pipe-svg').after(chips);

    function labels() {
      playBtn.textContent = isEn() ? (playing ? 'Pause Ⅱ' : 'Play ▷') : (playing ? '暫停 Ⅱ' : '播放 ▷');
      playBtn.setAttribute('aria-pressed', String(playing));
      chips.querySelectorAll('button').forEach((b, i) => {
        b.textContent = `${String(i + 1).padStart(2, '0')} ${nodes[i].querySelector('.po-node-name').textContent}`;
      });
    }
    function go(i) {
      step = (i + nodes.length) % nodes.length;
      nodes.forEach((n, k) => {
        n.classList.toggle('is-active', k === step);
        n.classList.toggle('is-done', k < step);
        n.setAttribute('aria-pressed', String(k === step));
      });
      chips.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === step)));
      details.forEach((d, k) => { d.hidden = k !== step; });
      flow.style.strokeDashoffset = span - step * 160;
      packet.setAttribute('cx', 80 + step * 160);
      count.textContent = `${String(step + 1).padStart(2, '0')} / ${String(nodes.length).padStart(2, '0')}`;
      // Hint at what comes next while the tour is running.
      nodes.forEach((n, k) => n.classList.toggle('is-next', playing && k === (step + 1) % nodes.length));
      elapsed = 0;
      labels();
    }
    nodes.forEach((n, i) => {
      n.addEventListener('click', () => { playing = false; go(i); });
      n.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playing = false; go(i); } });
    });
    document.getElementById('po-prev').addEventListener('click', () => { playing = false; go(step - 1); });
    document.getElementById('po-next').addEventListener('click', () => { playing = false; go(step + 1); });
    playBtn.addEventListener('click', () => { playing = !playing; go(step); });
    document.addEventListener('languagechange', () => setTimeout(labels));
    reduced.addEventListener('change', () => { if (reduced.matches) playing = false; go(step); });
    onScreen(pipe, v => { visible = v; });
    // Each step stays up for STEP_MS; the bar under the counter shows time until the next one.
    const STEP_MS = 6000, timer = document.getElementById('po-timer');
    setInterval(() => {
      if (playing && visible && !document.hidden) {
        elapsed += 100;
        if (elapsed >= STEP_MS) go(step + 1);
      }
      timer.style.width = playing ? `${Math.min(100, elapsed / STEP_MS * 100)}%` : '0';
    }, 100);
    // SVG <animateMotion> ignores CSS, so pause it explicitly for reduced motion.
    const syncSmil = () => pipe.querySelectorAll('svg.sc').forEach(svg => reduced.matches ? svg.pauseAnimations() : svg.unpauseAnimations());
    reduced.addEventListener('change', syncSmil);
    syncSmil();
    go(0);
  }

  // ---------- 03 Signal anatomy: scrolling waveform per layer ----------
  const anatomy = document.getElementById('po-anatomy');
  const canvas = document.getElementById('po-wave');
  if (anatomy && canvas) {
    const ctx = canvas.getContext('2d');
    const tabs = [...anatomy.querySelectorAll('[data-layer]')];
    const texts = [...anatomy.querySelectorAll('[data-layer-detail]')];
    let layer = 'data', phase = 0, last = 0, visible = false, w = 0, h = 0, dpr = 1;
    const COLORS = { data: '#f6c775', code: '#bd9aff', carrier: '#70e3ed', sum: '#8affdd' };
    // Deterministic pseudo-random bits so the pattern is stable between frames.
    const bit = (seed, n) => (Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453 % 1 + 1) % 1 > 0.5 ? 1 : -1;

    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    function sample(kind, x, seed) {
      const d = bit(seed, Math.floor((x + phase * 0.4) / 180));          // slow data bits
      const c = bit(seed + 7, Math.floor((x + phase) / 14));             // fast code chips
      const carrier = Math.sin((x + phase * 1.6) * 0.42 + seed);
      if (kind === 'data') return d;
      if (kind === 'code') return d * c;
      return d * c * carrier;
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#1e3a55'; ctx.lineWidth = 1;
      for (let y = 0; y <= h; y += 35) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      for (let x = 0; x <= w; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      const mid = h / 2, amp = h * 0.32;
      ctx.lineWidth = 2;
      if (layer === 'sum') {
        // Four channels drawn faintly, their sum drawn bright.
        const seeds = [1, 2, 3, 4];
        seeds.forEach((sd, k) => {
          ctx.strokeStyle = ['#f6c77555', '#bd9aff55', '#70e3ed55', '#ff9f7a55'][k];
          ctx.beginPath();
          for (let x = 0; x <= w; x += 2) { const y = mid - sample('carrier', x, sd) * amp * 0.35; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke();
        });
        ctx.strokeStyle = COLORS.sum;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const v = seeds.reduce((a, sd) => a + sample('carrier', x, sd), 0) / 2.2;
          const y = mid - v * amp * 0.6; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      } else {
        ctx.strokeStyle = COLORS[layer];
        ctx.shadowColor = COLORS[layer]; ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let x = 0; x <= w; x += layer === 'carrier' ? 1 : 2) {
          const y = mid - sample(layer, x, 1) * amp; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = '#9ebfe1'; ctx.font = "600 12px Orbitron, sans-serif";
      ctx.fillText('+1', 8, mid - amp - 6); ctx.fillText('−1', 8, mid + amp + 16);
    }
    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.1); last = now;
      if (visible && !reduced.matches && !document.hidden) phase += dt * 40;
      if (visible) draw();
      requestAnimationFrame(frame);
    }
    tabs.forEach(tab => tab.addEventListener('click', () => {
      layer = tab.dataset.layer;
      tabs.forEach(t => t.setAttribute('aria-selected', String(t === tab)));
      texts.forEach(a => { a.hidden = a.dataset.layerDetail !== layer; });
      draw();
    }));
    new ResizeObserver(() => { resize(); draw(); }).observe(canvas);
    onScreen(canvas, v => { visible = v; });
    resize(); draw();
    requestAnimationFrame(now => { last = now; frame(now); });
  }

  // ---------- 06 Validation levels: reveal when scrolled into view ----------
  const levels = document.querySelector('.po-levels');
  if (levels) onScreen(levels, v => { if (v) levels.classList.add('is-in'); });
})();

// Chapter HUD: a vertical orbit track on wide screens, a progress line with a chapter chip on narrow ones.
// --p (0–1) is continuous: the current chapter plus how far through it the reader is.
(() => {
  const rail = document.getElementById('po-rail');
  if (!rail) return;
  const ol = rail.querySelector('ol');
  const links = [...rail.querySelectorAll('[data-rail]')];
  const sections = links.map(a => document.getElementById(a.dataset.rail));
  const sat = document.createElement('span');
  sat.className = 'po-hud-sat';
  sat.setAttribute('aria-hidden', 'true');
  ol.append(sat);
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'po-hud-chip';
  chip.setAttribute('aria-expanded', 'false');
  rail.prepend(chip);
  const close = () => { rail.classList.remove('is-open'); chip.setAttribute('aria-expanded', 'false'); };
  chip.addEventListener('click', () => chip.setAttribute('aria-expanded', String(rail.classList.toggle('is-open'))));
  links.forEach(a => a.addEventListener('click', close));
  document.addEventListener('click', e => { if (!rail.contains(e.target)) close(); });
  function update() {
    const line = innerHeight * 0.35;
    let current = 0;
    sections.forEach((sec, i) => { if (sec.getBoundingClientRect().top <= line) current = i; });
    const r = sections[current].getBoundingClientRect();
    const within = Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height)));
    rail.style.setProperty('--p', Math.min(1, (current + within) / (sections.length - 1)).toFixed(4));
    links.forEach((a, i) => {
      a.classList.toggle('is-current', i === current);
      a.classList.toggle('is-past', i < current);
      if (i === current) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
    const a = links[current];
    chip.innerHTML = `<b>${a.querySelector('b').textContent}</b><span>${a.querySelector('.pr-title').textContent}</span><i aria-hidden="true">▾</i>`;
  }
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  document.addEventListener('languagechange', () => setTimeout(update));
  update();
})();

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
  panel.querySelector('.sd-close').addEventListener('click', () => { const i = open; setOpen(-1); cells[i]?.focus(); });
  setInterval(() => {
    if (held || open >= 0 || reduced.matches || document.hidden) return;
    show((active + 1) % cells.length);
  }, 3200);
  show(0);
})();

// ---------- Chapter animations: time, orbit, propagation ----------
// Each canvas draws in a virtual space (wide on desktop, taller on phones) and only runs while on screen.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const isEn = () => document.documentElement.lang === 'en';
  const C = { grid: '#17304a', text: '#dbe8f6', dim: '#7f9bb8', gps: '#70b7ff', bds: '#f6c775', acc: '#8affdd', pur: '#bd9aff', line: '#2f5577' };

  function scene(id, draw) {
    const cv = document.getElementById(id);
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let W = 800, H = 320, k = 1, dpr = 1, t = 0, last = 0, visible = false;
    const g = {
      ctx,
      get W() { return W; }, get H() { return H; }, get n() { return W < 700; },
      txt(s, x, y, { size = 14, color = C.text, align = 'left', weight = 500, mono = false } = {}) {
        const px = size * (W < 700 ? 1.15 : 1.1);
        ctx.fillStyle = color; ctx.textBaseline = 'middle';
        if (!s.includes('_{')) {
          ctx.font = `${weight} ${px}px ${mono ? "'JetBrains Mono',Consolas,monospace" : "'Noto Sans TC',sans-serif"}`;
          ctx.textAlign = align; ctx.fillText(s, x, y); return;
        }
        // Formulas: "_{…}" is drawn as a real subscript in a math face, never as an underscore.
        const parts = []; let i = 0;
        for (const m of s.matchAll(/_\{([^}]*)\}/g)) { if (m.index > i) parts.push([s.slice(i, m.index), false]); parts.push([m[1], true]); i = m.index + m[0].length; }
        if (i < s.length) parts.push([s.slice(i), false]);
        const font = low => `${weight} ${low ? px * 0.7 : px}px 'Cambria Math','STIX Two Math','Times New Roman',serif`;
        const widths = parts.map(([p, low]) => { ctx.font = font(low); return ctx.measureText(p).width; });
        const total = widths.reduce((a, b) => a + b, 0);
        let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
        ctx.textAlign = 'left';
        parts.forEach(([p, low], k) => { ctx.font = font(low); ctx.fillText(p, cx, low ? y + px * 0.3 : y); cx += widths[k]; });
      },
      line(x1, y1, x2, y2, color, w = 1.5, dash = []) {
        ctx.beginPath(); ctx.setLineDash(dash); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); ctx.setLineDash([]);
      },
      dot(x, y, r, color, glow = 0) {
        ctx.shadowColor = color; ctx.shadowBlur = glow;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.shadowBlur = 0;
      },
      box(x, y, w, h, stroke) {
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fillStyle = '#0b1b2c'; ctx.fill();
        ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke();
      },
      sat(x, y, color) {
        ctx.fillStyle = color; ctx.fillRect(x - 6, y - 5, 12, 10);
        ctx.globalAlpha *= 0.75; ctx.fillRect(x - 21, y - 3, 12, 6); ctx.fillRect(x + 9, y - 3, 12, 6); ctx.globalAlpha /= 0.75;
      },
    };
    function resize() {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = r.width < 560 ? 400 : 800; H = r.width < 560 ? 440 : 320;
      cv.style.aspectRatio = `${W} / ${H}`;
      k = r.width / W;
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.width * H / W * dpr);
    }
    function paint() {
      ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      draw(g, reduced.matches ? 2 : t, isEn());
    }
    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.1); last = now;
      if (visible && !document.hidden) { if (!reduced.matches) t += dt; paint(); }
      requestAnimationFrame(frame);
    }
    new IntersectionObserver(e => { visible = e[0].isIntersecting; }, { threshold: 0.1 }).observe(cv);
    new ResizeObserver(() => { resize(); paint(); }).observe(cv);
    document.addEventListener('languagechange', () => setTimeout(paint));
    resize(); paint();
    requestAnimationFrame(now => { last = now; frame(now); });
  }

  // 04 Time: GPST and BDT clocks, the receiver's sample axis, and each satellite's transmit time behind it.
  scene('po-time-cv', (g, t, en) => {
    const { W, n } = g;
    const sow = 172800 + t, cw = n ? (W - 36) / 2 : 250;
    [[en ? 'GPS Time (GPST)' : 'GPS 時間（GPST）', 2437, sow, C.gps], [en ? 'BeiDou Time (BDT)' : '北斗時間（BDT）', 1081, sow - 14, C.bds]].forEach(([lab, wk, s0, c], i) => {
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
    [['G05', 67.3, C.gps], ['C21', 75.2, C.bds]].forEach(([id, tau, c], i) => {
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

  // 05 Orbit: M grows evenly, E from Kepler's equation, ν the true angle; exaggerated eccentricity.
  scene('po-orbit-cv', (g, t, en) => {
    const { ctx, W, n } = g;
    const e = 0.4, a = n ? 120 : 140, b = a * Math.sqrt(1 - e * e);
    const cx = n ? W / 2 - 20 : 230, cy = n ? 140 : 160, fx = cx + a * e;
    const M = (t * 0.55) % (Math.PI * 2);
    let E = M;
    for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const nu = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(E), Math.cos(E) - e);
    // Auxiliary circle, ellipse, Earth at the focus.
    ctx.beginPath(); ctx.setLineDash([3, 5]); ctx.arc(cx, cy, a, 0, Math.PI * 2); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.ellipse(cx, cy, a, b, 0, 0, Math.PI * 2); ctx.strokeStyle = C.gps + '99'; ctx.lineWidth = 1.6; ctx.stroke();
    const eg = ctx.createRadialGradient(fx - 5, cy - 5, 2, fx, cy, 16);
    eg.addColorStop(0, '#2c74a8'); eg.addColorStop(1, '#123a5c');
    ctx.beginPath(); ctx.arc(fx, cy, 16, 0, Math.PI * 2); ctx.fillStyle = eg; ctx.fill();
    g.dot(cx, cy, 2.5, C.dim);
    // M on the circle (uniform), E on the circle, the satellite on the ellipse.
    const mx = cx + a * Math.cos(M), my = cy - a * Math.sin(M);
    const ex = cx + a * Math.cos(E), ey = cy - a * Math.sin(E);
    const sx = cx + a * Math.cos(E), sy = cy - b * Math.sin(E);
    g.line(cx, cy, mx, my, C.dim, 1, [3, 3]); g.dot(mx, my, 4, C.dim);
    g.line(cx, cy, ex, ey, C.pur, 1.6); g.dot(ex, ey, 4, C.pur);
    g.line(ex, ey, sx, sy, C.pur + '88', 1, [2, 3]);
    g.line(fx, cy, sx, sy, C.acc, 2);
    ctx.beginPath(); ctx.arc(fx, cy, 30, 0, -nu, nu > 0); ctx.strokeStyle = C.acc; ctx.lineWidth = 2; ctx.stroke();
    g.sat(sx, sy, C.gps);
    g.txt('M', mx + 8, my - 10, { size: 12, color: C.dim, weight: 700, mono: true });
    g.txt('E', ex + 8, ey - 10, { size: 12, color: C.pur, weight: 700, mono: true });
    g.txt('ν', fx + 36, cy - 12, { size: 13, color: C.acc, weight: 700, mono: true });
    // Readout.
    const deg = v => ((v * 180 / Math.PI + 360) % 360).toFixed(1) + '°';
    const rx = n ? 16 : 470, ry = n ? 290 : 30, lh = n ? 24 : 30, vx = rx + (n ? 200 : 300);
    [[en ? 'M  even-paced angle' : 'M　等速前進的角度', M, C.dim], [en ? 'E  helper angle' : 'E　輔助角度', E, C.pur], [en ? 'ν  satellite’s real angle' : 'ν　衛星真正的角度', nu, C.acc]].forEach(([lab, v, c], i) => {
      g.txt(lab, rx, ry + i * lh, { size: 13, color: c, weight: 700 });
      g.txt(deg(v), vx, ry + i * lh, { size: 15, color: C.text, weight: 700, mono: true, align: 'right' });
    });
    const iy = ry + lh * 3 + (n ? 10 : 22);
    g.txt(en ? 'Closer to Earth it moves faster,' : '離地球近時走得快，', rx, iy, { size: 13, color: C.text, weight: 700 });
    g.txt(en ? 'farther away it moves slower.' : '離地球遠時走得慢。', rx, iy + (n ? 22 : 26), { size: 13, color: C.text, weight: 700 });
    if (!n) g.txt(en ? 'The calculation turns the even-paced angle into the real one.' : '計算就是把「等速角度」換算成「真正的角度」。', rx, iy + 62, { size: 12, color: C.dim });
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

  // 02 Journey: G05 travels start → six stations → receiver; bands show who runs each station.
  scene('po-journey-cv', (g, t, en) => {
    const { ctx, W, n } = g;
    const NODES = en ? [
      ['Start', 'ephemeris + settings', 'Starting from the real broadcast ephemeris, a start time and the NKUST site.'],
      ['Time', 'transmit time', 'Fix each sample’s receive time, then step back by G05’s flight time to when G05 transmitted.'],
      ['Orbit', 'satellite position', 'Feed that moment into G05’s ephemeris: where G05 was in space, and its clock error.'],
      ['Propagation', 'delay · Doppler', 'G05 is about 21,670 km away: a 72.3 ms flight, and the frequency is slightly high as it rises.'],
      ['Signal', 'one satellite’s signal', 'G05’s navigation data × its own PRN code, placed on the carrier.'],
      ['Combine', 'I/Q', 'G05 and the other visible satellites are computed together and added into one I/Q stream.'],
      ['Real-time', 'RF signal', 'Computed and sent as it goes: each 1 ms is handed to the SDR within 1 ms.'],
      ['Receiver', 'position · time', 'The receiver finds G05 by its PRN code and, with the others, solves a position.'],
    ] : [
      ['起點', '星曆＋設定', '從真實廣播星曆、起始時刻與高科大的接收位置出發。'],
      ['時間', '發射時刻', '確定接收端每個樣本的時刻，再扣掉 G05 的飛行時間，得到 G05 發出訊號的時刻。'],
      ['軌道', '衛星位置', '把這個時刻代入 G05 的星曆，算出 G05 當時在太空中的位置與時鐘誤差。'],
      ['傳播', '延遲・頻率偏移', 'G05 距離約 21,670 km：訊號飛 72.3 ms，而且正在升起，頻率略為偏高。'],
      ['訊號', '一顆衛星的訊號', '把 G05 的導航電文乘上它專屬的 PRN 碼，放到載波上。'],
      ['合成', 'I/Q', 'G05 和其他看得到的衛星一起計算，相加成一路 I/Q。'],
      ['即時發射', '射頻訊號', '邊算邊發：每 1 ms 的訊號在 1 ms 內算完，即時送進 SDR。'],
      ['接收機', '位置・時間', '接收機用 G05 的 PRN 碼找到它，和其他衛星一起算出位置。'],
    ];
    const HW = [[1, 3, 'CPU', C.gps], [4, 5, 'GPU · CUDA', C.pur], [6, 6, 'SDR · USRP', C.acc]];
    const per = 2.4, dwell = 1.7;
    const f = (t / per) % NODES.length, k = Math.floor(f), p = (f - k) * per;
    const moving = p > dwell && k < NODES.length - 1, q = moving ? (p - dwell) / (per - dwell) : 0;
    const ease = x => 1 - Math.pow(1 - x, 3);
    if (!n) {
      const xs = NODES.map((_, i) => 50 + i * 100), y = 150;
      HW.forEach(([a, b, lab, c]) => {
        ctx.fillStyle = c + '22'; ctx.fillRect(xs[a] - 44, 56, xs[b] - xs[a] + 88, 28);
        ctx.strokeStyle = c + '88'; ctx.lineWidth = 1; ctx.strokeRect(xs[a] - 44, 56, xs[b] - xs[a] + 88, 28);
        g.txt(lab, (xs[a] + xs[b]) / 2, 70, { size: 12, color: c, align: 'center', weight: 700 });
        for (let i = a; i <= b; i++) g.line(xs[i], 84, xs[i], y - 26, c + '55', 1, [3, 4]);
      });
      g.line(xs[0], y, xs[xs.length - 1], y, C.line, 3);
      g.line(xs[0], y, xs[k] + (moving ? (xs[k + 1] - xs[k]) * ease(q) : 0), y, C.acc, 3);
      NODES.forEach(([name, out], i) => {
        const on = i <= k, cur = i === k && !moving;
        ctx.beginPath();
        if (i === 0 || i === NODES.length - 1) ctx.roundRect(xs[i] - 22, y - 22, 44, 44, 8); else ctx.arc(xs[i], y, 22, 0, Math.PI * 2);
        ctx.fillStyle = cur ? C.acc : on ? '#123a3a' : '#0b1b2c'; ctx.fill();
        ctx.strokeStyle = on ? C.acc : C.line; ctx.lineWidth = cur ? 3 : 1.6; ctx.stroke();
        if (cur) { ctx.shadowColor = C.acc; ctx.shadowBlur = 18; ctx.stroke(); ctx.shadowBlur = 0; }
        g.txt(i === 0 ? '▶' : i === NODES.length - 1 ? 'RX' : String(i), xs[i], y + 1, { size: 14, color: cur ? '#06231f' : C.text, align: 'center', weight: 700, mono: true });
        g.txt(name, xs[i], y + 42, { size: 14, color: cur ? '#fff' : C.text, align: 'center', weight: 700 });
        g.txt(out, xs[i], y + 62, { size: 11, color: C.dim, align: 'center' });
      });
      const tx = xs[k] + (moving ? (xs[k + 1] - xs[k]) * ease(q) : 0);
      g.sat(tx, y - 44, C.gps);
      g.txt('G05', tx, y - 62 + 0, { size: 11, color: C.gps, align: 'center', weight: 700, mono: true });
      const [name, , desc] = NODES[k];
      g.box(20, 236, W - 40, 70, C.line);
      g.txt(k === 0 ? (en ? 'Start' : '起點') : k === NODES.length - 1 ? (en ? 'Arrival' : '抵達') : `${en ? 'Station' : '第'} ${k}${en ? '' : ' 站'} · ${name}`, 38, 256, { size: 13, color: C.acc, weight: 700 });
      g.txt(desc, 38, 284, { size: 14, color: C.text });
      return;
    }
    // Phone: the journey runs top to bottom.
    const x0 = 40, ys = NODES.map((_, i) => 26 + i * 42);
    g.line(x0, ys[0], x0, ys[ys.length - 1], C.line, 3);
    g.line(x0, ys[0], x0, ys[k] + (moving ? (ys[k + 1] - ys[k]) * ease(q) : 0), C.acc, 3);
    NODES.forEach(([name, out], i) => {
      const on = i <= k, cur = i === k && !moving;
      ctx.beginPath(); ctx.arc(x0, ys[i], 15, 0, Math.PI * 2);
      ctx.fillStyle = cur ? C.acc : on ? '#123a3a' : '#0b1b2c'; ctx.fill();
      ctx.strokeStyle = on ? C.acc : C.line; ctx.lineWidth = cur ? 2.5 : 1.4; ctx.stroke();
      g.txt(i === 0 ? '▶' : i === NODES.length - 1 ? 'RX' : String(i), x0, ys[i] + 1, { size: 11, color: cur ? '#06231f' : C.text, align: 'center', weight: 700, mono: true });
      g.txt(`${name}　${out}`, x0 + 26, ys[i], { size: 12, color: cur ? '#fff' : C.text, weight: cur ? 700 : 500 });
      const hw = HW.find(([a, b]) => i >= a && i <= b);
      if (hw) g.txt(hw[2].split(' ')[0], W - 14, ys[i], { size: 11, color: hw[3], align: 'right', weight: 700, mono: true });
    });
    g.box(10, 362, W - 20, 70, C.line);
    const words = NODES[k][2];
    // Wrap by words in English, by characters in Chinese.
    const lines = [], perLine = en ? 46 : 22;
    if (en) { let cur = ''; for (const w of words.split(' ')) { if ((cur + ' ' + w).trim().length > perLine) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } lines.push(cur); }
    else for (let i = 0; i < words.length; i += perLine) lines.push(words.slice(i, i + perLine));
    lines.slice(0, 3).forEach((l, i) => g.txt(l, 22, 382 + i * 20, { size: 12, color: C.text }));
  });

  // Diagrams, tables and formula lists reveal on scroll; CSS does the motion, this only flags visibility.
  document.documentElement.classList.add('po-js');
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll('.po-sys, .po-table-wrap, .po-eqs, .po-grid4, .po-step-more, .po-bounds, .po-stations').forEach(el => io.observe(el));
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
      delimiters: [{ left: '\(', right: '\)', display: false }], ignoredClasses: ['po-tex'], throwOnError: false,
    });
  };
  render();
  document.addEventListener('languagechange', () => setTimeout(render, 30));
})();
