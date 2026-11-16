// Test page: free, inertial scrolling; every section reports its progress to CSS (--p while pinned,
// --e while entering) and the canvases read the same numbers. The sky section uses the day's broadcast
// ephemeris (data/latest.json, through gnss-orbit.js) for the satellites over NKUST.
(() => {
  const root = document.documentElement;
  const calm = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const touch = matchMedia('(pointer:coarse)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  // ---- Language: Chinese or English, kept in the same place as the rest of the site (f459-language).
  const isEn = () => root.lang === 'en';
  const L = (zh, en) => isEn() ? en : zh;
  const applyLang = en => {
    root.lang = en ? 'en' : 'zh-Hant';
    document.querySelectorAll('[data-en]').forEach(el => {
      if (el.dataset.zh === undefined) el.dataset.zh = el.innerHTML;
      el.innerHTML = en ? el.dataset.en : el.dataset.zh;
    });
    document.querySelectorAll('[data-en-label]').forEach(el => el.setAttribute('aria-label', en ? el.dataset.enLabel : el.dataset.zhLabel));
    const btn = document.getElementById('language'); if (btn) btn.textContent = en ? '中文 ↗' : 'EN ↗';
    try { localStorage.setItem('f459-language', en ? 'en' : 'zh'); } catch (e) {}
    document.dispatchEvent(new Event('languagechange'));
  };
  let startEn = false;
  try { startEn = localStorage.getItem('f459-language') === 'en'; } catch (e) {}
  document.getElementById('language')?.addEventListener('click', () => applyLang(!isEn()));
  if (startEn) applyLang(true);

  const sections = $$('.sc');
  const state = new Map(sections.map(s => [s, { p: 0, e: 0 }]));
  const [, secEvery, secWeak] = sections;
  // Titles fade in once when they come into view.
  const shower = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('show'); shower.unobserve(en.target); } }), { threshold: 0.2 });
  $$('.reveal').forEach(el => shower.observe(el));
  let vw = innerWidth, vh = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);

  // ---- Inertial wheel scrolling (mouse and trackpad); touch keeps the native scroll.
  let target = scrollY, y = scrollY, running = false, holdUntil = 0;
  const consoleEl = document.querySelector('.sc-sky .globe-console');
  // Where the page settles for the live globe: on wide screens the console sits just under the header and fills
  // the rest of the screen; on narrower ones, the top of the section.
  const skyTop = () => { const sky = $('.sc-sky'); if (!consoleEl || innerWidth <= 1100) return sky.offsetTop; return Math.round(consoleEl.getBoundingClientRect().top + scrollY - 88); };
  if (consoleEl) {
    // Working the globe brings the whole block to fill the screen first. The page itself is never held:
    // the globe takes the wheel only for zooming (globe.js), and hands it back once the reader stops.
    consoleEl.addEventListener('pointerdown', () => {
      const top = skyTop();
      if (Math.abs(scrollY - top) > 2) {
        if (calm || touch) { scrollTo({ top, behavior: calm ? 'auto' : 'smooth' }); return; }
        if (!running) y = scrollY;
        target = top;
        if (!running) { running = true; requestAnimationFrame(ease); }
      }
    });
  }
  // The home page has one presentation, so it has no reading-mode switch. A reader whose system asks for
  // reduced motion still gets native scrolling and no motion. The site-wide reading choice (f459-reading) is
  // left as it is, for the guided pages.
  const plain = calm;
  root.classList.toggle('t-plain', plain);
  const ease = () => {
    y += (target - y) * 0.08;
    if (Math.abs(target - y) < 0.4) { y = target; running = false; }
    scrollTo(0, y);
    if (running) requestAnimationFrame(ease);
  };
  if (!calm && !touch) {
    addEventListener('wheel', e => {
      // The globe's side panel scrolls by itself.
      if (plain || e.ctrlKey || e.defaultPrevented || e.target.closest?.('.globe-panel')) return;
      e.preventDefault();
      // Just after stopping on the globe, the rest of that same flick is ignored.
      if (performance.now() < holdUntil) return;
      if (!running) y = scrollY;
      const before = running ? target : scrollY;
      target = clamp(before + e.deltaY * (e.deltaMode === 1 ? 40 : 1), 0, root.scrollHeight - vh);
      // The live globe is one full screen: scrolling into it from either side stops exactly on it once,
      // so a fast scroll cannot skip past it; the next scroll carries on.
      const sky = $('.sc-sky');
      if (sky) {
        const top = skyTop();
        const stop = (before < top - 2 && target > top - vh * 0.15) || (before > top + 2 && target < top + vh * 0.15 && before <= top + sky.offsetHeight);
        if (stop) { target = top; holdUntil = performance.now() + 700; }
      }
      if (!running) { running = true; requestAnimationFrame(ease); }
    }, { passive: false });
    addEventListener('scroll', () => { if (!running) target = y = scrollY; }, { passive: true });
  }

  // ---- The home page's parallax star layers (same code as scroll-scenes.js), so both backgrounds match.
  const parallax = document.createElement('div');
  parallax.className = 'sys-sky';
  parallax.setAttribute('aria-hidden', 'true');
  const LAYERS = [
    { tile: 380, stars: 70, size: [0.4, 0.9], alpha: [0.25, 0.55], speed: 0.04 },
    { tile: 520, stars: 34, size: [0.8, 1.4], alpha: [0.4, 0.8], speed: 0.12 },
    { tile: 700, stars: 12, size: [1.3, 2.2], alpha: [0.7, 1], speed: 0.26, glow: true },
  ].map(L => {
    const c = document.createElement('canvas');
    c.width = c.height = L.tile;
    const g = c.getContext('2d');
    const rnd = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < L.stars; i++) {
      const x = rnd(0, L.tile), y = rnd(0, L.tile), r = rnd(...L.size);
      g.fillStyle = `rgba(${Math.random() < 0.3 ? '255,226,170' : '200,220,255'},${rnd(...L.alpha).toFixed(2)})`;
      if (L.glow) { g.shadowColor = 'rgba(150,190,255,.9)'; g.shadowBlur = 6; }
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const el = document.createElement('i');
    el.style.backgroundImage = `url(${c.toDataURL()})`;
    el.style.backgroundSize = `${L.tile}px`;
    el.style.height = `calc(100% + ${L.tile}px)`;
    parallax.append(el);
    return { el, ...L };
  });
  // A faint orbit ring is the nearest layer and moves fastest.
  const ring = document.createElement('b');
  parallax.append(ring);
  document.body.prepend(parallax);
  // fx.js adds its sky after this script; move these layers back underneath it, in the same order as on the home page.
  addEventListener("DOMContentLoaded", () => document.body.prepend(parallax));
  const moveSky = () => {
    const y = scrollY;
    LAYERS.forEach(L => { L.el.style.transform = `translate3d(0,${-(y * L.speed % L.tile).toFixed(1)}px,0)`; });
    const span = Math.max(1, root.scrollHeight - innerHeight);
    ring.style.transform = `translate3d(0,${(40 - y / span * 80).toFixed(2)}vh,0) rotate(${(-18 + y / span * 50).toFixed(2)}deg)`;
  };


  // ---- Section progress, and the page colour blending from one section's colour to the next.
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const colours = sections.map(s => hex(s.dataset.bg || '#04060c'));
  const measure = () => {
    let bg = colours[0];
    sections.forEach((s, i) => {
      const r = s.getBoundingClientRect(), st = state.get(s);
      st.p = clamp(-r.top / Math.max(1, r.height - vh));
      st.e = clamp((vh - r.top) / vh);
      s.style.setProperty('--p', st.p.toFixed(4));
      s.style.setProperty('--e', st.e.toFixed(4));
      if (r.top < vh && i > 0) {
        const k = clamp((vh - r.top) / vh), a = colours[i - 1], b = colours[i];
        bg = a.map((v, j) => Math.round(v + (b[j] - v) * k));
      }
    });
    // How far the reader has started into the page: the opening Earth recedes with it.
    sections[0].style.setProperty('--hs', clamp(scrollY / (vh * 0.6)).toFixed(3));
    moveSky();
    root.classList.toggle('sys-scrolled', scrollY > 8);
    root.style.setProperty('--page', (scrollY / Math.max(1, root.scrollHeight - vh)).toFixed(4));
  };

  // ---- 02: three phone screens side by side, read 1 → 2 → 3, on real satellite imagery (Esri World Imagery tiles).
  // The third loops: Kaohsiung, then a swing across the globe, then the Arc de Triomphe in Paris.
  const phones = $$('.ph-screen');
  let land = null;
  if (window.d3 && window.topojson && window.GnssOrbit) GnssOrbit.json('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json').then(topo => {
    land = topojson.feature(topo, topo.objects.land);
  }).catch(() => {});
  const HOME = [120.3382, 22.7584], PARIS = [2.2950, 48.8738];
  const TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/';
  const tiles = new Map();
  const tile = (z, x, y) => { const k = `${z}/${y}/${x}`; if (!tiles.has(k)) { const im = new Image(); im.src = TILE + k; tiles.set(k, im); } return tiles.get(k); };
  // Draws the imagery centred on [lon, lat] at zoom z into the box (x0, y0, w, h) of a canvas context.
  const merc = ([lon, lat]) => { const s = Math.sin(lat * Math.PI / 180); return [(lon + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)]; };
  const drawImagery = (g, centre, zf, x0, y0, w, h, base) => {
    const z = Math.max(1, Math.floor(zf)), scale = Number(base) * 2 ** (zf - z);
    const n = 2 ** z, [mx, my] = merc(centre), px = mx * n * 256, py = my * n * 256;
    // A coarser layer underneath fills any tile that has not arrived yet.
    if (!base.fallback && z > 3) drawImagery(g, centre, zf - 3, x0, y0, w, h, Object.assign(Number(base), { fallback: true }));
    const T = 256 * scale, left = px * scale - w / 2, top = py * scale - h / 2;
    for (let tx = Math.floor(left / T); tx * T < left + w; tx++) for (let ty = Math.floor(top / T); ty * T < top + h; ty++) {
      if (ty < 0 || ty >= n) continue;
      const im = tile(z, ((tx % n) + n) % n, ty);
      if (im.complete && im.naturalWidth) g.drawImage(im, x0 + tx * T - left, y0 + ty * T - top, T, T);
    }
  };
  // Screen position of a lon/lat on that same view.
  const onView = (p, centre, zf, x0, y0, w, h, base) => { const [ax, ay] = merc(p), [cx, cy] = merc(centre), k = 256 * 2 ** zf * base; return [x0 + w / 2 + (ax - cx) * k, y0 + h / 2 + (ay - cy) * k]; };
  // The spoofed fix's journey: out from Kaohsiung until a whole continent shows, across, and down onto the Arc de Triomphe.
  const journey = k => { const sm = k * k * (3 - 2 * k); return { at: d3.geoInterpolate(HOME, PARIS)(sm), z: 13 + 2 * sm - 11.8 * Math.sin(Math.PI * sm) }; };
  let preloaded = false;
  const preload = () => {
    if (preloaded || !window.d3) return; preloaded = true;
    const off = document.createElement('canvas').getContext('2d'), cv = phones[2];
    for (let k = 0; k <= 1.0001; k += 0.04) { const j = journey(k); drawImagery(off, j.at, j.z, 0, 0, cv.width, cv.height, dpr); }
  };
  const STATIC = Array.from({ length: 160 }, () => [Math.random(), Math.random(), 0.25 + Math.random() * 0.5]);
  const drawPhones = t => {
    phones.forEach(cv => {
      const mode = +cv.dataset.mode, g = cv.getContext('2d'), W = cv.width, H = cv.height, bar = H * 0.12;
      g.clearRect(0, 0, W, H);
      g.save(); g.beginPath(); g.rect(0, bar, W, H - bar); g.clip();
      g.fillStyle = '#0d2238'; g.fillRect(0, bar, W, H - bar);
      let phase = 'home', k = 0, at = HOME;
      if (mode === 2) { const e = (t % 10000) / 1000; k = clamp((e - 2) / 3.4); phase = k <= 0 ? 'home' : k >= 1 ? 'paris' : 'swing'; }
      if (mode === 2) preload();
      if (phase === 'swing' && window.d3) {
        // The real imagery the whole way: zoom out over Asia, travel, zoom in on Paris; the false track in red.
        const j = journey(k); at = j.at;
        drawImagery(g, at, j.z, 0, bar, W, H - bar, dpr);
        g.fillStyle = '#04060c33'; g.fillRect(0, bar, W, H - bar);
        const gi = d3.geoInterpolate(HOME, at);
        g.strokeStyle = '#ff5a63'; g.lineWidth = 2.5 * dpr; g.setLineDash([7 * dpr, 5 * dpr]); g.beginPath();
        for (let i = 0; i <= 40; i++) { const [px, py] = onView(gi(i / 40), at, j.z, 0, bar, W, H - bar, dpr); i ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.stroke(); g.setLineDash([]);
        const [hx, hy] = onView(HOME, at, j.z, 0, bar, W, H - bar, dpr);
        g.strokeStyle = '#fff'; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(hx, hy, W * 0.025, 0, 7); g.stroke();
        g.fillStyle = '#ff5a63'; g.beginPath(); g.arc(W / 2, bar + (H - bar) / 2, W * 0.03, 0, 7); g.fill();
      } else {
        drawImagery(g, phase === 'paris' ? PARIS : HOME, phase === 'paris' ? 15 : 13, 0, bar, W, H - bar, dpr);
        g.fillStyle = '#04060c33'; g.fillRect(0, bar, W, H - bar);
      }
      const x = W / 2, y = bar + (H - bar) / 2, r = W * 0.035, pulse = (t / 1600) % 1;
      g.font = `700 ${Math.round(W * 0.06)}px "Noto Sans TC", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'top';
      if (mode === 1) {
        STATIC.forEach(([a, b, o]) => { g.fillStyle = `rgba(235,240,248,${o})`; g.fillRect(a * W, bar + b * (H - bar), 2.4 * dpr, 2.4 * dpr); });
        g.fillStyle = '#04060c88'; g.beginPath(); g.arc(x, y, r * 2, 0, 7); g.fill();
        g.strokeStyle = '#ffffffaa'; g.setLineDash([4 * dpr, 4 * dpr]); g.lineWidth = 1.5 * dpr; g.beginPath(); g.arc(x, y, r * 1.5, 0, 7); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText('?', x, y);
      } else if (phase !== 'swing') {
        g.strokeStyle = `rgba(94,242,196,${1 - pulse})`; g.lineWidth = 2.5 * dpr; g.beginPath(); g.arc(x, y, r + pulse * r * 3, 0, 7); g.stroke();
        g.fillStyle = '#5ef2c4'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = '#04060c'; g.lineWidth = 2 * dpr; g.stroke();
        const label = phase === 'paris' ? L('巴黎・凱旋門', 'Paris · Arc de Triomphe') : L('高雄・高科大', 'Kaohsiung · NKUST');
        g.fillStyle = '#04060ccc'; const tw = g.measureText(label).width + 16 * dpr; g.fillRect(x - tw / 2, y + r * 2, tw, W * 0.085);
        g.fillStyle = '#fff'; g.fillText(label, x, y + r * 2 + W * 0.012);
      }
      g.restore();
      g.fillStyle = '#0f2036'; g.fillRect(0, 0, W, bar);
      g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `700 ${Math.round(W * 0.062)}px "Noto Sans TC", sans-serif`;
      const status = mode === 1 ? [L('○ 搜尋衛星中…', '○ Searching for satellites…'), '#c9d6e8'] : phase === 'paris' ? [L('● 巴黎　定位精準', '● Paris  high accuracy'), '#5ef2c4'] : phase === 'swing' ? [L('● 定位更新中…', '● Updating position…'), '#c9d6e8'] : [L('● 高雄　定位精準', '● Kaohsiung  high accuracy'), '#5ef2c4'];
      g.fillStyle = status[1]; g.fillText(status[0], W * 0.08, bar * 0.55);
    });
  };

  // ---- 01: two small demonstrations that play by themselves once the block is on screen (after a short beat).
  const dual = $('.dual');
  // They loop: build up for 2.4 s, hold for 4 s, then start over.
  const demoK = now => { if (!dual.classList.contains('show')) return 0; dual.t0 ||= now; const c = (now - dual.t0) % 7400; return clamp((c - 600) / 2400); };
  // Positioning: three satellites, each with a range circle that grows to its true distance; where they meet is the receiver.
  const pos = $('.demo--pos'), pc = pos.getContext('2d');
  // Positioning: real imagery of Kaohsiung; four satellites send signals whose travel time × the speed of
  // light gives each range. As each arrives the brackets close in; with the fourth, the fix and the receiver
  // clock error are solved together and the view settles on NKUST.
  const SATS4 = [
    { az: -112, col: '#ff9f7a', name: 'G08', ms: 67.35, at: 900 },
    { az: -42, col: '#70e3ed', name: 'C21', ms: 72.2, at: 1300 },
    { az: 38, col: '#ff9f7a', name: 'G27', ms: 76.29, at: 1700 },
    { az: 96, col: '#70e3ed', name: 'C06', ms: 121.48, at: 2100 },
  ];
  const posMask = document.createElement('canvas');
  const drawPos = t => {
    const W = pos.width, H = pos.height;
    const c = dual.classList.contains('show') ? (t - (dual.t0 ||= t)) % 7400 : 0;
    pc.clearRect(0, 0, W, H);
    const rx = W * 0.5, ry = H * 0.6;
    const lockK = clamp((c - 2100) / 900), zk = lockK * lockK * (3 - 2 * lockK);
    // The imagery, faded at its edges into the night sky.
    const zf = 12.4 + 2.8 * zk;
    pc.fillStyle = '#05080f'; pc.fillRect(0, 0, W, H);
    drawImagery(pc, HOME, zf, rx - W, ry - H, W * 2, H * 2, dpr);
    pc.fillStyle = 'rgba(4,8,16,.5)'; pc.fillRect(0, 0, W, H);
    if (posMask.width !== W || posMask.height !== H) {
      posMask.width = W; posMask.height = H;
      const m = posMask.getContext('2d'), cx = W / 2, cy = H / 2, gr = m.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5);
      gr.addColorStop(0, '#000'); gr.addColorStop(0.5, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      m.save(); m.translate(cx, cy); m.scale(1, H / W); m.translate(-cx, -cy); m.fillStyle = gr; m.fillRect(-W, -H * 4, W * 3, H * 9); m.restore();
    }
    pc.globalCompositeOperation = 'destination-in'; pc.drawImage(posMask, 0, 0); pc.globalCompositeOperation = 'source-over';
    // Satellites around the edge, in the direction of their azimuth; a signal front travels in to the receiver.
    const reach = H * 0.5;
    let arrived = 0;
    const compact = W / dpr < 520, AZ_NARROW = [-64, -24, 24, 64];
    SATS4.forEach((s, i) => {
      const a = ((compact ? AZ_NARROW[i] : s.az) - 90) * Math.PI / 180, x = clamp(rx + Math.cos(a) * reach * Math.max(1, W / H * 0.95), 24 * dpr, W - 24 * dpr), y = ry + Math.sin(a) * reach * 1.04;
      const d = Math.hypot(rx - x, ry - y), dir = Math.atan2(ry - y, rx - x);
      const f = clamp((c - (s.at - 700)) / 700, 0, 1.4), hit = c >= s.at;
      if (hit) arrived++;
      const gr = pc.createLinearGradient(x, y, rx, ry); gr.addColorStop(0, s.col + '22'); gr.addColorStop(1, s.col + (hit ? 'ff' : '66'));
      pc.strokeStyle = gr; pc.lineWidth = (hit ? 2.4 : 1.2) * dpr; pc.beginPath(); pc.moveTo(x, y); pc.lineTo(rx, ry); pc.stroke();
      // Signal fronts: short arcs centred on the satellite, moving along the line (not orbits).
      if (f > 0 && f < 1.2) for (let k = 0; k < 3; k++) {
        const r = d * (f - k * 0.09); if (r <= 0 || r > d) continue;
        pc.strokeStyle = s.col + Math.round(220 - k * 70).toString(16).padStart(2, '0'); pc.lineWidth = (2.4 - k * 0.6) * dpr;
        pc.beginPath(); pc.arc(x, y, r, dir - 0.22, dir + 0.22); pc.stroke();
      }
      pc.fillStyle = s.col; pc.fillRect(x - 10 * dpr, y - 3 * dpr, 20 * dpr, 6 * dpr); pc.fillStyle = '#e8eef8'; pc.fillRect(x - 3 * dpr, y - 5 * dpr, 6 * dpr, 10 * dpr);
      // Label: name, travel time × the speed of light, range (on a narrow screen: name and range, under the satellite).
      if (compact) {
        const cx2 = clamp(x, 46 * dpr, W - 46 * dpr);
        pc.textAlign = 'center'; pc.textBaseline = 'alphabetic';
        pc.font = `${11 * dpr}px "Archivo Black", sans-serif`; pc.fillStyle = s.col; pc.fillText(s.name, cx2, y + 22 * dpr);
        pc.font = `${11 * dpr}px "Archivo Black", sans-serif`; pc.fillStyle = hit ? '#ffffff' : '#ffffff88';
        pc.fillText(`≈ ${Math.round(s.ms * 299.792).toLocaleString('en-US')} km`, cx2, y + 38 * dpr);
        return;
      }
      const left = x < rx, lx = clamp(x + (left ? 16 : -16) * dpr, 4 * dpr, W - 4 * dpr), ly = clamp(y + (y < ry ? 20 : -50) * dpr, 14 * dpr, H - 46 * dpr);
      pc.textAlign = left ? 'left' : 'right'; pc.textBaseline = 'alphabetic';
      pc.font = `${12 * dpr}px "Archivo Black", sans-serif`; pc.fillStyle = s.col; pc.fillText(s.name, lx, ly);
      pc.font = `700 ${12 * dpr}px "Noto Sans TC", sans-serif`; pc.fillStyle = '#c9d6e8'; pc.fillText(`${s.ms.toFixed(2)} ms × ${L('光速', 'c')}`, lx, ly + 17 * dpr);
      pc.font = `${13 * dpr}px "Archivo Black", sans-serif`; pc.fillStyle = hit ? '#ffffff' : '#ffffff88';
      pc.fillText(`${L('距離', 'range')} ≈ ${Math.round(s.ms * 299.792).toLocaleString('en-US')} km`, lx, ly + 36 * dpr);
    });
    // Brackets close in as the ranges arrive; with the fourth the fix locks.
    const locked = lockK >= 1, sz = (64 - arrived * 9 - 12 * zk) * dpr, L1 = 13 * dpr;
    pc.strokeStyle = locked ? '#5ef2c4' : '#ffffffcc'; pc.lineWidth = 2.2 * dpr;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([dx, dy]) => { pc.beginPath(); pc.moveTo(rx + dx * sz, ry + dy * sz - dy * L1); pc.lineTo(rx + dx * sz, ry + dy * sz); pc.lineTo(rx + dx * sz - dx * L1, ry + dy * sz); pc.stroke(); });
    const pulse = (t / 1400) % 1;
    if (locked) { pc.strokeStyle = `rgba(94,242,196,${1 - pulse})`; pc.lineWidth = 2 * dpr; pc.beginPath(); pc.arc(rx, ry, (8 + pulse * 24) * dpr, 0, 7); pc.stroke(); }
    pc.fillStyle = locked ? '#5ef2c4' : '#ffffff'; pc.beginPath(); pc.arc(rx, ry, (locked ? 6 : 3.5) * dpr, 0, 7); pc.fill();
    const jit = locked ? 0 : 0.06 * (1 - arrived / 4) + 0.004;
    const lat = (22.7584 + Math.sin(t / 70) * jit).toFixed(4), lon = (120.3382 + Math.cos(t / 90) * jit).toFixed(4);
    pc.textAlign = 'center'; pc.textBaseline = 'top';
    pc.font = `700 ${14 * dpr}px "Noto Sans TC", sans-serif`; pc.fillStyle = locked ? '#5ef2c4' : '#ffffff';
    pc.fillText(locked ? L('你在這裡', 'You are here') : L(`解算中 · ${arrived}/4 顆`, `Solving · ${arrived}/4`), rx, ry + (Math.max(sz / dpr, 30) + 10) * dpr);
    pc.font = `${12 * dpr}px "Archivo Black", sans-serif`; pc.fillText(`${lat}°N  ${lon}°E`, rx, ry + (Math.max(sz / dpr, 30) + 30) * dpr);
    if (locked) { pc.font = `700 ${12 * dpr}px "Noto Sans TC", sans-serif`; pc.fillStyle = '#f6c775'; pc.fillText(L('接收機時鐘誤差 +0.41 ms 已一併解出', 'Receiver clock error +0.41 ms solved too'), rx, ry + (Math.max(sz / dpr, 30) + 50) * dpr); }
    pc.textBaseline = 'alphabetic'; pc.textAlign = 'right'; pc.font = `${10 * dpr}px "Noto Sans TC", sans-serif`; pc.fillStyle = '#ffffff70';
    pc.fillText(compact ? L('數字為衛星距離（示意）· 影像 Esri', 'Numbers are satellite ranges (illustrative) · Esri') : L('影像 Esri World Imagery · 時間與距離為示意', 'Imagery Esri World Imagery · times and ranges illustrative'), W - 4 * dpr, H - 4 * dpr);
  };
  // Timing: three clocks that each run their own way, until the satellite time arrives and they agree.
  const tim = $('.demo--time'), tc = tim.getContext('2d');
  // Timing: the same language as positioning. Real imagery of Taiwan; a satellite's time signal reaches three
  // real sites in turn, and each clock, off by a few hundred milliseconds, falls into step as it arrives.
  const SITES3 = [
    { name: ['交易所', 'Exchange'], place: ['台北・臺灣證券交易所', 'Taipei · TWSE'], p: [121.5645, 25.0340], off: 0.2388, side: 1 },
    { name: ['電網', 'Grid'], place: ['台中・台中發電廠', 'Taichung power plant'], p: [120.4815, 24.2130], off: -0.4127, side: -1 },
    { name: ['基地台', 'Cell tower'], place: ['高雄・楠梓', 'Nanzih, Kaohsiung'], p: [120.3382, 22.7584], off: 0.0915, side: 1 },
  ];
  const TAIWAN = [120.95, 23.75];
  const timMask = document.createElement('canvas');
  const fmt = sec => { const d = new Date(sec * 1000); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`; };
  const drawTime = () => {
    const W = tim.width, H = tim.height, t = performance.now(), now = Date.now() / 1000;
    const c = dual.classList.contains('show') ? (t - (dual.t0 ||= t)) % 7400 : 0;
    const compact = W / dpr < 520;
    tc.clearRect(0, 0, W, H);
    // Taiwan fills the height of the canvas.
    const zf = 7.25 + Math.log2(H / dpr / 560);
    tc.fillStyle = '#05080f'; tc.fillRect(0, 0, W, H);
    drawImagery(tc, TAIWAN, zf, 0, 0, W, H, dpr);
    tc.fillStyle = 'rgba(4,8,16,.5)'; tc.fillRect(0, 0, W, H);
    if (timMask.width !== W || timMask.height !== H) {
      timMask.width = W; timMask.height = H;
      const m = timMask.getContext('2d'), cx = W / 2, cy = H / 2, gr = m.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5);
      gr.addColorStop(0, '#000'); gr.addColorStop(0.55, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      m.translate(cx, cy); m.scale(1, H / W); m.translate(-cx, -cy); m.fillStyle = gr; m.fillRect(-W, -H * 4, W * 3, H * 9);
    }
    tc.globalCompositeOperation = 'destination-in'; tc.drawImage(timMask, 0, 0); tc.globalCompositeOperation = 'source-over';
    const sx = W * (compact ? 0.3 : 0.34), sy = H * 0.1;
    SITES3.forEach((s, i) => {
      const [x, y] = onView(s.p, TAIWAN, zf, 0, 0, W, H, dpr), at = 1300 + i * 380;
      const f = clamp((c - (at - 800)) / 800, 0, 1.3), hit = c >= at;
      const d = Math.hypot(x - sx, y - sy), dir = Math.atan2(y - sy, x - sx);
      const gr = tc.createLinearGradient(sx, sy, x, y); gr.addColorStop(0, '#f6c77522'); gr.addColorStop(1, hit ? '#f6c775ff' : '#f6c77555');
      tc.strokeStyle = gr; tc.lineWidth = (hit ? 2.2 : 1.2) * dpr; tc.beginPath(); tc.moveTo(sx, sy); tc.lineTo(x, y); tc.stroke();
      // Signal fronts along the line.
      if (f > 0 && f < 1.15) for (let k = 0; k < 3; k++) { const r = d * (f - k * 0.08); if (r <= 0 || r > d) continue; tc.strokeStyle = '#f6c775' + Math.round(220 - k * 70).toString(16).padStart(2, '0'); tc.lineWidth = (2.4 - k * 0.6) * dpr; tc.beginPath(); tc.arc(sx, sy, r, dir - 0.18, dir + 0.18); tc.stroke(); }
      const k2 = clamp((c - at) / 500), sync = k2 * k2 * (3 - 2 * k2), shown = now + s.off * (1 - sync), agreed = sync >= 1;
      const p = (t / 1200 + i * 0.3) % 1;
      if (hit) { tc.strokeStyle = `rgba(94,242,196,${1 - p})`; tc.lineWidth = 2 * dpr; tc.beginPath(); tc.arc(x, y, (7 + p * 18) * dpr, 0, 7); tc.stroke(); }
      tc.fillStyle = hit ? '#5ef2c4' : '#ffffff'; tc.beginPath(); tc.arc(x, y, 5 * dpr, 0, 7); tc.fill();
      // The site's clock: name and place, its time, and how far off it is.
      const side = compact ? (i === 1 ? -1 : 1) : s.side, lx = clamp(x + side * 14 * dpr, 4 * dpr, W - 4 * dpr);
      tc.textAlign = side > 0 ? 'left' : 'right'; tc.textBaseline = 'alphabetic';
      tc.font = `700 ${(compact ? 11 : 13) * dpr}px "Noto Sans TC", sans-serif`; tc.fillStyle = '#e6edf7';
      tc.fillText(compact ? L(...s.name) : `${L(...s.name)}　${L(...s.place)}`, lx, y - 8 * dpr);
      tc.font = `${(compact ? 14 : 18) * dpr}px "Archivo Black", sans-serif`; tc.fillStyle = agreed ? '#5ef2c4' : '#ffffff';
      tc.fillText(fmt(shown), lx, y + (compact ? 10 : 14) * dpr);
      const ms = Math.round(s.off * (1 - sync) * 1000);
      tc.font = `700 ${(compact ? 11 : 12) * dpr}px "Noto Sans TC", sans-serif`; tc.fillStyle = agreed ? '#5ef2c4' : '#ff8a90';
      tc.fillText(agreed ? L('已對齊', 'in sync') : `${L('差', 'off')} ${ms > 0 ? '+' : ''}${ms} ms`, lx, y + (compact ? 26 : 32) * dpr);
    });
    // The satellite and its time.
    tc.fillStyle = '#70e3ed'; tc.fillRect(sx - 11 * dpr, sy - 3.5 * dpr, 22 * dpr, 7 * dpr); tc.fillStyle = '#e8eef8'; tc.fillRect(sx - 3.5 * dpr, sy - 5.5 * dpr, 7 * dpr, 11 * dpr);
    // Beside the satellite; on a narrow screen, in the top-left corner so it is never cut off.
    const tx = compact ? 4 * dpr : sx - 20 * dpr, ty = compact ? sy + 22 * dpr : sy - 2 * dpr; tc.textAlign = compact ? 'left' : 'right';
    tc.font = `700 ${12 * dpr}px "Noto Sans TC", sans-serif`; tc.fillStyle = '#f6c775'; tc.fillText(L('衛星時間', 'Satellite time'), tx, ty);
    tc.font = `${(compact ? 15 : 20) * dpr}px "Archivo Black", sans-serif`; tc.fillText(fmt(now), tx, ty + (compact ? 18 : 26) * dpr);
    tc.textAlign = 'right'; tc.font = `${10 * dpr}px "Noto Sans TC", sans-serif`; tc.fillStyle = '#ffffff70';
    tc.fillText(L('影像 Esri World Imagery · 時間差為示意', 'Imagery Esri World Imagery · offsets illustrative'), W - 4 * dpr, H - 4 * dpr);
  };

  // ---- Opening style switcher (test page only); the choice is kept in the address.
  const hero = $('.sc-hero');
  const HEROES = {
    1: [['把整片', '天空', '搬進實驗室'], ['The whole', 'sky', 'in the lab']],
    2: [['把', '整片天空', '搬進實驗室'], ['Bring', 'the whole sky', 'into the lab']],
    3: [['在實驗室裡', '造一片天空', 'GPS／北斗衛星訊號模擬平台'], ['In the lab', 'we build a sky', 'A GPS / BeiDou signal simulation platform']],
    4: [['在實驗室裡重現', '天空', 'GPS・北斗・可控・可重播'], ['Recreated in the lab', 'the sky', 'GPS · BeiDou · controlled · repeatable']],
  };
  const ht = $('.ht');
  const setHero = v => { if (!HEROES[v]) v = '3'; hero.dataset.hero = v;
    const words = HEROES[v][isEn() ? 1 : 0];
    [...ht.children].forEach((el, i) => { el.textContent = words[i]; }); ht.setAttribute('aria-label', words.join(' ')); $$('.hero-switch [data-v]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v)); if (hero.dataset.earth) keepUrl(); };
  $$('.hero-switch [data-v]').forEach(b => b.addEventListener('click', () => setHero(b.dataset.v)));
  const params = new URLSearchParams(location.search);
  const setEarth = g => { hero.dataset.earth = g; $$('.hero-switch [data-g]').forEach(b => b.setAttribute('aria-pressed', b.dataset.g === g)); keepUrl(); };
  const keepUrl = () => { try { history.replaceState(null, '', `?hero=${hero.dataset.hero}&bg=${hero.dataset.earth}${location.hash}`); } catch (e) {} };
  $$('.hero-switch [data-g]').forEach(b => b.addEventListener('click', () => setEarth(b.dataset.g)));
  setHero(params.get('hero') || '3');
  document.addEventListener('languagechange', () => setHero(hero.dataset.hero));
  setEarth(params.get('bg') || '1');

  // ---- 04: the orbit cards open their explanation in a panel over the globe.
  // It sits in the side column (in place of the visible-satellite block), so the globe is never covered.
  const brief = $('#globe-explanation'), stageEl = $('.sc-sky .globe-panel');
  if (brief && stageEl) {
    const pop = document.createElement('div');
    pop.className = 'orbit-pop'; pop.hidden = true;
    pop.innerHTML = `<button type="button" class="orbit-pop-x" data-zh="← 返回" data-en="← Back">${L('← 返回', '← Back')}</button>`;
    pop.append(brief); stageEl.prepend(pop);
    pop.querySelector('.orbit-pop-x').addEventListener('click', () => { pop.hidden = true; stageEl.classList.remove('is-reading'); });
    $$('.sc-sky .orbit-card').forEach(card => card.addEventListener('click', () => {
      pop.style.setProperty('--pc', getComputedStyle(card).getPropertyValue('--c'));
      pop.hidden = false; stageEl.classList.add('is-reading'); stageEl.scrollTop = 0;
    }));
  }

  // ---- 04: the playback speeds move up into the console's top bar, beside play/pause, so they are always at hand.
  const speed = $('.sc-sky .globe-speed'), topBar = $('.sc-sky .console-top');
  if (speed && topBar) { speed.classList.add('speed-top'); topBar.insertBefore(speed, $('#globe-play')); }

  // ---- Header: one mark glides between the site links (as scroll-scenes.js does on the other pages).
  const siteNav = $('#site-nav');
  const placeMark = el => { if (!siteNav || !el) return; siteNav.style.setProperty('--gx', `${el.offsetLeft}px`); siteNav.style.setProperty('--gw', `${el.offsetWidth}px`); };
  const homeMark = () => placeMark($('a[aria-current=page]', siteNav));
  siteNav?.addEventListener('mouseover', e => placeMark(e.target.closest('a')));
  siteNav?.addEventListener('mouseleave', homeMark);
  addEventListener('resize', homeMark);
  document.fonts?.ready.then(homeMark);
  homeMark();

  // ---- Footer: the same entrance as app.js gives the other pages — a sweep along the top edge, the logo
  // swings in with two rings and an orbiting satellite, the name rises letter by letter, the motto decodes.
  (() => {
    const f = $('body>footer'); if (!f) return;
    const brand = f.querySelector('.brand'), tag = f.querySelector(':scope>span');
    if (brand) {
      const tn = [...brand.childNodes].find(n => n.nodeType === 3 && n.data.trim());
      if (tn) { const w = document.createElement('b'); w.className = 'gt-word'; w.setAttribute('aria-label', tn.data.trim());
        [...tn.data.trim()].forEach((ch, i) => { const l = document.createElement('i'); l.className = 'gt-l'; l.textContent = ch; l.style.setProperty('--i', i); l.setAttribute('aria-hidden', 'true'); w.append(l); }); tn.replaceWith(w); }
      const fx = document.createElement('i'); fx.className = 'gt-logo-fx'; fx.setAttribute('aria-hidden', 'true');
      fx.innerHTML = '<i class="gt-ring"></i><i class="gt-ring"></i><i class="gt-orbit"><b></b></i>'; brand.prepend(fx);
    }
    if (calm || !('IntersectionObserver' in window)) { f.classList.add('gt-foot-in'); return; }
    f.classList.add('gt-foot-wait');
    const decode = el => { const goal = el.textContent, abc = isEn() ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*/<>' : '訊號衛星定位碼波頻相時鐘軌道北斗天線鎖', t0 = performance.now(), dur = 1200; el.setAttribute('aria-label', goal);
      const step = t => { const k = Math.min(1, (t - t0) / dur), n = Math.floor(k * goal.length); el.textContent = goal.slice(0, n) + [...goal.slice(n)].map(c => /[\s，。、]/.test(c) ? c : abc[Math.random() * abc.length | 0]).join(''); if (k < 1) requestAnimationFrame(step); else el.textContent = goal; };
      requestAnimationFrame(step); };
    let timer = 0;
    new IntersectionObserver(es => { const on = es.some(e => e.isIntersecting); clearTimeout(timer);
      if (on) { f.classList.replace('gt-foot-wait', 'gt-foot-in'); if (tag && tag.offsetWidth) timer = setTimeout(() => decode(tag), 900); timer = setTimeout(() => f.classList.add('gt-foot-live'), 3200); }
      else { f.classList.remove('gt-foot-live'); f.classList.replace('gt-foot-in', 'gt-foot-wait'); } }, { threshold: 0.35 }).observe(f);
  })();

  // ---- 05: the list slides in once.
  const list = $('.next-list');
  new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) list.classList.add('on'); }), { threshold: 0.2 }).observe(list);

  const size = () => {
    vw = innerWidth; vh = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
    // Only reallocate a canvas whose size really changed (phones fire resize as the address bar slides).
    [...phones.map(c => [c, c.clientWidth, c.clientHeight]), [pos, pos.clientWidth, pos.clientHeight], [tim, tim.clientWidth, tim.clientHeight]].forEach(([c, w, h]) => {
      const W = Math.round(w * dpr), H = Math.round(h * dpr);
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    });
    measure();
  };
  let sizeTimer = 0;
  addEventListener('resize', () => { clearTimeout(sizeTimer); sizeTimer = setTimeout(size, 150); });
  addEventListener('load', size);
  size();

  // ---- Frame loop, kept light: positions are measured only when the page moves or resizes, and each
  // canvas is drawn only while its block is on screen (the phones at about 30 frames a second).
  const onScreen = new Set();
  const watch = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target)), { rootMargin: '120px 0px' });
  const flow3 = $('.flow3'), dualEl = $('.dual');
  [flow3, dualEl].forEach(el => el && watch.observe(el));
  let dirty = true, lastPhones = 0;
  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  addEventListener('resize', () => { dirty = true; });
  const frame = t => {
    if (dirty) { dirty = false; measure(); }
    if (!document.hidden) {
      if (onScreen.has(flow3) && t - lastPhones > 33) { lastPhones = t; drawPhones(t); }
      if (onScreen.has(dualEl)) { drawPos(t); drawTime(); }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
