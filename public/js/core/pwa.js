/**
 * PWA helpers: service worker registration with an "update available"
 * prompt, plus install support (Android prompt / iOS instructions).
 */
import { toast } from '../ui/toast.js';

let deferredPrompt = null;
const listeners = new Set();

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** True when the app can be installed (Android/desktop Chrome prompt available, or iOS Safari). */
export function canInstall() {
  if (isStandalone()) return false;
  return Boolean(deferredPrompt) || isIOS();
}

export function onInstallAvailability(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Show the native prompt; on iOS returns 'ios' so callers can show instructions. */
export async function promptInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    listeners.forEach((cb) => cb());
    return outcome;
  }
  return isIOS() ? 'ios' : 'unavailable';
}

let started = false;
export function initPWA() {
  if (started) return;
  started = true;

  if (isStandalone()) document.documentElement.classList.add('is-standalone');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((cb) => cb());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    toast('App instalado!', 'success');
    listeners.forEach((cb) => cb());
  });

  if (!('serviceWorker' in navigator)) return;
  // Skip on localhost during development (avoids stale caches); ?sw forces it.
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (local && !new URLSearchParams(location.search).has('sw')) return;

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const offerUpdate = (worker) => {
        toast('Nova versão disponível — toque para atualizar', 'info', 8000, () => worker.postMessage('skip-waiting'));
      };
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
        });
      });
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        location.reload();
      });
    } catch (err) {
      console.warn('Service worker registration failed', err);
    }
  });
}
