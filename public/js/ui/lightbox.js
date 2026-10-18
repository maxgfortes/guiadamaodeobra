/**
 * Full-screen photo viewer with swipe / arrow-key navigation.
 */
import { icon } from './icons.js';

export function openLightbox(urls, start = 0) {
  let i = start;
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Foto do portfólio');
  el.innerHTML = `
    <img alt="">
    <div class="lightbox__bar">
      <span class="lightbox__count"></span>
      <button class="glass-btn" data-close aria-label="Fechar">${icon('close')}</button>
    </div>
    ${urls.length > 1 ? `
      <button class="glass-btn lightbox__nav lightbox__nav--prev" data-step="-1" aria-label="Anterior">${icon('chevronLeft')}</button>
      <button class="glass-btn lightbox__nav lightbox__nav--next" data-step="1" aria-label="Próxima">${icon('chevronRight')}</button>` : ''}`;
  const img = el.querySelector('img');
  const count = el.querySelector('.lightbox__count');

  const show = () => {
    img.src = urls[i];
    count.textContent = urls.length > 1 ? `${i + 1} de ${urls.length}` : '';
  };
  const step = (d) => { i = (i + d + urls.length) % urls.length; show(); };
  const close = () => {
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = '';
    el.remove();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  };

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') || e.target === el) return close();
    const s = e.target.closest('[data-step]');
    if (s) step(Number(s.dataset.step));
  });

  // Swipe left/right to navigate, down to dismiss.
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    else if (dy > 90) close();
    x0 = y0 = null;
  });

  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
  document.body.appendChild(el);
  el.querySelector('[data-close]').focus();
  show();
  return close;
}

