// Technical details page. The stages, stops and header come from scroll-scenes.js (as on the design page);
// this file adds the "go deeper" dialogs, the waveform figure and the way back to another page.
(() => {
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const calm = matchMedia('(prefers-reduced-motion:reduce)').matches;

  // ---- "Go deeper": each chapter's details and formulas open in a dialog over the stage
  $$('.tk-deep-open').forEach(btn => {
    const dlg = document.getElementById('deep-' + btn.dataset.deep);
    if (!dlg) return;
    btn.addEventListener('click', () => { dlg.showModal(); dlg.scrollTop = 0; });
  });
  $$('dialog.tk-deep').forEach(dlg => {
    $('.tk-deep-x', dlg)?.addEventListener('click', () => dlg.close());
    // A click on the dimmed backdrop (outside the panel) closes it too.
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  });

  // ---- Waveform: the same code arrives late, and sliding a copy across finds the delay as a peak
  const codeFig = $('.tk-code');
  if (codeFig) {
    const svg = $('svg', codeFig);
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs, parent = svg) => {
      const n = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
      parent.append(n);
      return n;
    };
    const CHIP = 22;
    const X0 = 130;
    const SHIFT = 6;          // chips of delay shown on screen
    const CODE = [1, -1, -1, 1, 1, 1, -1, 1, -1, -1, 1, -1, 1, 1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1];
    const wave = (code, y, h = 18) => {
      let d = `M0 ${y - code[0] * h}`;
      code.forEach((c, i) => {
        if (i && c !== code[i - 1]) d += ` V${y - c * h}`;
        d += ` H${(i + 1) * CHIP}`;
      });
      return d;
    };
    const en = () => root.lang === 'en';
    const label = (y, zh, enText, cls) => {
      const n = el('text', { x: 20, y: y + 6, class: `tk-code-k ${cls || ''}` });
      n.dataset.zh = zh; n.dataset.en = enText; n.textContent = en() ? enText : zh;
      return n;
    };
    const lane = (y, cls) => { const g = el('g', { class: `tk-lane ${cls}`, transform: `translate(${X0} 0)` }); el('path', { d: wave(CODE, y), class: 'tk-wave' }, g); return g; };
    // Lanes: sent, received late, the receiver's own copy
    label(70, '衛星送出', 'Sent', 'tk-k1');
    el('line', { x1: X0, y1: 38, x2: X0, y2: 270, class: 'tk-t0' });
    lane(70, 'tk-sent');
    label(150, '接收機收到', 'Received', 'tk-k2');
    const late = lane(150, 'tk-late');
    late.setAttribute('transform', `translate(${X0 + SHIFT * CHIP} 0)`);
    const gap = el('g', { class: 'tk-gap' });
    el('line', { x1: X0, y1: 118, x2: X0 + SHIFT * CHIP, y2: 118 }, gap);
    const gapT = el('text', { x: X0 + SHIFT * CHIP / 2, y: 110, 'text-anchor': 'middle' }, gap);
    label(230, '接收機的碼', 'Receiver copy', 'tk-k3');
    const copy = lane(230, 'tk-copy');
    // Correlation: how well the copy matches, at each slide
    const PX = X0, PY = 410, PW = (SHIFT * 2) * CHIP, PH = 110;
    el('line', { x1: PX, y1: PY, x2: PX + PW, y2: PY, class: 'tk-axis' });
    label(352, '吻合程度', 'Match', 'tk-k4');
    const curve = el('polyline', { points: '', class: 'tk-curve' });
    const dot = el('circle', { r: 7, class: 'tk-dot', cx: PX, cy: PY });
    const peakT = el('text', { x: PX + SHIFT * CHIP, y: PY - PH - 14, 'text-anchor': 'middle', class: 'tk-peak' });
    const match = k => {
      // Fraction of chips that agree when the copy is slid k chips (the code repeats, as a real one does)
      let sum = 0;
      CODE.forEach((c, i) => { sum += c * CODE[(i - (k - SHIFT) + CODE.length * 4) % CODE.length]; });
      return Math.max(0, sum / CODE.length) ** 3;   // drawn on a power scale, as a real code's side peaks are far below the main one
    };
    const texts = () => {
      gapT.textContent = en() ? 'about 72 ms later' : '晚了約 72 ms';
      peakT.textContent = en() ? 'Peak = 72.2 ms ≈ 21,600 km' : '尖峰在 72.2 ms ≈ 21,600 公里';
      $$('[data-zh]', svg).forEach(n => { n.textContent = en() ? n.dataset.en : n.dataset.zh; });
    };
    texts();
    document.addEventListener('languagechange', () => setTimeout(texts));

    const buttons = $$('.tk-code-steps button', codeFig);
    const BEATS = [2600, 2600, 4200, 3600];
    let beat = 0;
    let start = 0;
    let frame = 0;
    let shown = false;
    const draw = now => {
      frame = 0;
      if (!start) start = now;
      let k = calm ? 1 : Math.min(1, (now - start) / BEATS[beat]);
      codeFig.dataset.beat = beat;
      buttons.forEach((b, n) => b.classList.toggle('is-on', n === beat));
      const slide = beat < 2 ? 0 : beat === 2 ? k * SHIFT * 2 : SHIFT * 2;
      copy.setAttribute('transform', `translate(${X0 + (beat === 3 ? SHIFT : slide) * CHIP} 0)`);
      const pts = [];
      const upto = beat < 2 ? -1 : beat === 2 ? slide : SHIFT * 2;
      for (let s = 0; s <= upto; s += 0.25) pts.push(`${PX + s * CHIP},${PY - match(Math.round(s)) * PH}`);
      curve.setAttribute('points', pts.join(' '));
      const at = beat === 3 ? SHIFT : Math.max(0, upto);
      dot.setAttribute('cx', PX + at * CHIP);
      dot.setAttribute('cy', PY - (upto < 0 ? 0 : match(Math.round(at))) * PH);
      if (k >= 1 && !calm) { beat = (beat + 1) % BEATS.length; start = now; }
      if (shown && !calm) frame = requestAnimationFrame(draw);
    };
    const run = () => { if (!frame) frame = requestAnimationFrame(draw); };
    buttons.forEach((b, n) => b.addEventListener('click', () => { beat = n; start = 0; if (calm) draw(performance.now()); else run(); }));
    new IntersectionObserver(([e]) => { shown = e.isIntersecting; if (shown) run(); }).observe(codeFig);
    if (calm) { beat = 3; draw(performance.now()); }
  }

  // Arrived from a link on another page: offer the way back to where the reader left off
  const BACK = {
    load: { href: '../system/#fusion', zh: '← 回到核心設計：運算量', en: '← Back to Design: workload' },
  };
  const from = BACK[new URLSearchParams(location.search).get('from')];
  if (from) {
    const back = document.createElement('a');
    back.className = 'tk-back';
    back.href = from.href;
    back.dataset.zh = from.zh;
    back.dataset.en = from.en;
    back.textContent = root.lang === 'en' ? from.en : from.zh;
    // Straight from that page: step back in history, so the reader lands on the exact stop they left
    back.addEventListener('click', e => {
      let ref = null;
      try { ref = new URL(document.referrer); } catch (_) {}
      if (ref && ref.origin === location.origin && ref.pathname.endsWith('/project/system/') && history.length > 1) {
        e.preventDefault();
        history.back();
      }
    });
    document.body.append(back);
  }

  // A link from another page lands on its anchor once the page has finished laying out
  if (location.hash.length > 1) {
    const land = () => {
      let t = null;
      try { t = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (_) {}
      if (t && Math.abs(t.getBoundingClientRect().top) > 120) t.scrollIntoView({ behavior: 'instant', block: 'start' });
    };
    if (document.readyState === 'complete') land(); else addEventListener('load', land, { once: true });
  }

  root.classList.add('tk-ready');
  if (calm) root.classList.add('tk-calm');
})();
