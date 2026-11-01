// Site-wide visual effects: a static star field with satellites crossing, one distinct entrance per kind of
// content, cards that tilt toward the pointer and a light border on the main visuals. Built to cost almost nothing
// per frame: nothing here repaints continuously.
// Everything is decorative and switches off for reduced motion.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  // Lighter on phones, tablets and low-end machines; no star field at all when the device asks to save data.
  const LOW = !finePointer || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const NO_SKY = (navigator.connection && navigator.connection.saveData) || (navigator.deviceMemory || 8) <= 2;
  document.documentElement.classList.add('fx-on');

  // ---------- The real sky over the observation site: drawn once, turned by the GPU ----------
  // All 88 constellation figures (d3-celestial catalogue) and, on capable devices, the naked-eye stars, placed
  // around the observer's visible celestial pole. Only stars that ever rise at that latitude are drawn, and the
  // layer starts at the site's real sidereal time, then turns around the pole the way the sky does there.
  // Default site: NKUST. When the homepage globe moves the observation site, the sky crossfades to that place.
  // Scrolling dims the sky and lets it drift, so it never competes with the text being read.
  const CAT = 'https://cdn.jsdelivr.net/npm/d3-celestial@0.7.35/data/';
  const NKUST = { lat: 22.758, lon: 120.338, name: 'NKUST' };
  // Only a few names: the sky is a backdrop, not something to read.
  const LABELLED = new Set(['Ori', 'Sco', 'Cru', 'Cas']);
  const DIPPER = [[165.93, 61.75], [165.46, 56.38], [178.46, 53.69], [183.86, 57.03], [193.51, 55.96], [200.98, 54.93], [206.89, 49.31]];
  let site = NKUST, lines = null, names = null, stars = null;
  const isEn = () => document.documentElement.lang === 'en';
  const lstDeg = lon => { const d = Date.now() / 86400000 + 2440587.5 - 2451545; return ((280.46061837 + 360.98564736629 * d + lon) % 360 + 360) % 360; };
  const wrap = document.createElement('div');
  wrap.className = 'fx-skywrap';
  wrap.setAttribute('aria-hidden', 'true');
  const rot = document.createElement('div');
  rot.className = 'fx-skyrot';
  const sky = document.createElement('canvas');
  sky.className = 'fx-sky';
  rot.append(sky); wrap.append(rot);
  if (!NO_SKY) document.body.prepend(wrap);
  const bvColor = bv => { const b = Math.max(-0.4, Math.min(2, +bv || 0.6)); return b < 0 ? '#cfe0ff' : b < 0.5 ? '#eef4ff' : b < 1 ? '#fff1d6' : b < 1.5 ? '#ffd2a1' : '#ffb07a'; };
  function label(x, y, zh, en, zh2 = '', en2 = '') {
    const lb = document.createElement('span');
    lb.className = 'fx-skylabel';
    lb.style.left = x + 'px'; lb.style.top = y + 'px';
    lb.innerHTML = `<b data-zh="${zh}" data-en="${en}">${isEn() ? en : zh}</b>` + (zh2 ? `<small data-zh="${zh2}" data-en="${en2}">${isEn() ? en2 : zh2}</small>` : '');
    rot.append(lb);
  }
  function paintSky() {
    const W = innerWidth, H = innerHeight, narrow = W < 760;
    const south = site.lat < 0, s = south ? -1 : 1, latA = Math.abs(site.lat);
    const px = narrow ? W * 0.5 : W * 0.13, py = narrow ? H * 0.07 : H * 0.3;      // visible pole on screen
    const R = Math.ceil(Math.hypot(Math.max(px, W - px), Math.max(py, H - py))) + 60;
    const reach = Math.min(178, 180 - latA + 2);                                   // degrees from the pole that ever rise here
    const k = R / Math.max(120, reach);
    sky.width = sky.height = R * 2;
    Object.assign(rot.style, { width: R * 2 + 'px', height: R * 2 + 'px', left: px - R + 'px', top: py - R + 'px' });
    rot.style.setProperty('--rot0', (90 - s * lstDeg(site.lon)) + 'deg');
    wrap.classList.toggle('is-south', south);
    rot.querySelectorAll('.fx-skylabel').forEach(n => n.remove());
    const ctx = sky.getContext('2d'), c0 = R;
    // RA/Dec in degrees → layer pixels; south mirrors so figures keep their true handedness.
    const P = (ra, dec) => { const th = 90 - s * dec; if (th > reach) return null; const a = s * ra * Math.PI / 180; return [c0 + th * k * Math.cos(a), c0 + th * k * Math.sin(a)]; };
    const rnd = (() => { let x = 20260922; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); })();
    // Milky Way along the galactic plane.
    const NGP_RA = 192.85948 * Math.PI / 180, NGP_DE = 27.12825 * Math.PI / 180, L_NCP = 122.93192 * Math.PI / 180;
    const gal = (l, b) => {
      const sd = Math.sin(NGP_DE) * Math.sin(b) + Math.cos(NGP_DE) * Math.cos(b) * Math.cos(L_NCP - l);
      const ra = NGP_RA + Math.atan2(Math.cos(b) * Math.sin(L_NCP - l), Math.cos(NGP_DE) * Math.sin(b) - Math.sin(NGP_DE) * Math.cos(b) * Math.cos(L_NCP - l));
      return [(ra * 180 / Math.PI + 360) % 360, Math.asin(sd) * 180 / Math.PI];
    };
    for (let l = 0; l < 360; l += 1.5) {
      const q = P(...gal(l * Math.PI / 180, 0));
      if (!q) continue;
      const g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], 6 * k);
      g.addColorStop(0, 'rgba(130,155,215,.018)'); g.addColorStop(1, 'rgba(130,155,215,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q[0], q[1], 6 * k, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < (LOW ? 2 : 6); i++) {
        const d = P(...gal((l + rnd() * 1.5) * Math.PI / 180, (rnd() + rnd() - 1) * 7 * Math.PI / 180));
        if (d) { ctx.fillStyle = `rgba(205,218,255,${0.1 + rnd() * 0.25})`; ctx.fillRect(d[0], d[1], 0.9, 0.9); }
      }
    }
    // Stars: the real catalogue when loaded, otherwise a faint stand-in field.
    if (stars) stars.forEach(([ra, dec, mag, col]) => {
      const q = P(ra, dec); if (!q) return;
      const r = Math.max(0.45, 2.6 - mag * 0.42);
      if (mag < 2.2) {
        const g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r * 3.5);
        g.addColorStop(0, col + 'aa'); g.addColorStop(0.25, col + '33'); g.addColorStop(1, col + '00');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q[0], q[1], r * 3.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = Math.min(0.8, 0.25 + (6 - mag) * 0.1);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    });
    else for (let i = 0, n = LOW ? 500 : 1100; i < n; i++) {
      const q = P(rnd() * 360, Math.asin(rnd() * 2 - 1) * 180 / Math.PI); if (!q) continue;
      const m = Math.pow(rnd(), 3);
      ctx.fillStyle = `rgba(220,232,255,${0.2 + m * 0.6})`; ctx.fillRect(q[0], q[1], 0.6 + m * 1.4, 0.6 + m * 1.4);
    }
    // All constellation figures.
    if (lines) {
      ctx.strokeStyle = 'rgba(138,200,255,.08)'; ctx.lineWidth = 0.7;
      lines.forEach(f => f.geometry.coordinates.forEach(seg => {
        ctx.beginPath(); let pen = false;
        seg.forEach(([lon, lat]) => { const q = P((lon + 360) % 360, lat); if (!q) { pen = false; return; } pen ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); pen = true; });
        ctx.stroke();
        if (!stars) seg.forEach(([lon, lat]) => { const q = P((lon + 360) % 360, lat); if (q) { ctx.fillStyle = '#e6eeff'; ctx.beginPath(); ctx.arc(q[0], q[1], 1.3, 0, Math.PI * 2); ctx.fill(); } });
      }));
      // The Big Dipper is traced brighter: BeiDou is named after it.
      ctx.strokeStyle = 'rgba(138,255,221,.22)'; ctx.lineWidth = 1; ctx.beginPath();
      [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]].forEach(([a, b]) => {
        const qa = P(...DIPPER[a]), qb = P(...DIPPER[b]); if (qa && qb) { ctx.moveTo(qa[0], qa[1]); ctx.lineTo(qb[0], qb[1]); }
      });
      ctx.stroke();
    }
    // Labels: main constellations, the Big Dipper, and the visible pole with its height above this horizon.
    if (names) names.forEach(f => {
      if (!LABELLED.has(f.id) || f.id === 'UMi') return;
      const [lon, lat] = f.geometry.coordinates, q = P((lon + 360) % 360, lat); if (!q) return;
      const extra = f.id === 'Cru' && !south ? ['此地低空可見', 'low in this sky'] : ['', ''];
      label(q[0], q[1], f.properties.zh || f.properties.name, f.properties.en || f.properties.name, ...extra);
    });
    const dq = P(186, 56);
    if (dq) label(dq[0] + 40, dq[1] - 30, '北斗七星', 'Big Dipper', '北斗衛星系統之名', 'BeiDou is named after it');
    label(c0 + 6, c0, south ? '南天極' : '北極星', south ? 'South celestial pole' : 'Polaris', `在此地仰角約 ${latA.toFixed(1)}°`, `${latA.toFixed(1)}° above this horizon`);

  }
  // Catalogue: lines and names for everyone; naked-eye stars only where the device can afford it.
  function loadCatalogue() {
    Promise.all([fetch(CAT + 'constellations.lines.json').then(r => r.json()), fetch(CAT + 'constellations.json').then(r => r.json())])
      .then(([l, n]) => { lines = l.features; names = n.features; paintSky(); }).catch(() => {});
    if (!LOW) fetch(CAT + 'stars.6.json').then(r => r.json()).then(d => {
      stars = d.features.filter(f => f.properties.mag <= 5.2).map(f => [(f.geometry.coordinates[0] + 360) % 360, f.geometry.coordinates[1], f.properties.mag, bvColor(f.properties.bv)]);
      paintSky();
    }).catch(() => {});
  }
  // The homepage globe announces a new observation site; crossfade the sky to it.
  document.addEventListener('gt-site', e => {
    const { lat, lon, custom } = e.detail;
    site = custom ? { lat, lon, name: '' } : NKUST;
    wrap.classList.add('is-switching');
    setTimeout(() => { paintSky(); wrap.classList.remove('is-switching'); }, 450);
  });
  if (!NO_SKY) {
    const veil = document.createElement('div');
    veil.className = 'fx-veil';
    veil.setAttribute('aria-hidden', 'true');
    document.body.prepend(veil);
    paintSky();
    loadCatalogue();
    let rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(paintSky, 250); });
    document.addEventListener('languagechange', () => setTimeout(() => {
      wrap.querySelectorAll('[data-zh]').forEach(n => { n.textContent = isEn() ? n.dataset.en : n.dataset.zh; });
    }));
    if (!reduced) {
      // Two satellites cross the sky on long CSS loops.
      for (let i = 0; i < 2; i++) {
        const sat = document.createElement('span');
        sat.className = 'fx-sat';
        sat.style.setProperty('--y', (18 + i * 34) + 'vh');
        sat.style.setProperty('--d', (i * -11) + 's');
        sat.setAttribute('aria-hidden', 'true');
        document.body.prepend(sat);
      }
      // While the page scrolls, the sky dims and drifts with it; it settles back once scrolling stops.
      let st = 0, queued = false;
      addEventListener('scroll', () => {
        wrap.classList.add('is-scrolling');
        clearTimeout(st); st = setTimeout(() => wrap.classList.remove('is-scrolling'), 450);
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; wrap.style.transform = `translate3d(0, ${(-Math.sin(scrollY / 1400) * 40).toFixed(1)}px, 0)`; });
      }, { passive: true });
    }
  }

  // ---------- Entrances: each kind of content has its own, played once when it scrolls in ----------
  // Titles are wiped in with an underline sweep; key points slide with a light pass; card groups flip up
  // one by one; big visuals are scanned in from the top; the G05 example and station gauge slide from the left;
  // hand-off lines and notes simply fade.
  const KINDS = [
    ['fx-wipe', '.po-sec-head h2, .home-head h2, .wh-head h2, .mission-invite > h2, .po-features h2, .po-sub'],
    ['fx-bar', '.po-point, .home-lead, .wh-mission'],
    ['fx-flip', '.po-why, .wh-uses, .wh-steps, .po-stations, .po-grid4, .po-sys, .po-rt-facts'],
    ['fx-scan', '.po-viz, .hf-stage, .po-arch, .po-rt-stage, .po-anatomy, .po-pipe, #globe-console'],
    ['fx-slide', '.po-trace, .po-trk, .hf-steps'],
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
