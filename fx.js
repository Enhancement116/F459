// Site-wide visual effects: a live star field with passing satellites, a cursor glow, one distinct entrance
// per kind of content, cards that tilt toward the pointer and a rotating light on the main visuals.
// Everything is decorative and switches off for reduced motion.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  document.documentElement.classList.add('fx-on');

  // ---------- Star field with constellation lines and satellites crossing ----------
  const sky = document.createElement('canvas');
  sky.className = 'fx-sky';
  sky.setAttribute('aria-hidden', 'true');
  document.body.prepend(sky);
  const ctx = sky.getContext('2d');
  let W = 0, H = 0, dpr = 1, mx = 0, my = 0, tmx = 0, tmy = 0;
  const stars = [], sats = [];
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    sky.width = W * dpr; sky.height = H * dpr;
    stars.length = 0;
    const n = Math.min(220, Math.round(W * H / 7000));
    for (let i = 0; i < n; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, z: 0.25 + Math.random() * 0.75, ph: Math.random() * 6.28 });
  }
  function spawnSat() {
    const fromLeft = Math.random() < 0.5;
    sats.push({ x: fromLeft ? -40 : W + 40, y: H * (0.1 + Math.random() * 0.6), vx: (fromLeft ? 1 : -1) * (60 + Math.random() * 60), vy: (Math.random() - 0.5) * 20, life: 0 });
  }
  let last = performance.now(), nextSat = 1.5;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sc = scrollY * 0.04, t = now / 1000;
    const pts = stars.map(s => {
      const x = (s.x + mx * 18 * s.z + W) % W, y = ((s.y - sc * s.z + my * 18 * s.z) % H + H) % H;
      return [x, y, s];
    });
    // Constellation lines between near, bright stars.
    ctx.lineWidth = 0.6;
    for (let i = 0; i < pts.length; i += 2) for (let j = i + 2; j < pts.length; j += 2) {
      const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], d = dx * dx + dy * dy;
      if (d < 9000) { ctx.strokeStyle = `rgba(112,183,255,${(1 - d / 9000) * 0.16})`; ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke(); }
    }
    pts.forEach(([x, y, s]) => {
      const a = 0.35 + 0.45 * s.z * (0.6 + 0.4 * Math.sin(t * 1.4 + s.ph));
      ctx.fillStyle = s.z > 0.85 ? `rgba(138,255,221,${a})` : `rgba(210,228,255,${a})`;
      ctx.fillRect(x, y, s.z * 1.8, s.z * 1.8);
    });
    // Satellites with a fading trail.
    nextSat -= dt;
    if (nextSat <= 0) { spawnSat(); nextSat = 4 + Math.random() * 5; }
    for (let i = sats.length - 1; i >= 0; i--) {
      const s = sats[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.life += dt;
      const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 0.9, s.y - s.vy * 0.9);
      g.addColorStop(0, 'rgba(138,255,221,.7)'); g.addColorStop(1, 'rgba(138,255,221,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.9, s.y - s.vy * 0.9); ctx.stroke();
      ctx.fillStyle = '#e6fff8'; ctx.shadowColor = '#8affdd'; ctx.shadowBlur = 10;
      ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3); ctx.shadowBlur = 0;
      if (s.x < -80 || s.x > W + 80) sats.splice(i, 1);
    }
    if (!document.hidden) requestAnimationFrame(frame); else setTimeout(() => requestAnimationFrame(frame), 500);
  }
  resize();
  addEventListener('resize', resize);
  if (reduced) { last = performance.now(); nextSat = 1e9; frame(last); }
  else requestAnimationFrame(frame);

  // ---------- Cursor glow ----------
  const glow = document.createElement('div');
  glow.className = 'fx-glow';
  glow.setAttribute('aria-hidden', 'true');
  document.body.append(glow);
  addEventListener('pointermove', e => {
    tmx = e.clientX / innerWidth - 0.5; tmy = e.clientY / innerHeight - 0.5;
    glow.style.setProperty('--x', e.clientX + 'px'); glow.style.setProperty('--y', e.clientY + 'px');
  }, { passive: true });

  // ---------- Entrances: each kind of content has its own, played once when it scrolls in ----------
  // Titles are wiped in with an underline sweep; key points slide with a light pass; card groups flip up
  // one by one; big visuals are scanned in from the top; the G05 example and station gauge slide from the left;
  // hand-off lines and notes simply fade.
  const KINDS = [
    ['fx-wipe', '.po-sec-head h2, .home-head h2, .wh-head h2, .mission-invite > h2, .po-features h2, .po-sub'],
    ['fx-bar', '.po-point, .home-lead, .wh-mission'],
    ['fx-flip', '.po-why, .wh-uses, .wh-steps, .po-stations, .po-grid4, .po-sys, .po-rt-facts'],
    ['fx-scan', '.po-viz, .hf-stage, .po-arch, .po-rt-stage, .po-anatomy, .po-pipe, #globe-console'],
    ['fx-slide', '.po-trace, .po-ring-nav, .hf-steps'],
    ['fx-fade', '.po-sec > .po-from, .po-note, .po-deep, .po-bridge-next'],
  ];
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('fx-in');
    io.unobserve(en.target);
  }), { threshold: 0.12 });
  if (!reduced) KINDS.forEach(([cls, sel]) => document.querySelectorAll(sel).forEach(el => {
    if ([...el.classList].some(c => c.startsWith('fx-') && c !== 'fx-tilt')) return;
    el.classList.add(cls);
    if (cls === 'fx-bar') { const sw = document.createElement('span'); sw.className = 'fx-sweep'; sw.setAttribute('aria-hidden', 'true'); if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; el.append(sw); }
    io.observe(el);
  }));

  // ---------- Rotating light border on key panels ----------
  document.querySelectorAll('.po-viz, .hf-stage, #globe-console').forEach(el => {
    const ring = document.createElement('span');
    ring.className = 'fx-ring';
    ring.setAttribute('aria-hidden', 'true');
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.append(ring);
  });

  // ---------- Cards tilt toward the pointer, with a light glare ----------
  if (finePointer && !reduced) {
    document.querySelectorAll('.po-card, .po-station, .po-sys-box, .wh-uses article, .wh-steps li, .po-level, .po-rt-facts > div').forEach(card => {
      card.classList.add('fx-tilt');
      const glare = document.createElement('span');
      glare.className = 'fx-glare';
      glare.setAttribute('aria-hidden', 'true');
      card.append(glare);
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--rx', ((0.5 - y) * 8).toFixed(2) + 'deg');
        card.style.setProperty('--ry', ((x - 0.5) * 10).toFixed(2) + 'deg');
        card.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    });
  }
})();
