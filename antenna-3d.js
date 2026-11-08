// Interactive 3D view of the antenna and its radiation pattern on the System page. Drawn on a plain 2D
// canvas, so it needs no library. Both shapes are rebuilt from the HFSS figures shown beside them: they
// are for looking around, and the numbers remain those of the simulation.
(() => {
  const cv = document.getElementById('sys-ant-cv');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const root = document.documentElement;
  const box = cv.parentElement;
  const scene = cv.closest('.sys-scene');
  const calm = matchMedia('(prefers-reduced-motion:reduce)').matches;

  const VIEWS = { iso: [-0.9, 0.62], top: [0, 1.5], side: [-1.5, 0.02] };
  const view = { yaw: VIEWS.iso[0], pitch: VIEWS.iso[1], zoom: 1 };
  const goal = { ...view };
  let spin = !calm;      // a slow turn until the first touch
  let lobe = 0;          // 0 shows the antenna alone, 1 the full pattern
  let lobeGoal = 0;
  let shown = false;
  let frame = 0;
  let W = 0;
  let H = 0;

  // ---- Antenna, in mm: x across the board, y along it towards the main beam, z up.
  const SCALE = 1 / 165;
  const LENGTH = 320;
  const mm = (x, y, z = 0) => [x * SCALE, (y - LENGTH / 2) * SCALE, z * SCALE];
  const halfWidth = y => (y < 100 ? 92 : 92 - (y - 100) / (LENGTH - 100) * 56);
  const outline = [];
  for (let y = 0; y <= LENGTH; y += 20) outline.push([halfWidth(y), y]);
  for (let y = LENGTH; y >= 0; y -= 20) outline.push([-halfWidth(y), y]);
  const face = (points, z) => points.map(([x, y]) => mm(x, y, z));

  // The ground plane is the board's back, with an elliptical edge facing the beam.
  const groundEdge = x => 100 - 78 * Math.sqrt(Math.max(0, 1 - (x / 92) ** 2));
  const ground = [[-92, 0], [92, 0]];
  for (let x = 92; x >= -92; x -= 8) ground.push([x, groundEdge(x)]);

  const rect = (x0, x1, y0, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const YELLOW = [232, 226, 16];
  const OLIVE = [132, 128, 22];
  const top = [{ points: face(ground, 2), rgb: YELLOW }, { points: face(rect(-5, 5, 12, 62), 2), rgb: YELLOW }];
  const bottom = [];
  for (let i = 0; i < 8; i++) {
    const y = 62 + i * 34;
    const arm = 44 - i * 2;
    top.push({ points: face(rect(-arm, 0, y, y + 8), 2), rgb: YELLOW });
    bottom.push({ points: face(rect(0, arm, y, y + 8), -2), rgb: OLIVE });
  }
  const board = { points: face(outline, 0), rgb: [205, 214, 206], alpha: 0.86 };

  // ---- Radiation pattern, matched to the HFSS plot: as there, the radius is the gain in dB measured from
  // -10 dB, and the colour is the plot's own legend. The peak is the simulated 10.02 dB; the shape around
  // it is fitted to the figure. Main lobe along +y, two side lobes above and below, leaning slightly forward.
  const PEAK_DB = 10.02;
  const FLOOR_DB = -10;
  const unit = (x, y, z) => { const n = Math.hypot(x, y, z); return [x / n, y / n, z / n]; };
  const SIDES = [unit(0, -0.3, 0.95), unit(0, -0.3, -0.95)];
  const toward = (d, c) => Math.max(0, d[0] * c[0] + d[1] * c[1] + d[2] * c[2]);
  const gain = d => Math.max(0.02, toward(d, [0, 1, 0]) ** 0.9, ...SIDES.map(c => 0.52 * toward(d, c) ** 3.2));
  const dbOf = r => FLOOR_DB + r * (PEAK_DB - FLOOR_DB);
  const LEGEND = [[-8.75, [0, 0, 255]], [-6.25, [0, 128, 255]], [-3.75, [0, 255, 255]], [-1.25, [0, 255, 128]], [1.25, [0, 255, 0]],
    [3.75, [140, 255, 0]], [6.25, [255, 255, 0]], [8.75, [255, 140, 0]], [11.25, [255, 0, 0]]];
  const legendColour = db => {
    const i = Math.max(0, LEGEND.findIndex(s => s[0] >= db) - 1);
    const [a, ca] = LEGEND[Math.min(i, LEGEND.length - 2)];
    const [b, cb] = LEGEND[Math.min(i + 1, LEGEND.length - 1)];
    const t = Math.min(1, Math.max(0, (db - a) / (b - a)));
    return ca.map((c, n) => c + (cb[n] - c) * t);
  };
  const ROWS = 64;
  const COLS = 112;
  const dirs = [];
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c <= COLS; c++) {
      const theta = r / ROWS * Math.PI;
      const phi = c / COLS * Math.PI * 2;
      const d = [Math.cos(theta), Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi)];
      dirs.push({ d, v: gain(d) });
    }
  }
  const at = (r, c) => r * (COLS + 1) + c;
  const quads = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ids = [at(r, c), at(r, c + 1), at(r + 1, c + 1), at(r + 1, c)];
      const mean = ids.reduce((sum, i) => sum + dirs[i].v, 0) / 4;
      // Soft fixed light so the lobes read as solid shapes.
      const [p0, p1, p2, p3] = ids.map(i => dirs[i].d.map(n => n * dirs[i].v));
      const a = p2.map((n, i) => n - p0[i]);
      const b = p3.map((n, i) => n - p1[i]);
      const normal = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const len = Math.hypot(...normal) || 1;
      const lit = Math.abs(normal[0] * 0.3 + normal[1] * -0.25 + normal[2] * 0.92) / len;
      // The colour follows the HFSS plot, where the high-gain colours cover more of the main lobe than a
      // straight dB radius would give; the curve is fitted to the figure.
      quads.push({ ids, rgb: legendColour(dbOf(mean ** 0.6)), lit: 0.78 + 0.22 * lit });
    }
  }

  // Where things sit for the current lobe size: with the pattern out, the board shrinks to its place at the
  // origin (its feed end) and the view centres on the pattern rather than on the board.
  const FEED = LENGTH / 2 * SCALE;
  let boardScale = 1;
  let boardShift = 0;
  let centre = 0;
  const place = ([x, y, z]) => [x * boardScale, (y + FEED) * boardScale + boardShift, z * boardScale];
  const project = ([x, y0, z], scale) => {
    const y = y0 - centre;
    const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw);
    const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
    const rx = x * cy - y * sy;
    const ry = x * sy + y * cy;
    const up = z * cp - ry * sp;      // towards the top of the screen
    const depth = ry * cp + z * sp;   // away from the viewer
    const k = scale * 4.2 / (4.2 + depth);
    return [W / 2 + rx * k, H / 2 - up * k, depth];
  };
  const fill = (pts, rgb, alpha = 1, shade = 1) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    const col = `rgba(${rgb[0] * shade | 0},${rgb[1] * shade | 0},${rgb[2] * shade | 0},${alpha})`;
    ctx.fillStyle = col;
    ctx.fill();
    return col;
  };

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    const scale = Math.min(W, H) * 0.36 * view.zoom * (1.32 - 0.32 * lobe);
    boardScale = 1 - 0.5 * lobe;
    boardShift = -FEED * (1 - lobe);
    centre = 0.3 * lobe;
    const fromAbove = Math.sin(view.pitch) > 0;
    const plates = () => {
      const layers = fromAbove ? [bottom, [board], top] : [top, [board], bottom];
      layers.forEach(layer => layer.forEach(part => {
        const pts = part.points.map(p => project(place(p), scale));
        fill(pts, part.rgb, part.alpha || 1);
        if (part === board) { ctx.strokeStyle = '#3c4a44'; ctx.lineWidth = 1; ctx.stroke(); }
      }));
    };
    if (lobe < 0.01) { plates(); return; }

    const size = 1.2 * lobe;
    const points = dirs.map(({ d, v }) => {
      const r = v * size;
      return project([d[0] * r, d[1] * r, d[2] * r], scale);
    });
    const faces = quads.map(q => {
      const pts = q.ids.map(i => points[i]);
      const ax = pts[2][0] - pts[0][0], ay = pts[2][1] - pts[0][1];
      const bx = pts[3][0] - pts[1][0], by = pts[3][1] - pts[1][1];
      const area = Math.abs(ax * by - ay * bx) / 2;
      return { pts, rgb: q.rgb, lit: q.lit, depth: (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4, area };
    }).sort((a, b) => b.depth - a.depth);
    const paint = list => list.forEach(f => {
      if (f.area < 0.3) return;
      const col = fill(f.pts, f.rgb, 0.95 * Math.min(1, lobe * 1.6), f.lit);
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    });
    paint(faces.filter(f => f.depth >= 0));
    plates();
    paint(faces.filter(f => f.depth < 0));

    if (lobe > 0.9) {
      const tip = project([0, 1.0 * size, 0], scale);
      const en = root.lang === 'en';
      ctx.font = `700 ${Math.max(13, Math.min(W, H) * 0.03)}px 'Noto Sans TC',sans-serif`;
      ctx.textAlign = tip[0] > W * 0.62 ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText(en ? 'Peak 10.02 dBi' : '最大 10.02 dBi', Math.min(W - 8, Math.max(8, tip[0])), Math.max(16, Math.min(H - 16, tip[1])));
      ctx.shadowBlur = 0;
    }
  };

  const resize = () => {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width;
    H = r.height;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wake();
  };

  // Easing is measured in time, not frames, so a slow or throttled screen still arrives on schedule.
  let last = 0;
  const tick = now => {
    frame = 0;
    if (!shown) return;
    const steps = Math.min(30, last ? (now - last) / 16.7 : 1);
    last = now;
    const ease = rate => 1 - (1 - rate) ** steps;
    let moving = false;
    if (spin) { goal.yaw += 0.004 * steps; moving = true; }
    ['yaw', 'pitch', 'zoom'].forEach(key => {
      const gap = goal[key] - view[key];
      if (Math.abs(gap) > 0.0005) { view[key] += gap * ease(0.14); moving = true; } else view[key] = goal[key];
    });
    const gap = lobeGoal - lobe;
    if (Math.abs(gap) > 0.003) { lobe += calm ? gap : gap * ease(0.09); moving = true; } else lobe = lobeGoal;
    if (!moving) last = 0;
    draw();
    if (moving) wake();
  };
  function wake() { if (!frame) frame = requestAnimationFrame(tick); }

  // Drag turns the model. On touch screens the browser keeps vertical swipes for the page, so a
  // finger turns it sideways and the view buttons give the other angles.
  let drag = null;
  cv.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY };
    spin = false;
    cv.setPointerCapture(e.pointerId);
    box.classList.add('is-used');
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    goal.yaw += (e.clientX - drag.x) * 0.009;
    goal.pitch = Math.max(-1.57, Math.min(1.57, goal.pitch + (e.clientY - drag.y) * 0.009));
    view.yaw = goal.yaw;
    view.pitch = goal.pitch;
    drag = { x: e.clientX, y: e.clientY };
    wake();
  });
  const endDrag = () => { drag = null; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  const setZoom = factor => { goal.zoom = Math.max(0.6, Math.min(2.4, goal.zoom * factor)); spin = false; wake(); };
  cv.addEventListener('keydown', e => {
    const moves = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, 0.15], ArrowDown: [0, -0.15] };
    if (moves[e.key]) {
      spin = false;
      goal.yaw += moves[e.key][0];
      goal.pitch = Math.max(-1.57, Math.min(1.57, goal.pitch + moves[e.key][1]));
    } else if (e.key === '+' || e.key === '=') setZoom(1.2);
    else if (e.key === '-') setZoom(1 / 1.2);
    else return;
    e.preventDefault();
    wake();
  });
  box.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.zoom) { setZoom(+btn.dataset.zoom); return; }
    const [yaw, pitch] = VIEWS[btn.dataset.view];
    spin = false;
    // Turn the short way round to the chosen view.
    goal.yaw = yaw + Math.round((goal.yaw - yaw) / (Math.PI * 2)) * Math.PI * 2;
    goal.pitch = pitch;
    goal.zoom = 1;
    wake();
  });

  // The scene's step decides whether the pattern is out.
  const follow = () => {
    lobeGoal = !scene || scene.dataset.step === '1' || !root.classList.contains('sys-motion') ? 1 : 0;
    // The pattern opens at the same angle as the HFSS plot: beam to the right, seen slightly from above.
    if (lobeGoal && spin) {
      spin = false;
      goal.yaw = -1.7 + Math.round((goal.yaw + 1.7) / (Math.PI * 2)) * Math.PI * 2;
      goal.pitch = 0.26;
    }
    wake();
  };
  if (scene) new MutationObserver(follow).observe(scene, { attributes: true, attributeFilter: ['data-step'] });
  new MutationObserver(follow).observe(root, { attributes: true, attributeFilter: ['class'] });
  new IntersectionObserver(([e]) => { shown = e.isIntersecting; if (shown) { resize(); wake(); } }).observe(cv);
  new ResizeObserver(resize).observe(cv);
  document.addEventListener('languagechange', wake);
  follow();
})();
