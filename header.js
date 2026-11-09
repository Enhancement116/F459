// Shared header behaviour for pages without scroll stages (the staged pages get the same from scroll-scenes.js):
// clear at the top and a capsule once the page moves, the space it takes as --sys-top, one mark gliding
// between the site links (and the chapter rail where there is one), and the menu closing when the page moves.
(() => {
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const header = $('header');
  if (!header) return;
  const measure = () => root.style.setProperty('--sys-top', `${Math.ceil(header.getBoundingClientRect().height) + 10}px`);
  const markScrolled = () => root.classList.toggle('sys-scrolled', scrollY > 8);
  const siteNav = $('#site-nav');
  const rail = $('.pcn-bar ol');
  const menu = $('.menu-toggle');
  const placeMark = (box, el) => {
    if (!box || !el) return;
    box.style.setProperty('--gx', `${el.offsetLeft}px`);
    box.style.setProperty('--gw', `${el.offsetWidth}px`);
  };
  const placeMarks = () => {
    if (siteNav) placeMark(siteNav, $('a[aria-current=page]', siteNav) || $('a', siteNav));
    if (rail) placeMark(rail, $('a.is-current', rail)?.parentElement);
  };
  siteNav?.addEventListener('mouseover', e => placeMark(siteNav, e.target.closest('a')));
  siteNav?.addEventListener('mouseleave', placeMarks);
  if (rail) new MutationObserver(placeMarks).observe(rail, { subtree: true, attributes: true, attributeFilter: ['class'] });
  const closeMenu = () => { if (menu?.getAttribute('aria-expanded') === 'true') menu.click(); };
  addEventListener('scroll', () => { markScrolled(); closeMenu(); }, { passive: true });
  document.addEventListener('click', e => { if (!e.target.closest('.menu-toggle, #site-nav')) closeMenu(); });
  addEventListener('resize', () => { measure(); placeMarks(); });
  document.addEventListener('languagechange', () => setTimeout(placeMarks));
  document.fonts?.ready.then(() => { measure(); placeMarks(); });
  measure(); markScrolled(); placeMarks();
})();
