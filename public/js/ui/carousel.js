/**
 * Auto-rotating banner carousel.
 * Native scroll-snap for buttery swipes; a timer advances every 5 s and pauses
 * while the user interacts or the tab is hidden.
 */
import { esc } from '../core/utils.js';

const INTERVAL = 5000;

/** Only web links open from banners (new tab). */
export const isSafeLink = (link) => /^https?:\/\//i.test(String(link || ''));

export function bannerCarousel(container, banners) {
  if (!banners.length) { container.remove(); return () => {}; }

  container.innerHTML = `
    <div class="banner-track" role="region" aria-roledescription="carrossel" aria-label="Destaques">
      ${banners.map((b, i) => {
        const img = `<img class="banner__img" src="${esc(b.imageURL)}" alt="${esc(b.alt || '')}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async" draggable="false">`;
        return isSafeLink(b.link)
          ? `<a class="banner" href="${esc(b.link)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(b.alt || `Destaque ${i + 1}`)} (abre em nova aba)">${img}</a>`
          : `<div class="banner">${img}</div>`;
      }).join('')}
    </div>
    ${banners.length > 1 ? `<div class="banner-dots" aria-hidden="true">${banners.map((_, i) => `<span class="${i ? '' : 'is-active'}"></span>`).join('')}</div>` : ''}`;

  const track = container.querySelector('.banner-track');
  const dots = [...container.querySelectorAll('.banner-dots span')];
  if (banners.length < 2) return () => {};

  let index = 0;
  let timer = null;
  let paused = false;

  const go = (i) => {
    index = (i + banners.length) % banners.length;
    track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
  };
  const schedule = () => {
    clearTimeout(timer);
    if (paused || document.hidden) return;
    // Views are kept alive between tabs: while detached, just poll cheaply.
    if (!container.isConnected) { timer = setTimeout(schedule, 1000); return; }
    timer = setTimeout(() => go(index + 1), INTERVAL);
  };

  // Sync dots with the actual scroll position (covers manual swipes too).
  let raf = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      if (i !== index) index = i;
      dots.forEach((d, k) => d.classList.toggle('is-active', k === index));
      schedule();
    });
  }, { passive: true });

  const pause = () => { paused = true; clearTimeout(timer); };
  const resume = () => { paused = false; schedule(); };
  track.addEventListener('touchstart', pause, { passive: true });
  track.addEventListener('touchend', resume, { passive: true });
  track.addEventListener('mouseenter', pause);
  track.addEventListener('mouseleave', resume);
  const onVisibility = () => schedule();
  document.addEventListener('visibilitychange', onVisibility);

  schedule();
  return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
}
