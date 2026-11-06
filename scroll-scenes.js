// Scroll-driven scenes for the System page. Each scene is a tall wrapper with a pinned stage inside;
// its --p custom property runs 0 to 1 while pinned and the CSS builds every effect from that value.
// Below 1024px or with reduced motion the class stays off and the page reads as a normal document.
(() => {
  const root = document.documentElement;
  const media = matchMedia('(min-width:1024px) and (prefers-reduced-motion:no-preference)');
  const calm = matchMedia('(prefers-reduced-motion:reduce)');
  const clamp = v => Math.min(1, Math.max(0, v));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const wrap = (el, cls) => {
    const scene = document.createElement('div');
    scene.className = 'sys-scene ' + cls;
    el.before(scene);
    scene.append(el);
    return scene;
  };
  const wrapAll = (selector, cls) => $$(selector).map(el => wrap(el, cls));

  const hero = wrapAll('.po-hero--tech', 'sys-scene--hero');
  const chapters = wrapAll('.po-ch-head', 'sys-scene--ch');
  const versus = wrapAll('.po-cards--2', 'sys-scene--vs');
  const rig = wrapAll('.po-viz.svx', 'sys-scene--rig');
  const steps = wrapAll('.sys-eng', 'sys-scene--eng');
  const diagrams = wrapAll('.po-viz:has(>svg)', 'sys-scene--dia');
  const pair = wrapAll('.sys-pair', 'sys-scene--pair');
  const route = wrapAll('.sys-duo--side', 'sys-scene--route');
  const antenna = wrapAll('.sys-duo--plot', 'sys-scene--ant');

  // The closing line and its buttons share one pinned stage.
  const prose = $('.po-prose');
  const closing = [];
  if (prose) {
    const next = prose.nextElementSibling;
    const stage = document.createElement('div');
    stage.className = 'sys-end-stage';
    prose.before(stage);
    stage.append(prose);
    if (next) stage.append(next);
    closing.push(wrap(stage, 'sys-scene--end'));
  }

  const words = $('.sys-words');
  const scenes = [...hero, ...chapters, ...versus, ...rig, ...steps, ...diagrams, ...pair, ...route, ...antenna, ...closing, words].filter(Boolean);

  // Text that lights up as the scene is scrolled: a character at a time, or a word at a time in English.
  const reveals = [
    ...chapters.map(scene => [scene, $('.po-ch-lead', scene)]),
    ...diagrams.map(scene => [scene, $('figcaption', scene)]),
    ...closing.map(scene => [scene, $('.po-prose', scene)]),
  ].filter(([, el]) => el);

  const split = () => {
    const en = root.lang === 'en';
    reveals.forEach(([scene, el]) => {
      const text = el.textContent;
      el.setAttribute('aria-label', text);
      el.textContent = '';
      (en ? text.split(/(\s+)/) : [...text]).forEach(part => {
        const s = document.createElement('span');
        s.textContent = part;
        s.setAttribute('aria-hidden', 'true');
        el.append(s);
      });
      scene.chars = [...el.children];
    });
  };

  // The chapter word list shows one description and link at a time.
  const list = words ? $$('li', words) : [];
  const desc = words && $('.sys-words-d', words);
  const go = words && $('.sys-words-go', words);
  let activeWord = -1;
  const showWord = i => {
    if (i === activeWord || !list[i]) return;
    activeWord = i;
    list.forEach((li, n) => li.classList.toggle('is-on', n === i));
    desc.textContent = $('span', list[i]).textContent;
    go.href = $('a', list[i]).getAttribute('href');
  };

  const update = () => {
    ticking = false;
    if (!media.matches) return;
    const vh = innerHeight;
    scenes.forEach(scene => {
      const r = scene.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) return;
      const p = clamp(-r.top / (r.height - vh));
      scene.style.setProperty('--p', p.toFixed(4));
      if (scene.chars) {
        const lit = (p - 0.06) / 0.66;
        const n = scene.chars.length;
        scene.chars.forEach((c, i) => { c.style.opacity = 0.14 + 0.86 * clamp((lit - i / n) * n / 6); });
      }
      if (scene === words) showWord(Math.min(list.length - 1, Math.floor(p * list.length)));
      if (steps.includes(scene)) {
        const items = $$('.po-eng-steps li', scene);
        const on = Math.min(items.length - 1, Math.floor(p * items.length));
        items.forEach((li, n) => li.classList.toggle('is-on', n === on));
      }
      if (antenna.includes(scene)) scene.classList.toggle('is-second', p > 0.5);
    });
  };

  let ticking = false;
  const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

  const sync = () => {
    root.classList.toggle('sys-motion', media.matches);
    scenes.forEach(scene => (scene.chars || []).forEach(c => { c.style.opacity = media.matches ? '' : 1; }));
    update();
  };

  // Big numbers count up the first time they come into view.
  const countUp = b => {
    const node = b.firstChild;
    const target = node.textContent;
    const value = parseFloat(target);
    const places = (target.split('.')[1] || '').length;
    if (calm.matches || !value) return;
    const start = performance.now();
    const tick = now => {
      const t = clamp((now - start) / 1200);
      const eased = 1 - Math.pow(1 - t, 3);
      node.textContent = (value * eased).toFixed(places);
      if (t < 1) requestAnimationFrame(tick);
      else node.textContent = target;
    };
    requestAnimationFrame(tick);
  };
  const seen = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    seen.unobserve(e.target);
    e.target.classList.add('is-in');
    $$('b', e.target).forEach(countUp);
  }), { threshold: 0.35 });
  $$('.sys-stats').forEach(el => seen.observe(el));

  // Soft light that follows the pointer
  if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
    const glow = document.createElement('div');
    glow.className = 'sys-glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.append(glow);
    addEventListener('pointermove', e => {
      glow.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
      glow.style.opacity = media.matches ? 1 : 0;
    }, { passive: true });
  }

  document.addEventListener('languagechange', () => {
    split();
    activeWord = -1;
    sync();
  });
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  media.addEventListener('change', sync);
  split();
  sync();
})();
