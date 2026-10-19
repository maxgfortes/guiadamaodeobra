/**
 * Guia Mão de Obra — app entry point.
 * Wires the tab bar, the hash router and the view lifecycle.
 *
 * Screens are kept alive (like UIKit view controllers): every rendered view is
 * cached by path, so switching tabs or going back re-attaches the existing DOM
 * with its scroll position instead of rendering and fetching again. Each tab
 * also remembers the last screen it was on.
 */
import { route, startRouter, back, currentPath, navigate } from './core/router.js';
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
route('/404', notFoundView, { cache: false });

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

const TAB_ROOT = Object.fromEntries(TABS.map((t) => [t.id, t.href.slice(1)]));
const lastPathByTab = {}; // tab id → last path visited inside that tab

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

/*
 * Tab bar (iOS behaviour):
 *   other tab        → back to the screen you left there (no reload)
 *   active tab, deep → pop to the tab's root
 *   active tab, root → scroll to top
 */
tabbar.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  e.preventDefault();
  haptic();
  const id = tab.dataset.tab;
  const rootPath = TAB_ROOT[id];
  if (id === lastSection) {
    if (currentPath() !== rootPath) navigate(rootPath, { transition: 'back' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  navigate(lastPathByTab[id] || rootPath, { transition: 'tab' });
});

/* ---------- View lifecycle (with view cache) ---------- */
const root = document.getElementById('app');
const MAX_CACHED = 16;
/** path → { el, cleanup, scrollY, evicted } — Map order = least recently used first. */
const cache = new Map();

function evictOldest() {
  while (cache.size > MAX_CACHED) {
    const [path, entry] = cache.entries().next().value;
    if (path === root.dataset.path) break;
    cache.delete(path);
    entry.evicted = true;
    entry.cleanup?.();
  }
}

async function renderEntry(found) {
  const entry = { el: document.createElement('div'), cleanup: null, scrollY: 0, evicted: false, ok: true };
  entry.el.className = 'view';
  try {
    // A cached view keeps loading in the background even if the user moves on.
    const result = await found.view(found.params, { root: entry.el, isStale: () => entry.evicted });
    if (typeof result === 'string') entry.el.innerHTML = result;
    else if (typeof result === 'function') entry.cleanup = result;
  } catch (err) {
    console.error(err);
    entry.ok = false; // never cache failures
    entry.el.innerHTML = `<div class="empty"><h2 class="empty__title">Algo deu errado</h2><p>Verifique sua conexão e tente novamente.</p><button class="btn btn--sm mt-16" onclick="location.reload()">Tentar de novo</button></div>`;
    toast('Não foi possível carregar.', 'error');
  }
  return entry;
}

startRouter(async ({ found, path, transition, isStale }) => {
  const leaving = cache.get(root.dataset.path);
  if (leaving) leaving.scrollY = window.scrollY;

  setActiveTab(found?.meta.tab || found?.meta.section);
  lastPathByTab[lastSection] = path;
  document.title = found?.meta.title ? `${found.meta.title} · Guia Mão de Obra` : 'Guia Mão de Obra';

  let entry = found.meta.cache === false ? null : cache.get(path);
  const fresh = !entry;
  if (entry) {
    cache.delete(path); // move to most-recently-used
    cache.set(path, entry);
  } else {
    entry = await renderEntry(found);
    if (entry.ok && found.meta.cache !== false) {
      cache.set(path, entry);
      evictOldest();
    }
  }
  if (isStale()) return; // another navigation happened while rendering

  // Push / pop / tab transition (View Transitions API with CSS fallback).
  await swapView(root, entry.el, transition, () => {
    root.dataset.path = path;
    window.scrollTo(0, fresh ? 0 : entry.scrollY);
  });
  if (fresh) animateIn(entry.el);
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
