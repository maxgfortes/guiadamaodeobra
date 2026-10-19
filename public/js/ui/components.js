/**
 * Reusable HTML fragments. All dynamic values pass through esc().
 */
import { esc, avatarHTML, whatsappLink } from '../core/utils.js';
import { icon, chevron } from './icons.js';
import { primarySpecialty } from '../services/professionals.js';

/** Page header with optional back link, large title and subtitle. */
export function pageHead({ title, subtitle = '', backLabel = '', backHref = '', crumb = '' }) {
  return `
    <header class="page-head">
      ${backLabel ? `<a class="back-link" href="${esc(backHref)}" data-back>${icon('chevronLeft', { stroke: 2.6 })}<span>${esc(backLabel)}</span></a>` : ''}
      ${crumb ? `<div class="breadcrumb">${esc(crumb)}</div>` : ''}
      <h1 class="large-title">${esc(title)}</h1>
      ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ''}
    </header>`;
}

/** Colored rounded-square icon (Settings.app style). */
export function iconTile(cat, size = '') {
  return `<span class="icon-tile ${size}" style="--tile:${esc(cat.color)}">${icon(cat.icon)}</span>`;
}

/** A table row with an icon tile and chevron, used for categories/groups. */
export function navRow({ href, title, subtitle = '', lead = '', detail = '' }) {
  return `
    <li><a class="row" href="${esc(href)}">
      ${lead}
      <div class="row__body">
        <div class="row__title">${esc(title)}</div>
        ${subtitle ? `<div class="row__subtitle">${esc(subtitle)}</div>` : ''}
      </div>
      ${detail ? `<span class="row__detail">${esc(detail)}</span>` : ''}
      ${chevron}
    </a></li>`;
}

/** Professional row for niche lists and search results. */
export function proRow(pro, specId) {
  const wa = whatsappLink(pro.whatsapp, `Olá, ${pro.name.split(' ')[0]}! Vi seu perfil no Guia Mão de Obra.`);
  return `
    <li class="pro-li">
      <a class="row pro-row" href="#/p/${esc(pro.id)}">
        ${avatarHTML(pro)}
        <div class="row__body">
          <div class="row__title">${esc(pro.name)}</div>
          <div class="row__subtitle">${esc(primarySpecialty(pro, specId))}${pro.specs.length > 1 ? ` · +${pro.specs.length - 1}` : ''}</div>
          <div class="meta">${icon('pin')}<span>${esc(pro.neighborhood)}, ${esc(pro.city)}</span></div>
        </div>
        <div class="pro-row__actions">
          ${wa ? `<span class="round-btn round-btn--whatsapp" role="button" aria-label="WhatsApp de ${esc(pro.name)}" data-href="${esc(wa)}">${icon('whatsapp')}</span>` : ''}
          ${chevron}
        </div>
      </a>
    </li>`;
}

/** Compact vertical card for horizontal carousels. */
export function proMini(pro) {
  return `
    <a class="card pro-mini" href="#/p/${esc(pro.id)}">
      ${avatarHTML(pro, 'avatar--md')}
      <div class="pro-mini__name">${esc(pro.name)}</div>
      <div class="pro-mini__spec">${esc(primarySpecialty(pro))}</div>
      <div class="pro-mini__loc">${esc(pro.neighborhood)} · ${esc(pro.city)}</div>
    </a>`;
}

export function emptyState({ iconName = 'search', title, text = '', action = '' }) {
  return `
    <div class="empty">
      <div class="empty__icon">${icon(iconName, { stroke: 1.4 })}</div>
      <h2 class="empty__title">${esc(title)}</h2>
      ${text ? `<p>${esc(text)}</p>` : ''}
      ${action}
    </div>`;
}

export function listSkeleton(rows = 5) {
  const row = `
    <div class="row pro-row">
      <div class="avatar skeleton" style="--size:48px"></div>
      <div class="row__body">
        <div class="skeleton sk-line sk-line--w60"></div>
        <div class="skeleton sk-line sk-line--w40"></div>
      </div>
    </div>`;
  return `<div class="group"><div class="list">${row.repeat(rows)}</div></div>`;
}
