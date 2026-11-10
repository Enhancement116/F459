// Scroll-driven stages for the System page. Each scene is a tall wrapper with one pinned, screen-sized
// stage, and each scene has a number of steps. Only the scene at the middle of the screen is shown, so
// two stages are never read at once. Wheel, keyboard and touch all rest on the same stops.
// With reduced motion, or on a screen too short for a stage, the page stays a normal document.
(() => {
  const root = document.documentElement;
  const media = matchMedia('(prefers-reduced-motion:no-preference) and (min-height:500px)');
  const coarse = matchMedia('(pointer:coarse)');
  const calm = matchMedia('(prefers-reduced-motion:reduce)');
  // Readers can turn the stages off and read the page as a normal document; the choice is remembered.
  const MODE_KEY = 'f459-reading';
  let plain = false;
  try { plain = localStorage.getItem(MODE_KEY) === 'plain'; } catch (e) {}
  const motion = () => media.matches && !plain;
  const clamp = v => Math.min(1, Math.max(0, v));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const scenes = [];
  const adopt = (scene, stage, cls, steps) => {
    scene.classList.add('sys-scene', cls);
    scene.style.setProperty('--n', steps);
    stage.classList.add('sys-stage');
    scene.stage = stage;
    scene.steps = steps;
    // Touch screens rest on these markers through CSS scroll snapping.
    for (let i = 0; i < steps; i++) {
      const snap = document.createElement('i');
      snap.className = 'sys-snap';
      snap.setAttribute('aria-hidden', 'true');
      snap.style.top = `calc(${i} * var(--sys-step))`;
      scene.append(snap);
    }
    scenes.push(scene);
    return scene;
  };
  const wrapAll = (selector, cls, steps) => $$(selector).map(el => {
    const scene = document.createElement('div');
    el.before(scene);
    scene.append(el);
    return adopt(scene, el, cls, steps);
  });

  wrapAll('.po-hero--tech', 'sys-scene--hero', 1);
  const words = $('.sys-words');
  if (words) adopt(words, $('.sys-words-stage', words), 'sys-scene--words', 1);
  const chapters = wrapAll('.po-ch-head', 'sys-scene--ch', 1);
  wrapAll('.po-cards--2', 'sys-scene--vs', 2);
  wrapAll('.sys-track', 'sys-scene--track', 1);
  wrapAll('.po-viz.svx', 'sys-scene--rig', 4);
  wrapAll('.sys-eng', 'sys-scene--eng', 3);
  wrapAll('.sys-speed', 'sys-scene--speed', 1);
  const pairs = wrapAll('.sys-pair', 'sys-scene--pair', 4);
  wrapAll('.sys-duo--side', 'sys-scene--route', 2);
  wrapAll('.sys-nmea', 'sys-scene--nmea', 4);
  wrapAll('.sys-duo--plot', 'sys-scene--ant', 2);

  // Other pages mark their stages in the markup: data-scene names the scene, data-steps counts its stops.
  $$('[data-scene]').forEach(el => {
    const scene = document.createElement('div');
    el.before(scene);
    scene.append(el);
    adopt(scene, el, `sys-scene--${el.dataset.scene}`, Math.max(1, +el.dataset.steps || 1));
  });

  // The closing line and its buttons share one stage.
  const closing = [];
  const prose = $('.po-prose');
  if (prose) {
    const next = prose.nextElementSibling;
    const stage = document.createElement('div');
    stage.className = 'sys-end-stage';
    prose.before(stage);
    stage.append(prose);
    if (next) stage.append(next);
    const scene = document.createElement('div');
    stage.before(scene);
    scene.append(stage);
    closing.push(adopt(scene, stage, 'sys-scene--end', 1));
  }

  // Text that lights up when its scene arrives: a character at a time, or a word at a time in English.
  const reveals = [...chapters.map(scene => $('.po-ch-lead', scene)), ...closing.map(scene => $('.po-prose', scene))].filter(Boolean);
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh-Hant', { granularity: 'word' }) : null;
  // Each word as a list of characters, with punctuation kept on the word before it.
  const UNIT_START = /^(毫秒|秒|分鐘|小時|個通道|個樣本|個路點|個|筆|行|倍|顆|次|MHz|GHz|Msps|KB|GB|dBi|dB|mm|ms|m\/s)/;
  // Everywhere else on the page, a number and its unit are held on one line.
  const NUMBER_UNIT = /\d[\d,.]*\s?(?:毫秒|秒|分鐘|小時|個通道|個樣本|個路點|個|筆|行|倍|顆|次|MHz|GHz|Msps|KB|GB|dBi|dB|mm|ms|m\/s)/g;
  const keepUnits = () => {
    const main = $('main');
    if (!main) return;
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode: n => ((NUMBER_UNIT.lastIndex = 0, NUMBER_UNIT.test(n.data)) && !n.parentElement.closest('svg,pre,code,script,style,x-nw,.sys-word,.sys-ch,canvas')
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const frag = document.createDocumentFragment();
      let at = 0;
      node.data.replace(NUMBER_UNIT, (m, i) => {
        frag.append(node.data.slice(at, i));
        const span = document.createElement('x-nw');
        span.textContent = m;
        frag.append(span);
        at = i + m.length;
        return m;
      });
      frag.append(node.data.slice(at));
      node.replaceWith(frag);
    });
  };
  const wordsOf = text => {
    if (!segmenter) return [...text].map(c => [c]);
    const words = [];
    for (const { segment, isWordLike } of segmenter.segment(text)) {
      const last = words[words.length - 1] || '';
      // A number keeps its unit: "1 毫秒" never breaks between the two.
      const afterNumber = /\d\s*$/.test(last) && (/^\s+$/.test(segment) || UNIT_START.test(segment));
      if (words.length && (afterNumber || (!isWordLike && segment.trim()))) words[words.length - 1] += segment;
      else words.push(segment);
    }
    return words.map(w => [...w]);
  };

  const split = () => {
    const en = root.lang === 'en';
    reveals.forEach(el => {
      const text = el.textContent;
      // Chinese breaks between sentences first, then between clauses if a sentence is too wide,
      // and only between whole words if a single clause still does not fit.
      const clauses = t => (t.match(/[^，；：]+[，；：]?/g) || [t]).map(wordsOf);
      const sentences = en ? [[[text.split(/(\s+)/)]]] : (text.match(/[^。？！]+[。？！]?/g) || [text]).map(clauses);
      const total = sentences.flat(3).length;
      el.setAttribute('aria-label', text);
      el.textContent = '';
      el.style.setProperty('--d', `${(1.3 / total).toFixed(4)}s`);
      let count = 0;
      const add = (holder, parts) => parts.forEach(part => {
        const c = document.createElement('span');
        c.className = 'sys-ch';
        c.textContent = part;
        c.setAttribute('aria-hidden', 'true');
        c.style.setProperty('--c', count++);
        holder.append(c);
      });
      const box = (parent, name) => {
        const span = parent.appendChild(document.createElement('span'));
        span.className = name;
        return span;
      };
      if (en) { add(el, sentences[0][0][0]); return; }
      sentences.forEach(sentence => {
        const line = box(el, 'sys-sent');
        sentence.forEach(clause => {
          const holder = box(line, 'sys-clause');
          clause.forEach(word => add(word[0].trim() ? box(holder, 'sys-word') : holder, word));
        });
      });
    });
  };

  // One question at a time, while the test moves along the route of stations.
  const list = words ? $$('li', words) : [];
  const desc = words && $('.sys-words-d', words);
  const go = words && $('.sys-words-go', words);
  const number = words && $('.sys-words-n', words);
  const route = words && $('.sys-index', words);
  let activeWord = -1;
  // Whole words stay together, and punctuation stays with the character before it.
  const revealText = (el, text) => {
    el.textContent = '';
    el.setAttribute('aria-label', text);
    (text.match(/[A-Za-z0-9'\u2019-]+[?,.]?\s*|\S[\uFF1F\uFF0C]?/g) || []).forEach((part, n) => {
      const span = document.createElement('span');
      span.textContent = part.trim();
      span.style.setProperty('--c', n);
      span.setAttribute('aria-hidden', 'true');
      el.append(span, /\s$/.test(part) ? ' ' : '');
    });
  };
  const showWord = i => {
    if (i === activeWord || !list[i]) return;
    activeWord = i;
    list.forEach((li, n) => {
      li.classList.toggle('is-on', n === i);
      li.classList.toggle('is-past', n < i);
    });
    route.style.setProperty('--p', i / (list.length - 1));
    number.textContent = `0${i + 1}`;
    number.animate([{ opacity: 0, transform: 'translateX(4%)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'ease-out' });
    revealText(desc, $('span', list[i]).textContent);
    go.href = $('a', list[i]).getAttribute('href');
  };

  // The five questions share one stop and take turns by themselves; pointing at one shows it.
  let wordTimer = 0;
  let wordsHere = false;
  const cycleWords = on => {
    clearInterval(wordTimer);
    if (!on || !list.length) return;
    showWord(Math.max(0, activeWord));
    wordTimer = setInterval(() => showWord((activeWord + 1) % list.length), 2600);
  };
  list.forEach((li, n) => li.addEventListener('pointerenter', () => { showWord(n); if (wordsHere) cycleWords(true); }));

  // The CPU and GPU race runs again every few seconds while it is on screen, so the GPU side
  // can be watched after reading the CPU side.
  const race = $('.sys-load-race');
  let raceOn = false;
  let raceTimer = 0;
  const raceLoop = on => {
    if (on === raceOn || !race) return;
    raceOn = on;
    clearInterval(raceTimer);
    if (!on) return;
    raceTimer = setInterval(() => {
      race.classList.add('is-reset');
      void race.offsetWidth;
      race.classList.remove('is-reset');
    }, 9500);
  };

  const stepOf = scene => {
    if (scene.steps < 2) return 0;
    const travel = scene.offsetHeight - scene.stage.offsetHeight;
    return Math.min(scene.steps - 1, Math.max(0, Math.round(-scene.getBoundingClientRect().top / (travel / (scene.steps - 1)))));
  };

  // A number that runs up when its step arrives, and rests at its start value otherwise.
  const countTo = (el, on) => {
    const from = +(el.dataset.countFrom || 0);
    const to = +el.dataset.count;
    const show = v => { el.textContent = Math.round(v).toLocaleString('en') + (v >= to ? el.dataset.countSuffix || '' : ''); };
    if (!on) { cancelAnimationFrame(el.countFrame); el.counted = false; show(from); return; }
    if (el.counted) return;
    el.counted = true;
    const start = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - start) / 1800);
      show(from + (to - from) * (1 - (1 - k) ** 3));
      if (k < 1) el.countFrame = requestAnimationFrame(tick);
    };
    el.countFrame = requestAnimationFrame(tick);
  };

  let ticking = false;
  const update = () => {
    ticking = false;
    if (!motion()) return;
    const mid = innerHeight / 2;
    scenes.forEach(scene => {
      const r = scene.getBoundingClientRect();
      const here = r.top <= mid && r.bottom > mid;
      // Coming back to a stage: jump to its current step first, so the last visit's state cannot flash.
      if (here && !scene.classList.contains('is-here')) {
        scene.classList.add('is-entering');
        scene.dataset.step = stepOf(scene);
        void scene.offsetWidth;
        scene.classList.remove('is-entering');
      }
      scene.classList.toggle('is-here', here);
      if (scene === words && here !== wordsHere) { wordsHere = here; cycleWords(here); }
      if (scene.classList.contains('sys-scene--load')) raceLoop(here && stepOf(scene) === 3);
      if (!here) return;
      const step = stepOf(scene);
      scene.dataset.step = step;
      $$('[data-count]', scene).forEach(el => countTo(el, step >= +(el.dataset.countStep || 0)));
      $$('.po-eng-steps>li,.sys-nmea-steps>li', scene).forEach((li, n) => li.classList.toggle('is-on', n === step));
      $$('.svx-cap ol>li', scene.classList.contains('sys-scene--rig') ? scene : document.createDocumentFragment()).forEach((li, n) => li.classList.toggle('is-on', n === step));
    });
  };
  const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { update(); showPlace(); }); } };

  // Stages sit below the header and chapter bar, and above the floating chapter button on phones.
  const measureBars = () => {
    const header = $('header');
    const bar = $('.pcn-bar');
    const fab = $('.pcn-fab');
    const shown = el => el && getComputedStyle(el).display !== 'none';
    const top = Math.max(header ? header.getBoundingClientRect().height : 0, shown(bar) ? bar.getBoundingClientRect().bottom : 0);
    root.style.setProperty('--sys-top', `${Math.ceil(top) + 10}px`);
    root.style.setProperty('--sys-bottom', shown(fab) || shown($('.sys-ctl')) ? '80px' : '20px');
  };

  // Each screenshot first fills the stage: work out the move from its resting place to the centre.
  const measureZoom = () => pairs.forEach(scene => {
    const stage = scene.stage;
    const css = getComputedStyle(stage);
    const left = parseFloat(css.paddingLeft);
    const top = parseFloat(css.paddingTop);
    const width = stage.clientWidth - left * 2;
    const height = stage.clientHeight - top - parseFloat(css.paddingBottom);
    const offset = (el, side) => { let v = 0; while (el && el !== stage) { v += el[side]; el = el.offsetParent; } return v; };
    $$('.po-viz', stage).forEach(fig => {
      const img = $('img', fig);
      const bar = $('.po-viz-bar', fig);
      const ratio = img.getAttribute('width') / img.getAttribute('height');
      const drawnW = Math.min(img.offsetWidth, img.offsetHeight * ratio);
      const drawnH = drawnW / ratio;
      // The title keeps its size and sits directly above the enlarged image, whatever empty
      // space the image box has around it. The pair is centred inside the stage's safe area.
      const titleH = bar.offsetHeight;
      const scale = Math.max(1, Math.min(width / drawnW, (height - titleH) / drawnH));
      const groupH = titleH + drawnH * scale;
      const groupTop = top + Math.max(0, (height - groupH) / 2);
      const centreX = left + width / 2;
      const imgX = offset(img, 'offsetLeft') + img.offsetWidth / 2;
      const imgY = offset(img, 'offsetTop') + img.offsetHeight / 2;
      const barX = offset(bar, 'offsetLeft') + bar.offsetWidth / 2;
      const barY = offset(bar, 'offsetTop') + titleH / 2;
      fig.style.setProperty('--zs', scale.toFixed(3));
      fig.style.setProperty('--zx', `${(centreX - imgX).toFixed(1)}px`);
      fig.style.setProperty('--zy', `${(groupTop + titleH + drawnH * scale / 2 - imgY).toFixed(1)}px`);
      fig.style.setProperty('--bx', `${(centreX - barX).toFixed(1)}px`);
      fig.style.setProperty('--by', `${(groupTop + titleH / 2 - barY).toFixed(1)}px`);
    });
  });

  let stops = [];
  const measureStops = () => {
    stops = scenes.flatMap(scene => {
      const top = scene.getBoundingClientRect().top + scrollY;
      const travel = scene.offsetHeight - scene.stage.offsetHeight;
      return Array.from({ length: scene.steps }, (_, i) => Math.round(top + (scene.steps > 1 ? travel * i / (scene.steps - 1) : 0)));
    }).sort((a, b) => a - b);
    // The hero starts just under the header, so the very top of the page is its stop.
    if (stops[0] < innerHeight * 0.3) stops[0] = 0;
  };

  // One wheel or key input moves one stop, then the page holds so nothing leaves before it is read.
  // Inertia and fast spinning are swallowed during the hold.
  const GLIDE_MS = 520;   // the move itself
  const HOLD_MS = 600;    // shortest time from one step to the next, glide included
  const SETTLE_MS = 900;  // a continuous wheel stream cannot step again before this
  const QUIET_MS = 140;   // silence that marks the end of one wheel gesture

  let gliding = false;
  let glideFrame = 0;
  const stopGlide = () => { cancelAnimationFrame(glideFrame); gliding = false; };
  const glide = to => {
    const from = scrollY;
    const start = performance.now();
    gliding = true;
    const step = now => {
      const t = clamp((now - start) / GLIDE_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      scrollTo({ top: from + (to - from) * eased, behavior: 'instant' });
      if (t < 1) glideFrame = requestAnimationFrame(step);
      else gliding = false;
    };
    glideFrame = requestAnimationFrame(step);
  };
  const nextStop = down => {
    const y = scrollY;
    return down ? stops.find(s => s > y + 2) : [...stops].reverse().find(s => s < y - 2);
  };
  const paused = () => $('dialog[open]') || root.classList.contains('pcn-locked');

  let lastWheel = 0;
  let steppedAt = -Infinity;
  addEventListener('wheel', e => {
    if (!motion() || e.ctrlKey || !e.deltaY || paused()) return;
    setAuto(false);
    const now = performance.now();
    const quiet = now - lastWheel;
    lastWheel = now;
    const next = nextStop(e.deltaY > 0);
    if (next === undefined) return;
    e.preventDefault();
    const since = now - steppedAt;
    if (gliding || since < HOLD_MS || (since < SETTLE_MS && quiet < QUIET_MS)) return;
    steppedAt = now;
    glide(next);
  }, { passive: false });

  addEventListener('keydown', e => {
    if (!motion() || e.altKey || e.ctrlKey || e.metaKey || paused()) return;
    if (e.target.closest?.('input,textarea,select,button,summary,canvas,[contenteditable]')) return;
    const down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey);
    const up = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey);
    const ends = e.key === 'Home' ? stops[0] : e.key === 'End' ? stops[stops.length - 1] : undefined;
    if (ends !== undefined) { e.preventDefault(); setAuto(false); glide(ends); return; }
    if (!down && !up) return;
    setAuto(false);
    const next = nextStop(down);
    if (next === undefined) return;
    e.preventDefault();
    if (gliding || performance.now() - steppedAt < HOLD_MS) return;
    steppedAt = performance.now();
    glide(next);
  });
  addEventListener('hashchange', stopGlide);

  // Can one computer keep up? First the two cards take the middle of the stage, large; when the answer
  // comes in they go back to their column beside it.
  // Chapter title stages: the title itself sits at the middle of the window, with its kicker above
  // and its lead below, rather than the whole group being centred.
  const measureTitles = () => $$('.sys-scene--ch').forEach(scene => {
    const stage = scene.stage;
    const title = $('h2', stage);
    if (!title) return;
    stage.style.setProperty('--ch-shift', '0px');
    if (!motion()) return;
    const box = stage.getBoundingClientRect();
    const r = title.getBoundingClientRect();
    const shift = innerHeight / 2 - (r.top - box.top + r.height / 2);
    stage.style.setProperty('--ch-shift', `${Math.round(shift)}px`);
  });

  const measureWork = () => $$('.sys-scene--speed').forEach(scene => {
    const stage = $('.sys-stage', scene);
    const work = $('.sys-work', scene);
    const bar = $('.po-viz-bar', stage);
    if (!stage || !work || !bar) return;
    const css = getComputedStyle(stage);
    const offset = (el, side) => { let v = 0; while (el && el !== stage) { v += el[side]; el = el.offsetParent; } return v; };
    const rowTop = offset(bar, 'offsetTop') + bar.offsetHeight + 12;
    const rowBottom = stage.clientHeight - parseFloat(css.paddingBottom);
    const w = work.offsetWidth;
    const h = work.offsetHeight;
    const scale = Math.max(1, Math.min(1.35, stage.clientWidth * 0.6 / w, (rowBottom - rowTop) * 0.94 / h));
    work.style.setProperty('--ws', scale.toFixed(3));
    work.style.setProperty('--wx', `${(stage.clientWidth / 2 - offset(work, 'offsetLeft') - w / 2).toFixed(1)}px`);
    work.style.setProperty('--wy', `${((rowTop + rowBottom) / 2 - offset(work, 'offsetTop') - h / 2).toFixed(1)}px`);
  });

  // The NMEA files are filled with a full drive's worth of rows that keep streaming in, with a count
  // of how many rows the whole drive takes. Positions follow one illustrative route, and every NMEA
  // sentence carries its real checksum.
  const fillTerms = () => {
    const terms = $$('.sys-nmea-steps pre.sys-term');
    if (terms.length < 3) return;
    const route = [[24.97, 121.419], [24.9731, 121.4262], [24.9768, 121.4335], [24.9802, 121.4411], [24.9851, 121.4452], [24.9903, 121.4497],
      [24.9946, 121.4569], [24.9978, 121.4648], [25.0021, 121.4703], [25.0069, 121.4741], [25.0102, 121.4815], [25.0139, 121.4889]];
    const metres = (a, b) => Math.hypot((b[0] - a[0]) * 110574, (b[1] - a[1]) * 111320 * Math.cos(a[0] * Math.PI / 180));
    const legs = route.slice(1).map((p, n) => metres(route[n], p));
    const at = d => {
      for (let n = 0; n < legs.length; n++) {
        if (d <= legs[n]) { const t = d / legs[n]; return route[n].map((v, m) => v + (route[n + 1][m] - v) * t); }
        d -= legs[n];
      }
      return route[route.length - 1];
    };
    const rows = [];
    let d = 0;
    let v = 0;
    for (let t = 0; t < 120; t++) {
      rows.push({ t, p: at(d), v });
      v = Math.min(13.9, v + 1.6);
      d += v;
    }
    const clock = t => `10:${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    const nmeaDeg = (deg, w) => { const a = Math.floor(deg); return `${String(a).padStart(w, '0')}${((deg - a) * 60).toFixed(4).padStart(7, '0')}`; };
    const sum = body => [...body].reduce((x, c) => x ^ c.charCodeAt(0), 0).toString(16).toUpperCase().padStart(2, '0');
    const gga = r => {
      const body = `GPGGA,${clock(r.t).replace(/:/g, '')}.00,${nmeaDeg(r.p[0], 2)},N,${nmeaDeg(r.p[1], 3)},E,1,08,1.0,120.0,M,0.0,M,,`;
      return `$${body}*${sum(body)}`;
    };
    const files = [
      { head: 'lat       lon', lines: route.map(p => `${p[0].toFixed(4)}   ${p[1].toFixed(4)}`), total: 46, zh: '個路點要查', en: 'points to look up', roll: 18 },
      { head: 'time      lat       lon        m/s', lines: rows.map(r => `${clock(r.t)}  ${r.p[0].toFixed(5)}  ${r.p[1].toFixed(5)}  ${r.v.toFixed(1)}`), total: 1800, zh: '筆（30 分鐘，每秒一筆）', en: 'rows (30 min, one per second)', roll: 60 },
      { head: '', lines: rows.map(gga), total: 1800, zh: '行，每行都要算校驗碼', en: 'lines, each with its checksum', roll: 60 },
    ];
    terms.forEach((pre, n) => {
      const f = files[n];
      const code = $('code', pre);
      if (!code || code.dataset.filled) return;
      code.dataset.filled = '1';
      code.textContent = '';
      if (f.head) { const h = document.createElement('span'); h.textContent = f.head; code.append(h); }
      const flow = document.createElement('div');
      flow.className = 'sys-term-flow';
      const roll = document.createElement('div');
      roll.className = 'sys-term-roll';
      roll.style.setProperty('--roll', `${f.roll}s`);
      roll.textContent = [...f.lines, ...f.lines].join('\n');
      flow.append(roll);
      code.append(flow);
      const meta = document.createElement('div');
      meta.className = 'sys-term-meta';
      meta.setAttribute('aria-hidden', 'true');
      pre.append(meta);
      // The count runs up each time the step comes into view.
      const li = pre.closest('li');
      let run = 0;
      const show = k => {
        const en = root.lang === 'en';
        meta.innerHTML = `<span>${en ? 'Whole drive' : '整段路程'}</span><span><b>${Math.round(k).toLocaleString('en')}</b> ${en ? f.en : f.zh}</span>`;
      };
      const count = () => {
        cancelAnimationFrame(run);
        if (!li.classList.contains('is-on') || !motion()) { show(f.total); return; }
        const start = performance.now();
        const tick = now => {
          const k = Math.min(1, (now - start) / 2200);
          show(f.total * (1 - (1 - k) ** 3));
          if (k < 1) run = requestAnimationFrame(tick);
        };
        run = requestAnimationFrame(tick);
      };
      new MutationObserver(count).observe(li, { attributes: true, attributeFilter: ['class'] });
      document.addEventListener('languagechange', () => setTimeout(() => show(f.total)));
      show(f.total);
    });
  };
  fillTerms();
  // Workload dots: one per 1,000 computations, coloured by the layer they belong to.
  $$('.sys-load-dots').forEach(box => {
    if (box.childElementCount) return;
    const [a, b] = (box.dataset.layers || '').split(',').map(Number);
    for (let k = 0, n = +box.dataset.n || 336; k < n; k++) {
      const dot = document.createElement('i');
      dot.className = k < a ? 'l0' : k < b ? 'l1' : 'l2';
      // Dots the CPU never reaches before time runs out
      if (box.dataset.late && k >= +box.dataset.late) dot.classList.add('late');
      dot.style.setProperty('--k', k);
      dot.style.setProperty('--r', Math.floor(k / 24));
      // Within its own layer each dot arrives a moment after the one before.
      dot.style.setProperty('--j', k < a ? k : k < b ? k - a : k - b);
      box.append(dot);
    }
  });
  keepUnits();

  // ---- Controls for readers without a wheel: previous and next stop, where they are, and autoplay
  const say = (el, zh, en, attr) => {
    const v = root.lang === 'en' ? en : zh;
    if (attr) el.setAttribute(attr, v); else el.textContent = v;
  };
  const ctl = document.createElement('div');
  ctl.className = 'sys-ctl';
  ctl.setAttribute('role', 'group');
  ctl.innerHTML = '<button type="button" class="sys-ctl-prev"><span aria-hidden="true">↑</span></button>'
    + '<span class="sys-ctl-n"><b>01</b><small></small></span>'
    + '<button type="button" class="sys-ctl-next"><span aria-hidden="true">↓</span></button>'
    + '<button type="button" class="sys-ctl-play"><span aria-hidden="true"></span></button><i class="sys-ctl-bar" aria-hidden="true"></i>';
  document.body.append(ctl);
  const prevBtn = $('.sys-ctl-prev', ctl);
  const nextBtn = $('.sys-ctl-next', ctl);
  const playBtn = $('.sys-ctl-play', ctl);
  const modeBtns = [];
  let auto = false;
  let autoTimer = 0;
  const placeOf = () => {
    let best = 0;
    stops.forEach((s, i) => { if (Math.abs(s - scrollY) < Math.abs(stops[best] - scrollY)) best = i; });
    return best;
  };
  const showPlace = () => {
    if (!stops.length) return;
    const i = placeOf();
    $('b', ctl).textContent = String(i + 1).padStart(2, '0');
    $('small', ctl).textContent = ` / ${stops.length}`;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === stops.length - 1;
  };
  // Each stop stays up long enough to read what it shows.
  const dwell = () => {
    const scene = $('.sys-scene.is-here');
    if (!scene) return 4000;
    const chars = (scene.stage.innerText || '').replace(/\s+/g, '').length / scene.steps;
    return Math.round(Math.min(9000, Math.max(3200, 1800 + chars * 45)));
  };
  const schedule = () => {
    clearTimeout(autoTimer);
    if (!auto) return;
    const ms = dwell();
    ctl.style.setProperty('--dwell', `${ms}ms`);
    ctl.classList.remove('is-timing');
    void ctl.offsetWidth;
    ctl.classList.add('is-timing');
    autoTimer = setTimeout(() => {
      const next = nextStop(true);
      if (next === undefined) { setAuto(false); return; }
      steppedAt = performance.now();
      glide(next);
      autoTimer = setTimeout(schedule, GLIDE_MS + 80);
    }, ms);
  };
  const labels = () => {
    say(ctl, '逐步導覽', 'Step through', 'aria-label');
    say(prevBtn, '上一步（↑ 鍵）', 'Previous (↑ key)', 'aria-label');
    say(nextBtn, '下一步（↓ 或空白鍵）', 'Next (↓ or Space)', 'aria-label');
    prevBtn.title = prevBtn.getAttribute('aria-label');
    nextBtn.title = nextBtn.getAttribute('aria-label');
    say(playBtn, auto ? '暫停自動播放' : '自動播放', auto ? 'Pause autoplay' : 'Autoplay', 'aria-label');
    playBtn.title = playBtn.getAttribute('aria-label');
    $('span', playBtn).textContent = auto ? '❚❚' : '▶';
    modeBtns.forEach(b => {
      say(b, plain ? '導覽模式' : '一般閱讀', plain ? 'Guided view' : 'Plain scroll');
      say(b, plain ? '回到一步一停的導覽' : '改成一般網頁，自由捲動', plain ? 'Back to one stop at a time' : 'Read as a normal page and scroll freely', 'title');
      b.setAttribute('aria-pressed', String(plain));
    });
  };
  function setAuto(on) {
    if (on === auto) return;
    auto = on;
    ctl.classList.toggle('is-playing', on);
    if (!on) { clearTimeout(autoTimer); ctl.classList.remove('is-timing'); }
    labels();
    if (!on) return;
    // From the last stop, autoplay starts again at the top.
    if (nextStop(true) === undefined) { glide(stops[0]); autoTimer = setTimeout(schedule, GLIDE_MS + 80); } else schedule();
  }
  const stepBy = down => {
    setAuto(false);
    const next = nextStop(down);
    if (next === undefined || gliding) return;
    steppedAt = performance.now();
    glide(next);
  };
  prevBtn.addEventListener('click', () => stepBy(false));
  nextBtn.addEventListener('click', () => stepBy(true));
  playBtn.addEventListener('click', () => setAuto(!auto));
  // Any other touch or click from the reader pauses autoplay.
  ['pointerdown', 'touchstart'].forEach(ev => addEventListener(ev, e => { if (!e.target.closest?.('.sys-ctl')) setAuto(false); }, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) setAuto(false); });

  // ---- The mode switch: in the header on wide screens, in the menu on phones
  const switchMode = () => {
    setAuto(false);
    stopGlide();
    // Keep the reader at the same place across the switch.
    const top = parseFloat(getComputedStyle(root).getPropertyValue('--sys-top')) || 90;
    const anchor = plain
      ? (scenes.find(sc => { const r = sc.stage.getBoundingClientRect(); return r.top <= innerHeight * 0.4 && r.bottom > innerHeight * 0.4; }) || scenes.find(sc => sc.stage.getBoundingClientRect().bottom > top + 40))
      : $('.sys-scene.is-here');
    plain = !plain;
    try { localStorage.setItem(MODE_KEY, plain ? 'plain' : 'guided'); } catch (e) {}
    sync();
    labels();
    if (!anchor) return;
    if (plain) scrollTo({ top: anchor.stage.getBoundingClientRect().top + scrollY - top, behavior: 'instant' });
    else scrollTo({ top: anchor.getBoundingClientRect().top + scrollY, behavior: 'instant' });
    update();
    showPlace();
  };
  const makeMode = (cls, where, before) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `sys-mode ${cls}`;
    if (before) where.insertBefore(b, before); else where.append(b);
    b.addEventListener('click', switchMode);
    modeBtns.push(b);
  };
  const headerEl = $('header');
  if (headerEl && $('#language')) makeMode('sys-mode--head', headerEl, $('#language'));
  if ($('#site-nav')) makeMode('sys-mode--menu', $('#site-nav'));
  document.addEventListener('languagechange', () => setTimeout(labels));
  labels();

  const sync = () => {
    root.classList.toggle('sys-motion', motion());
    root.classList.toggle('sys-touch', motion() && coarse.matches);
    measureBars();
    measureStops();
    measureZoom();
    measureWork();
    measureTitles();
    update();
    showPlace();
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
      glow.style.opacity = motion() ? 1 : 0;
    }, { passive: true });
  }

  document.addEventListener('languagechange', () => setTimeout(keepUnits, 30));
  document.addEventListener('languagechange', () => {
    split();
    activeWord = -1;
    sync();
  });
  addEventListener('scroll', queue, { passive: true });
  // The header stays clear at the very top and frosts as soon as the page moves.
  const markScrolled = () => root.classList.toggle('sys-scrolled', scrollY > 8);
  addEventListener('scroll', markScrolled, { passive: true });
  markScrolled();

  // One mark glides between the site links and between the chapters.
  const placeMark = (box, el) => {
    if (!box || !el) return;
    box.style.setProperty('--gx', `${el.offsetLeft}px`);
    box.style.setProperty('--gw', `${el.offsetWidth}px`);
  };
  const siteNav = $('#site-nav');
  const rail = $('.pcn-bar ol');
  const menu = $('.menu-toggle');
  const placeMarks = () => {
    placeMark(siteNav, $('a[aria-current=page]', siteNav));
    placeMark(rail, $('a.is-current', rail)?.parentElement);
  };
  siteNav?.addEventListener('mouseover', e => placeMark(siteNav, e.target.closest('a')));
  siteNav?.addEventListener('mouseleave', placeMarks);
  if (rail) new MutationObserver(placeMarks).observe(rail, { subtree: true, attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', placeMarks);
  document.addEventListener('languagechange', () => setTimeout(placeMarks));
  document.fonts?.ready.then(placeMarks);
  placeMarks();

  // The open menu closes when the page moves or the reader clicks elsewhere.
  const closeMenu = () => { if (menu?.getAttribute('aria-expanded') === 'true') menu.click(); };
  addEventListener('scroll', closeMenu, { passive: true });
  document.addEventListener('click', e => { if (!e.target.closest('.menu-toggle, #site-nav')) closeMenu(); });
  // A phone's address bar fires resize on every scroll; measure once per frame at most.
  let resizeQueued = false;
  addEventListener('resize', () => { if (!resizeQueued) { resizeQueued = true; requestAnimationFrame(() => { resizeQueued = false; sync(); }); } });
  addEventListener('load', sync);
  document.fonts?.ready.then(sync);
  media.addEventListener('change', sync);
  split();
  sync();
})();
