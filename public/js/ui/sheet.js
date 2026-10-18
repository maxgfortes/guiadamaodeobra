/**
 * iOS modal sheet (slides up from the bottom).
 * Returns { el, body, close } — callers fill `body` and wire actions.
 */
import { esc } from '../core/utils.js';

export function openSheet({ title, leftLabel = 'Cancelar', rightLabel = 'OK', onLeft, onRight }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const el = document.createElement('div');
  el.className = 'sheet';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', title);
  el.innerHTML = `
    <div class="sheet__grabber" aria-hidden="true"></div>
    <div class="sheet__head">
      <button class="text-btn" data-left>${esc(leftLabel)}</button>
      <div class="sheet__title">${esc(title)}</div>
      <button class="text-btn text-btn--bold" data-right>${esc(rightLabel)}</button>
    </div>
    <div class="sheet__body"></div>`;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    el.classList.add('is-leaving');
    backdrop.classList.add('is-leaving');
    setTimeout(() => { el.remove(); backdrop.remove(); document.body.style.overflow = ''; }, 240);
  };
  const onKey = (e) => { if (e.key === 'Escape') { onLeft?.(); close(); } };

  el.querySelector('[data-left]').addEventListener('click', () => { onLeft?.(); close(); });
  el.querySelector('[data-right]').addEventListener('click', () => { if (onRight?.() !== false) close(); });
  backdrop.addEventListener('click', () => { onLeft?.(); close(); });
  document.addEventListener('keydown', onKey);

  document.body.style.overflow = 'hidden';
  document.body.append(backdrop, el);
  return { el, body: el.querySelector('.sheet__body'), close };
}
