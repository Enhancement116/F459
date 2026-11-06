// Scroll-driven scenes for the System page: pinned chapter openers whose text lights up as you
// scroll, a chapter word list that highlights in turn, and the rig with its parts rising around it.
// Below 1024px or with reduced motion the class stays off and the page reads as a normal document.
(() => {
  const root = document.documentElement;
  const media = matchMedia('(min-width:1024px) and (prefers-reduced-motion:no-preference)');
  const clamp = v => Math.min(1, Math.max(0, v));

  const wrap = (el, cls) => {
    const scene = document.createElement('div');
    scene.className = 'sys-scene ' + cls;
    el.before(scene);
    scene.append(el);
    return scene;
  };

  const chapters = [...document.querySelectorAll('.po-ch-head')].map(head => wrap(head, 'sys-scene--ch'));
  const rigFigure = document.querySelector('.po-viz.svx');
  const rig = rigFigure ? wrap(rigFigure, 'sys-scene--rig') : null;
  const versus = [...document.querySelectorAll('.po-cards--2')].map(cards => wrap(cards, 'sys-scene--vs'));
  const words = document.querySelector('.sys-words');
  const scenes = [...chapters, ...versus, rig, words].filter(Boolean);

  // Split a lead into single characters (whole words in English) so each can light up on its own.
  const split = () => {
    const en = root.lang === 'en';
    chapters.forEach(scene => {
      const lead = scene.querySelector('.po-ch-lead');
      if (!lead) return;
      const text = lead.textContent;
      lead.setAttribute('aria-label', text);
      lead.textContent = '';
      (en ? text.split(/(\s+)/) : [...text]).forEach(part => {
        const s = document.createElement('span');
        s.textContent = part;
        s.setAttribute('aria-hidden', 'true');
        lead.append(s);
      });
      scene.chars = [...lead.children];
    });
  };

  // The word list shows one chapter's description and link at a time.
  const list = words ? [...words.querySelectorAll('li')] : [];
  const desc = words && words.querySelector('.sys-words-d');
  const go = words && words.querySelector('.sys-words-go');
  let active = -1;
  const showWord = i => {
    if (i === active || !list[i]) return;
    active = i;
    list.forEach((li, n) => li.classList.toggle('is-on', n === i));
    desc.textContent = list[i].querySelector('span').textContent;
    go.href = list[i].querySelector('a').getAttribute('href');
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
        const lit = (p - 0.08) / 0.62;
        const n = scene.chars.length;
        scene.chars.forEach((c, i) => { c.style.opacity = 0.16 + 0.84 * clamp((lit - i / n) * n / 6); });
      }
      if (scene === words) showWord(Math.min(list.length - 1, Math.floor(p * list.length)));
    });
  };

  let ticking = false;
  const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

  const sync = () => {
    root.classList.toggle('sys-motion', media.matches);
    chapters.forEach(scene => (scene.chars || []).forEach(c => { c.style.opacity = media.matches ? '' : 1; }));
    update();
  };

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
    active = -1;
    sync();
  });
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  media.addEventListener('change', sync);
  split();
  sync();
})();
