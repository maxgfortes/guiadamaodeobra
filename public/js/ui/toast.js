/**
 * iOS-style floating HUD toasts.
 * toast('Salvo!', 'success') | toast('Erro ao enviar', 'error')
 */
import { icon } from './icons.js';
import { esc } from '../core/utils.js';

const ICONS = { success: 'checkCircle', error: 'alertCircle', info: 'info' };

function host() {
  let el = document.querySelector('.toast-host');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast-host';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

export function toast(message, type = 'info', duration = 2600) {
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `${icon(ICONS[type] || 'info')}<span>${esc(message)}</span>`;
  host().appendChild(el);
  const remove = () => {
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };
  setTimeout(remove, duration);
  el.addEventListener('click', remove);
}
