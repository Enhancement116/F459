// Satellite cursor: a small mint dot stays exactly on the pointer (so clicking stays precise), and a wireframe satellite
// follows it with a little lag, leaving a short ephemeris trail. Over links, buttons and cards it locks on: it turns
// toward the target, pulses, and shows [PRN: LOCKED]. Mouse and trackpad only; touch devices and readers who ask for
// reduced motion keep the normal cursor. The follow loop runs only while the satellite is still catching up.
(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  root.classList.add('sat-cursor-on');
  const box = document.createElement('div');
  box.className = 'sat-cursor';
  box.setAttribute('aria-hidden', 'true');
  box.innerHTML = '<i class="sc-dot"></i><span class="sc-sat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">'
    + '<rect x="9" y="9" width="6" height="6"/><path d="M9 12H3m6-2H5m4 4H5m10-2h6m-6-2h4m-4 4h4"/><circle cx="12" cy="7" r="1" fill="currentColor"/></svg><b></b></span>'
    + '<em class="sc-tag">[PRN: LOCKED]</em>';
  document.body.append(box);
  const dot = box.querySelector('.sc-dot'), sat = box.querySelector('.sc-sat'), tag = box.querySelector('.sc-tag');
  const TARGETS = 'a, button, [role="button"], summary, label, .po-card, .pspl, .po-six li, .po-test2 li';
  let mx = -100, my = -100, sx = -100, sy = -100, running = false, lockEl = null, lastTrail = 0, angle = 0;

  function frame() {
    sx += (mx - sx) * 0.18;
    sy += (my - sy) * 0.18;
    // The satellite rides a little up and to the right of the pointer, like a body on its orbit.
    sat.style.transform = `translate3d(${sx + 16}px, ${sy - 18}px, 0) rotate(${angle}deg)`;
    if (Math.abs(mx - sx) + Math.abs(my - sy) > 0.4) requestAnimationFrame(frame); else running = false;
  }
  const kick = () => { if (!running) { running = true; requestAnimationFrame(frame); } };

  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    box.classList.add('is-on');
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    tag.style.transform = `translate3d(${mx + 14}px, ${my + 14}px, 0)`;
    // Ephemeris trail: a few fading points dropped behind the satellite.
    const now = performance.now();
    if (now - lastTrail > 45) {
      lastTrail = now;
      const p = document.createElement('i');
      p.className = 'sc-trail';
      p.style.transform = `translate3d(${sx + 16}px, ${sy - 18}px, 0)`;
      box.append(p);
      setTimeout(() => p.remove(), 520);
    }
    // Lock-on: point the satellite at the centre of whatever can be clicked.
    const el = e.target instanceof Element ? e.target.closest(TARGETS) : null;
    if (el !== lockEl) { lockEl = el; box.classList.toggle('is-locked', !!el); }
    if (el) {
      const r = el.getBoundingClientRect();
      angle = Math.atan2(r.top + r.height / 2 - (sy - 18), r.left + r.width / 2 - (sx + 16)) * 180 / Math.PI + 90;
    } else angle = 0;
    kick();
  }, { passive: true });
  // Leaving the window hides it instead of leaving a satellite parked at the edge.
  document.addEventListener('mouseleave', () => box.classList.remove('is-on'));
  document.addEventListener('mouseenter', () => box.classList.add('is-on'));
  // Every click sends a short burst from the dot.
  addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') return;
    const b = document.createElement('i');
    b.className = 'sc-burst';
    b.style.left = e.clientX + 'px';
    b.style.top = e.clientY + 'px';
    box.append(b);
    setTimeout(() => b.remove(), 600);
  });
})();
