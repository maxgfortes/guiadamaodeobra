/**
 * Auto-rotating banner carousel.
 * Native scroll-snap for buttery swipes; a timer advances every 5 s and pauses
 * while the user interacts or the tab is hidden.
 */
import { esc } from '../core/utils.js';

const INTERVAL = 5000;

function isSafeLink(link) {
  return /^(#\/|signup\.html|https:\/\/)/.test(String(link || ''));
}

export function bannerCarousel(container, banners) {
  if (!banners.length) { container.remove(); return () => {}; }

  container.innerHTML = `
    <div class="banner-track" role="region" aria-roledescription="carrossel" aria-label="Destaques">
      ${banners.map((b, i) => {
        const href = isSafeLink(b.link) ? b.link : '';
        const ext = href.startsWith('https://');
        const tag = href ? 'a' : 'div';
        return `
          <${tag} class="banner" ${href ? `href="${esc(href)}" ${ext ? 'target="_blank" rel="noopener"' : ''}` : ''}
             style="--banner:${esc(b.color || '#007aff')}" aria-label="${i + 1} de ${banners.length}: ${esc(b.title)}">
            ${b.imageURL ? `<img class="banner__img" src="${esc(b.imageURL)}" alt="" ${i ? 'loading="lazy"' : ''} decoding="async">` : '<span class="banner__glow" aria-hidden="true"></span>'}
            <span class="banner__body">
              ${b.title ? `<strong class="banner__title">${esc(b.title)}</strong>` : ''}
              ${b.subtitle ? `<span class="banner__subtitle">${esc(b.subtitle)}</span>` : ''}
              ${b.cta && href ? `<span class="banner__cta">${esc(b.cta)}</span>` : ''}
            </span>
          </${tag}>`;
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
    if (!paused && !document.hidden) timer = setTimeout(() => go(index + 1), INTERVAL);
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
