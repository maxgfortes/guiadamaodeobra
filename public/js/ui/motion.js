/**
 * Motion helpers — iOS-like transitions, kept cheap (transform/opacity only).
 *
 *   swapView     Replace the routed view with a push / pop / tab transition.
 *                Uses the View Transitions API when available (old and new
 *                screens animate together, like UINavigationController);
 *                falls back to a CSS slide-in.
 *   animateIn    Staggered rise-in for list rows, tiles, cards and chips.
 *   initImageFades  Images fade in once decoded instead of popping.
 */
export async function swapView(root, view, transition, afterSwap) {
  const swap = () => {
    root.replaceChildren(view);
    afterSwap?.();
  };
  const first = !root.querySelector('.view');
  if (first) { swap(); return; }

  if (document.startViewTransition) {
    document.documentElement.dataset.nav = transition; // forward | back | tab
    try {
      const vt = document.startViewTransition(swap);
      await vt.updateCallbackDone;
      vt.finished.finally(() => { delete document.documentElement.dataset.nav; });
    } catch {
      swap();
    }
    return;
  }
  view.classList.add(`is-${transition}`); // CSS keyframe fallback
  swap();
}

const STAGGER_SELECTORS = [
  '.list > li', '.cat-cell', '.carousel > .card', '.chips > .chip',
  '.gallery__item', '.plan', '.stat', '.contact-btn',
];

export function animateIn(scope) {
  const groups = new Map();
  scope.querySelectorAll(STAGGER_SELECTORS.join(',')).forEach((el) => {
    const parent = el.parentElement;
    const i = groups.get(parent) ?? 0;
    groups.set(parent, i + 1);
    if (i > 14) return; // only the first screenful animates
    el.style.setProperty('--i', i);
    el.classList.add('rise');
    el.addEventListener('animationend', () => el.classList.remove('rise'), { once: true });
  });
}

export function initImageFades() {
  const mark = (img) => img.classList.add('is-loaded');
  // `load` doesn't bubble, but it can be captured at the document.
  document.addEventListener('load', (e) => { if (e.target.tagName === 'IMG') mark(e.target); }, true);
  document.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') mark(e.target); }, true);
  // Images already complete when inserted from cache.
  new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        (n.tagName === 'IMG' ? [n] : n.querySelectorAll('img')).forEach((img) => { if (img.complete) mark(img); });
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
}
