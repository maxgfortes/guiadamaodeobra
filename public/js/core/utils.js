/**
 * Small, dependency-free helpers shared across views.
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape any user-provided value before interpolating it into HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

/** Lowercase + strip accents, for search/compare ("Elétrica" → "eletrica"). */
export function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Keep digits only. */
export const digits = (v) => String(v ?? '').replace(/\D/g, '');

/**
 * Brazilian phone → international digits for wa.me / tel:.
 * Accepts "(11) 98765-4321", "11987654321", "+55 11 98765-4321".
 */
export function toE164BR(phone) {
  const d = digits(phone);
  if (!d) return '';
  if (d.length >= 12 && d.startsWith('55')) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

/** Pretty-print a BR phone: 11987654321 → (11) 98765-4321 */
export function formatPhoneBR(phone) {
  let d = digits(phone);
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone || '';
}

/** Input mask while typing a BR phone number. */
export function maskPhoneBR(value) {
  const d = digits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function whatsappLink(phone, message = '') {
  const n = toE164BR(phone);
  if (!n) return '';
  const q = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${n}${q}`;
}

export function telLink(phone) {
  const n = toE164BR(phone);
  return n ? `tel:+${n}` : '';
}

export function mailLink(email, subject = '') {
  if (!email) return '';
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return `mailto:${encodeURIComponent(email).replace('%40', '@')}${q}`;
}

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());

/** "Ana Paula Souza" → "AS" */
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Deterministic pastel-ish gradient for initials avatars. */
export function avatarGradient(seed) {
  const palette = [
    ['#5ac8fa', '#007aff'], ['#ffcc00', '#ff9500'], ['#ff6482', '#ff2d55'],
    ['#4cd964', '#28a745'], ['#a78bfa', '#5856d6'], ['#ff9f7a', '#ff3b30'],
    ['#64d2ff', '#30b0c7'], ['#d4a373', '#a2845e'],
  ];
  let h = 0;
  for (const ch of String(seed || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [a, b] = palette[h % palette.length];
  return `linear-gradient(180deg, ${a}, ${b})`;
}

/** Render an avatar (photo or initials). */
export function avatarHTML(pro, cls = '') {
  const style = `style="background:${avatarGradient(pro?.name)}"`;
  if (pro?.photoURL) {
    return `<div class="avatar ${cls}" ${style}><img src="${esc(pro.photoURL)}" alt="" loading="lazy" decoding="async"></div>`;
  }
  if (!String(pro?.name || '').trim()) {
    // Generic person silhouette when there is no name yet (signup form).
    return `<div class="avatar ${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" width="62%" height="62%" fill="currentColor"><circle cx="12" cy="8.5" r="4.2"/><path d="M4 20.5c.9-4 4.1-6.3 8-6.3s7.1 2.3 8 6.3z"/></svg></div>`;
  }
  return `<div class="avatar ${cls}" ${style} aria-hidden="true">${esc(initials(pro?.name))}</div>`;
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Light haptic feedback where supported (Android); no-op elsewhere. */
export function haptic(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* ignore */ }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
