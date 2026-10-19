/**
 * Guia Mão de Obra — app entry point.
 * Wires the tab bar, the hash router and the view lifecycle.
 */
import { route, startRouter, back, currentPath } from './core/router.js';
import { icon } from './ui/icons.js';
import { toast } from './ui/toast.js';
import { haptic } from './core/utils.js';
import { initPWA } from './core/pwa.js';
import { animateIn, swapView, initImageFades } from './ui/motion.js';

import { homeView } from './views/home.js';
import { exploreView, categoryView, groupView } from './views/explore.js';
import { specListView } from './views/list.js';
import { profileView } from './views/profile.js';
import { searchView } from './views/search.js';
import { meView } from './views/me.js';
import { notFoundView } from './views/notfound.js';

initPWA();
initImageFades();

/* ---------- Routes ---------- */
route('/', homeView, { tab: 'home', title: 'Início' });
route('/explore', exploreView, { tab: 'explore', title: 'Explorar' });
route('/c/:catId', categoryView, { section: 'explore' });
route('/c/:catId/:groupId', groupView, { section: 'explore' });
route('/s/:specId', specListView, { section: 'explore' });
route('/p/:id', profileView, {});
route('/search', searchView, { tab: 'search', title: 'Buscar' });
route('/me', meView, { tab: 'me', title: 'Perfil' });
route('/404', notFoundView, {});

/* ---------- Tab bar ---------- */
const TABS = [
  { id: 'home', href: '#/', label: 'Início', icon: 'home' },
  { id: 'explore', href: '#/explore', label: 'Explorar', icon: 'grid' },
  { id: 'search', href: '#/search', label: 'Buscar', icon: 'search' },
  { id: 'me', href: '#/me', label: 'Perfil', icon: 'person' },
];
const tabbar = document.getElementById('tabbar');
tabbar.innerHTML = TABS.map((t) => `
  <a class="tab" href="${t.href}" data-tab="${t.id}">
    ${icon(t.icon, { stroke: 1.7 })}<span>${t.label}</span>
  </a>`).join('');

let lastSection = 'home';
function setActiveTab(id) {
  lastSection = id || lastSection;
  tabbar.querySelectorAll('.tab').forEach((el) => {
    const on = el.dataset.tab === lastSection;
    el.classList.toggle('is-active', on);
    if (on) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
}

// Re-tapping the active tab scrolls to top (iOS behavior).
tabbar.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  haptic();
  if (tab.getAttribute('href') === `#${currentPath()}`) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

/* ---------- View lifecycle ---------- */
const root = document.getElementById('app');
let cleanup = null;
const scrollMemory = new Map();

startRouter(async ({ found, path, transition, isStale }) => {
  scrollMemory.set(root.dataset.path, window.scrollY);
  setActiveTab(found?.meta.tab || found?.meta.section);
  document.title = found?.meta.title ? `${found.meta.title} · Guia Mão de Obra` : 'Guia Mão de Obra';

  const view = document.createElement('div');
  view.className = 'view';
  try {
    if (cleanup) { cleanup(); cleanup = null; }
    const result = await found.view(found.params, { root: view, isStale });
    if (isStale()) return;
    if (typeof result === 'string') view.innerHTML = result;
    else if (typeof result === 'function') cleanup = result;
  } catch (err) {
    console.error(err);
    if (isStale()) return;
    view.innerHTML = `<div class="empty"><h2 class="empty__title">Algo deu errado</h2><p>Verifique sua conexão e tente novamente.</p><button class="btn btn--sm mt-16" onclick="location.reload()">Tentar de novo</button></div>`;
    toast('Não foi possível carregar.', 'error');
  }

  // Push / pop / tab transition (View Transitions API with CSS fallback).
  await swapView(root, view, transition, () => {
    root.dataset.path = path;
    window.scrollTo(0, transition === 'back' ? scrollMemory.get(path) || 0 : 0);
  });
  animateIn(view);
});

/* ---------- Global interactions ---------- */
document.addEventListener('click', (e) => {
  // iOS-style back links use real history when possible.
  const backLink = e.target.closest('[data-back]');
  if (backLink) {
    e.preventDefault();
    haptic();
    back(backLink.getAttribute('href').replace(/^#/, ''));
    return;
  }
  // Inline action buttons nested inside row links (e.g. WhatsApp shortcut).
  const action = e.target.closest('[data-href]');
  if (action) {
    e.preventDefault();
    e.stopPropagation();
    haptic();
    window.open(action.dataset.href, '_blank', 'noopener');
  }
});
