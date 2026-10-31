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

// Chapter rail: highlight the section in view and fill the line up to it.
(() => {
  const rail = document.getElementById('po-rail');
  if (!rail) return;
  const links = [...rail.querySelectorAll('[data-rail]')];
  const sections = links.map(a => document.getElementById(a.dataset.rail));
  const fill = document.createElement('span');
  fill.className = 'po-rail-fill';
  rail.querySelector('ol').append(fill);
  function update() {
    const line = rail.getBoundingClientRect().bottom + 40;
    let current = -1;
    sections.forEach((sec, i) => { if (sec.getBoundingClientRect().top <= line) current = i; });
    links.forEach((a, i) => {
      a.classList.toggle('is-current', i === current);
      a.classList.toggle('is-past', i < current);
      if (i === current) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
    // The line spans from the first to the last dot: (n − 1) / n of the rail width.
    const n = links.length;
    fill.style.width = current < 0 ? '0' : `calc(${current / (n - 1)} * (100% - 100% / ${n}))`;
  }
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
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
