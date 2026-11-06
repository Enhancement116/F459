// Click any photo or screenshot inside a figure to view it enlarged.
// Arrow keys step through the page's images; Esc, the close button or a click outside closes it.
(() => {
  const images = [...document.querySelectorAll('main .po-viz img')];
  if (!images.length) return;

  const MAX_SCALE = 3; // beyond this the source images turn to mush
  const isEn = () => document.documentElement.lang === 'en';
  const titleOf = img => {
    const own = img.closest('figure').querySelector('.po-viz-bar span');
    return own ? own.textContent.trim() : img.alt;
  };

  const dialog = document.createElement('dialog');
  dialog.className = 'lb';
  dialog.innerHTML = '<button class="lb-btn lb-x" type="button">✕</button>'
    + '<button class="lb-btn lb-prev" type="button">‹</button>'
    + '<figure class="lb-fig"><img class="lb-img" alt=""><figcaption class="lb-cap"></figcaption></figure>'
    + '<button class="lb-btn lb-next" type="button">›</button>';
  document.body.append(dialog);
  const big = dialog.querySelector('.lb-img');
  const cap = dialog.querySelector('.lb-cap');
  const close = dialog.querySelector('.lb-x');
  const prev = dialog.querySelector('.lb-prev');
  const next = dialog.querySelector('.lb-next');
  let current = 0;

  // Fill the screen even when the image is smaller than it, which max-width alone would not do.
  const fit = () => {
    const w = big.naturalWidth, h = big.naturalHeight;
    if (!w || !h) return;
    const scale = Math.min((innerWidth * 0.94) / w, (innerHeight - 110) / h, MAX_SCALE);
    big.style.width = Math.round(w * scale) + 'px';
    big.style.height = Math.round(h * scale) + 'px';
  };

  const show = i => {
    current = (i + images.length) % images.length;
    const img = images[current];
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    cap.textContent = titleOf(img) + '  ·  ' + (current + 1) + ' / ' + images.length;
    fit();
  };

  const label = () => {
    const en = isEn();
    images.forEach(img => img.setAttribute('aria-label', (en ? 'Enlarge: ' : '放大圖片：') + titleOf(img)));
    close.setAttribute('aria-label', en ? 'Close' : '關閉');
    prev.setAttribute('aria-label', en ? 'Previous image' : '上一張');
    next.setAttribute('aria-label', en ? 'Next image' : '下一張');
  };

  const open = i => { show(i); dialog.showModal(); };

  images.forEach((img, i) => {
    img.setAttribute('role', 'button');
    img.tabIndex = 0;
    img.addEventListener('click', () => open(i));
    img.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); }
    });
  });

  big.addEventListener('load', fit);
  addEventListener('resize', () => { if (dialog.open) fit(); });
  prev.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => {
    if (e.target !== big && !e.target.closest('.lb-btn')) dialog.close();
  });
  dialog.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });

  document.addEventListener('languagechange', label);
  label();
})();
