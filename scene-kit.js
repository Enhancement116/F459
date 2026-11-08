// Shared by the project and GNSS pages: canvas scenes drawn in a virtual space (wide on desktop, taller on phones)
// that only run while on screen, a few drawing helpers, and the chapter navigation.
const PO_LOW = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
window.GTScene = (() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const isEn = () => document.documentElement.lang === 'en';
  const C = { grid: '#17304a', text: '#dbe8f6', dim: '#7f9bb8', gps: '#70b7ff', bds: '#f6c775', acc: '#8affdd', pur: '#bd9aff', line: '#2f5577' };
  const RED = '#ff8f8f';
  function arrow(g, x1, y1, x2, y2, color) {
    const { ctx } = g, a = Math.atan2(y2 - y1, x2 - x1);
    g.line(x1, y1, x2, y2, color, 1.6);
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 8 * Math.cos(a - 0.45), y2 - 8 * Math.sin(a - 0.45));
    ctx.lineTo(x2 - 8 * Math.cos(a + 0.45), y2 - 8 * Math.sin(a + 0.45));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function scene(id, draw, size = {}) {
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
      dpr = Math.min(devicePixelRatio || 1, PO_LOW ? 1.5 : 2);
      W = r.width < 560 ? (size.nw || 400) : (size.w || 800); H = r.width < 560 ? (size.nh || 440) : (size.h || 320);
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
    // The loop only runs while the canvas is on screen; off screen it stops entirely instead of idling every frame.
    let running = false;
    function frame(now) {
      if (!visible) { running = false; return; }
      if (now - last >= 33) {
        const dt = Math.min((now - last) / 1000, 0.1); last = now;
        if (!document.hidden) { if (!reduced.matches) t += dt; paint(); }
      }
      requestAnimationFrame(frame);
    }
    const start = () => { if (running) return; running = true; requestAnimationFrame(now => { last = now; frame(now); }); };
    new IntersectionObserver(e => { visible = e[0].isIntersecting; if (visible) start(); }, { threshold: 0.1 }).observe(cv);
    new ResizeObserver(() => { resize(); paint(); }).observe(cv);
    document.addEventListener('languagechange', () => setTimeout(paint));
    resize(); paint();
  }


  return { reduced, isEn, C, RED, arrow, scene };
})();

// Chapter navigation. Wide screens: a full-width chapter bar under the header, numbers and names always readable.
// Phones: a floating chapter button that opens the full list with each chapter's title.
(() => {
  const nav = document.getElementById('po-chnav');
  if (!nav) return;
  const bar = nav.querySelector('.pcn-bar'), list = bar.querySelector('ol');
  const barLinks = [...bar.querySelectorAll('a')], sheetLinks = [...nav.querySelectorAll('.pcn-sheet a')];
  const sections = barLinks.map(a => document.getElementById(a.hash.slice(1)));
  const fab = document.getElementById('pcn-fab'), sheet = document.getElementById('pcn-sheet');
  const setOpen = open => {
    sheet.hidden = !open;
    fab.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('pcn-locked', open);
  };
  fab.addEventListener('click', () => setOpen(sheet.hidden));
  sheetLinks.forEach(a => a.addEventListener('click', () => setOpen(false)));
  sheet.addEventListener('click', e => { if (e.target === sheet) setOpen(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) { setOpen(false); fab.focus(); } });
  // Anchor jumps clear the header plus the chapter bar when it is showing.
  const setOffset = () => document.documentElement.style.setProperty('--hud-h', (getComputedStyle(bar).display === 'none' ? 0 : bar.offsetHeight) + 'px');
  let last = -2;
  function update() {
    const line = innerHeight * 0.3;
    let cur = -1;
    sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= line) cur = i; });
    nav.classList.toggle('is-active', cur >= 0);
    const c = Math.max(0, cur), r = sections[c].getBoundingClientRect();
    const within = cur < 0 ? 0 : Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height)));
    nav.style.setProperty('--p', ((c + within) / sections.length).toFixed(4));
    if (cur === last) return;
    last = cur;
    [barLinks, sheetLinks].forEach(ls => ls.forEach((a, i) => {
      a.classList.toggle('is-current', i === cur);
      a.classList.toggle('is-past', i < cur);
      if (i === cur) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    }));
    fab.querySelector('b').textContent = barLinks[c].querySelector('b').textContent;
    fab.querySelector('span').textContent = barLinks[c].querySelector('span').textContent;
    // A bar narrower than its chapters scrolls itself so the current one stays in view.
    const a = barLinks[c];
    if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: a.offsetLeft - list.clientWidth / 2 + a.offsetWidth / 2, behavior: 'smooth' });
  }
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', () => { setOffset(); update(); });
  document.addEventListener('languagechange', () => setTimeout(() => { last = -2; update(); }));
  setOffset(); update();
})();

// After an in-page jump (a "go deeper" or "next station" link), a button offers the way back to where the reader was.
(() => {
  const main = document.querySelector('main');
  if (!main) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'po-return';
  btn.innerHTML = '<b aria-hidden="true">↩</b><span></span><small></small>';
  document.body.append(btn);
  let back = null;
  const label = () => {
    const en = document.documentElement.lang === 'en';
    btn.querySelector('span').textContent = en ? 'Back to where you were' : '回到剛才的位置';
    btn.querySelector('small').textContent = back ? back.name : '';
  };
  let shrink = 0;
  let leave = 0;
  const hide = () => { btn.classList.remove('is-on', 'is-mini'); back = null; clearTimeout(shrink); clearTimeout(leave); };
  // Once shown it folds down to its arrow after a few seconds, and leaves on its own after a while.
  const show = () => {
    btn.classList.remove('is-mini');
    btn.classList.add('is-on');
    clearTimeout(shrink);
    clearTimeout(leave);
    shrink = setTimeout(() => btn.classList.add('is-mini'), 4000);
    leave = setTimeout(hide, 20000);
  };
  main.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href') === '#') return;
    const from = a.closest('figure, section');
    const name = (from?.querySelector('.po-viz-bar span, h2')?.textContent || '').trim().slice(0, 18);
    back = { y: scrollY, name };
    label();
    setTimeout(() => { if (back && Math.abs(scrollY - back.y) > 400) show(); }, 700);
  });
  btn.addEventListener('click', () => { if (back) scrollTo({ top: back.y, behavior: 'smooth' }); hide(); });
  // Once the reader scrolls back on their own, the offer goes away.
  addEventListener('scroll', () => { if (back && btn.classList.contains('is-on') && Math.abs(scrollY - back.y) < 200) hide(); }, { passive: true });
  document.addEventListener('languagechange', () => setTimeout(label));
})();
