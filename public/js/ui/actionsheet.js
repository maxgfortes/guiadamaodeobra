/**
 * iOS action sheet: a list of actions + Cancel, sliding up from the bottom.
 *   const choice = await actionSheet({ title, actions: [{ id, label, destructive? }] })
 * Resolves to the chosen id, or null when cancelled.
 */
import { esc } from '../core/utils.js';

export function actionSheet({ title = '', message = '', actions = [] }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    const el = document.createElement('div');
    el.className = 'action-sheet';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = `
      <div class="action-sheet__group">
        ${title || message ? `<div class="action-sheet__head">${title ? `<strong>${esc(title)}</strong>` : ''}${message ? `<span>${esc(message)}</span>` : ''}</div>` : ''}
        ${actions.map((a) => `<button class="action-sheet__btn ${a.destructive ? 'is-destructive' : ''}" data-id="${esc(a.id)}">${esc(a.label)}</button>`).join('')}
      </div>
      <div class="action-sheet__group"><button class="action-sheet__btn is-cancel" data-id="">Cancelar</button></div>`;

    const done = (value) => {
      el.classList.add('is-leaving');
      backdrop.classList.add('is-leaving');
      setTimeout(() => { el.remove(); backdrop.remove(); }, 220);
      document.removeEventListener('keydown', onKey);
      resolve(value || null);
    };
    const onKey = (e) => { if (e.key === 'Escape') done(null); };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (b) done(b.dataset.id);
    });
    backdrop.addEventListener('click', () => done(null));
    document.addEventListener('keydown', onKey);
    document.body.append(backdrop, el);
    el.querySelector('button')?.focus();
  });
}

/** iOS-style confirm alert built on the action sheet. */
export async function confirmSheet({ title, message, confirmLabel = 'Confirmar', destructive = false }) {
  const r = await actionSheet({ title, message, actions: [{ id: 'ok', label: confirmLabel, destructive }] });
  return r === 'ok';
}
