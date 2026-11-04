// Project overview: a radar-sweep entrance for cards, an RF pulse where the reader clicks empty space, and three hidden
// extras (triple-click the GEOTRUST kicker, hover the credit line, the Konami code). All decorative, all cheap: nothing
// runs per frame, and motion stays off for readers who ask for reduced motion.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isEn = () => document.documentElement.lang === 'en';

  // ---------- Radar sweep: each card is revealed by a scan line running top to bottom ----------
  // The groups are watched rather than the cards: a card clipped to nothing never counts as on screen.
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.querySelectorAll('.egg-scan').forEach(el => el.classList.add('egg-scanned'));
      io.unobserve(en.target);
    }), { threshold: 0.15 });
    document.querySelectorAll('main .po-cards, main .po-six, main .po-test2').forEach(group => {
      [...group.children].forEach((el, i) => { el.classList.add('egg-scan'); el.style.setProperty('--egg-d', i * 110 + 'ms'); });
      io.observe(group);
    });
  }

  // ---------- RF pulse: clicking empty space sends out rings, like a transmitter keying up ----------
  if (!reduced) {
    document.addEventListener('click', e => {
      if (e.button !== 0 || e.target.closest('a, button, input, select, textarea, label, summary, [role="button"], .egg-term, .egg-konami')) return;
      const box = document.createElement('span');
      box.className = 'egg-pulse';
      box.style.left = e.clientX + 'px';
      box.style.top = e.clientY + 'px';
      box.innerHTML = '<i></i><i></i><i></i>';
      box.setAttribute('aria-hidden', 'true');
      document.body.append(box);
      setTimeout(() => box.remove(), 1400);
    });
  }

  // ---------- Spoof mode: three quick clicks on the GEOTRUST kicker ----------
  const kicker = document.querySelector('.po-hero .po-kicker');
  let clicks = [], spoofTimer = 0;
  const term = document.createElement('div');
  term.className = 'egg-term';
  term.setAttribute('role', 'status');
  term.textContent = '[WARN] RF INJECTION DETECTED // OVERRIDING EPHEMERIS (PRN 03, 08, 14)...';
  const endSpoof = () => { document.documentElement.classList.remove('egg-spoof'); term.remove(); clearTimeout(spoofTimer); };
  const startSpoof = () => {
    document.body.append(term);
    document.documentElement.classList.add('egg-spoof', 'egg-glitch');
    setTimeout(() => document.documentElement.classList.remove('egg-glitch'), 220);
    clearTimeout(spoofTimer);
    spoofTimer = setTimeout(endSpoof, 5000);
  };
  if (kicker) {
    kicker.style.cursor = 'pointer';
    kicker.addEventListener('click', () => {
      if (document.documentElement.classList.contains('egg-spoof')) { endSpoof(); clicks = []; return; }
      const now = performance.now();
      clicks = clicks.filter(t => now - t < 900).concat(now);
      if (clicks.length >= 3) { clicks = []; startSpoof(); }
    });
  }

  // ---------- Coordinate glitch: hovering the credit line, NKUST's position scrambles and lands on Null Island ----------
  const note = document.querySelector('.po-hero .po-hero-note');
  if (note) {
    const coord = document.createElement('span');
    coord.className = 'egg-coord';
    coord.setAttribute('aria-hidden', 'true');
    coord.textContent = '22.76°N, 120.34°E';
    note.after(coord);
    let run = 0;
    const fmt = (la, lo) => `${Math.abs(la).toFixed(2)}°${la < 0 ? 'S' : 'N'}, ${Math.abs(lo).toFixed(2)}°${lo < 0 ? 'W' : 'E'}`;
    note.addEventListener('mouseenter', () => {
      clearInterval(run);
      coord.classList.add('is-on');
      coord.classList.remove('is-hit');
      let n = 0;
      run = setInterval(() => {
        n++;
        if (n < 14) { coord.textContent = fmt(Math.random() * 180 - 90, Math.random() * 360 - 180); return; }
        clearInterval(run);
        coord.textContent = fmt(0, 0) + '  [POS COMPROMISED]';
        coord.classList.add('is-hit');
      }, 70);
    });
    note.addEventListener('mouseleave', () => {
      clearInterval(run);
      coord.classList.remove('is-on', 'is-hit');
      setTimeout(() => { coord.textContent = '22.76°N, 120.34°E'; }, 300);
    });
  }

  // ---------- Konami code: a console opens with a door to the technical page ----------
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let pos = 0, panel = null;
  const close = () => { panel?.remove(); panel = null; };
  addEventListener('keydown', e => {
    if (panel && e.key === 'Escape') { close(); return; }
    if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = k === KONAMI[pos] ? pos + 1 : (k === KONAMI[0] ? 1 : 0);
    if (pos < KONAMI.length) return;
    pos = 0;
    close();
    panel = document.createElement('div');
    panel.className = 'egg-konami';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'GeoTrust console');
    panel.innerHTML = `<pre aria-hidden="true">      .--[====]--.
  ====|  GT-01   |====
      '--[====]--'
           /|\\
          / | \\        ((( )))
</pre><p>Defense Ready. F459 GeoTrust Console Unlocked.</p>
<a href="tech/">${isEn() ? 'Enter the technical page →' : '進入技術細節 →'}</a><button type="button">${isEn() ? 'Close' : '關閉'} ✕</button>`;
    panel.querySelector('button').addEventListener('click', close);
    panel.addEventListener('click', e => { if (e.target === panel) close(); });
    document.body.append(panel);
    panel.querySelector('a').focus();
  });
})();
