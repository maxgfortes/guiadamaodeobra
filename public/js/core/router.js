/**
 * Minimal hash router.
 *
 * Routes are declared as patterns ("/s/:specId") mapped to async view
 * functions `(params, ctx) => HTMLElement | string`. Hash routing keeps the
 * app deployable as static files with deep links working everywhere.
 *
 * The router also decides the transition direction (push vs. pop) so views
 * slide in like a UINavigationController.
 */
const routes = [];
let onChange = () => {};
let renderToken = 0;
const historyStack = [];
let forcedTransition = null;

export function route(pattern, view, meta = {}) {
  const keys = [];
  const rx = new RegExp(
    '^' + pattern.replace(/\/:([^/]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$'
  );
  routes.push({ pattern, rx, keys, view, meta });
}

export function currentPath() {
  return (location.hash.replace(/^#/, '') || '/').split('?')[0];
}

export function currentQuery() {
  const q = location.hash.split('?')[1] || '';
  return new URLSearchParams(q);
}

/**
 * @param {string} path
 * @param {{ replace?: boolean, transition?: 'tab' | 'back' | 'forward' }} [opts]
 *   `transition: 'tab'` is used by the tab bar to jump to a tab's last screen.
 */
export function navigate(path, { replace = false, transition = null } = {}) {
  const target = `#${path}`;
  forcedTransition = transition;
  if (replace) {
    history.replaceState(null, '', target);
    if (historyStack.length) historyStack.pop();
    resolve();
  } else if (location.hash === target) {
    resolve();
  } else {
    location.hash = target;
  }
}

export function back(fallback = '/') {
  if (historyStack.length > 1) history.back();
  else navigate(fallback, { replace: true, transition: 'back' });
}

function match(path) {
  for (const r of routes) {
    const m = path.match(r.rx);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { ...r, params };
    }
  }
  return null;
}

async function resolve() {
  const path = currentPath();
  const found = match(path) || match('/404');
  const token = ++renderToken;

  const forced = forcedTransition;
  forcedTransition = null;

  // Direction: going back if the path is the previous entry in our stack.
  let direction = 'forward';
  if (forced === 'tab') {
    historyStack.length = 0; // switching tabs starts a fresh stack
    historyStack.push(path);
  } else if (historyStack.length > 1 && historyStack[historyStack.length - 2] === path) {
    historyStack.pop();
    direction = 'back';
  } else if (historyStack[historyStack.length - 1] !== path) {
    if (found?.meta.tab) historyStack.length = 0; // tabs reset the stack
    historyStack.push(path);
  }
  const transition = forced || (found?.meta.tab ? 'tab' : direction);

  await onChange({ found, path, transition, isStale: () => token !== renderToken });
}

export function startRouter(handler) {
  onChange = handler;
  window.addEventListener('hashchange', resolve);
  resolve();
}
