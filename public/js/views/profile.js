/**
 * Professional public profile: /p/:id
 * Banner, avatar, name, specialty, location, contact buttons,
 * bio, niches and portfolio gallery.
 */
import { getProfessional, primarySpecialty } from '../services/professionals.js';
import { getSpec } from '../data/categories.js';
import { emptyState } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { openLightbox } from '../ui/lightbox.js';
import { back } from '../core/router.js';
import { currentUser } from '../services/auth.js';
import {
  esc, avatarHTML, whatsappLink, telLink, mailLink, formatPhoneBR, haptic,
} from '../core/utils.js';

export async function profileView({ id }, { root, isStale }) {
  root.innerHTML = '<div class="center-spinner" style="padding-top:120px"><div class="spinner"></div></div>';

  const pro = await getProfessional(id);
  if (isStale()) return;
  // Hidden profiles are only visible to their owner (rules enforce the same).
  const isOwner = pro && !pro.published && (await currentUser())?.uid === pro.id;
  if (isStale()) return;
  if (!pro || (!pro.published && !isOwner)) {
    root.innerHTML = emptyState({
      iconName: 'person',
      title: 'Perfil indisponível',
      text: 'Este profissional não está mais listado ou o link está incorreto.',
      action: '<a class="btn btn--sm" href="#/explore">Explorar profissionais</a>',
    });
    return;
  }

  const primary = getSpec(pro.specs?.[0]);
  const tint = primary?.category.color || '#007aff';
  const firstName = pro.name.split(' ')[0];
  const wa = whatsappLink(pro.whatsapp, `Olá, ${firstName}! Encontrei seu perfil no Guia Mão de Obra e gostaria de um orçamento.`);
  const tel = telLink(pro.phone || pro.whatsapp);
  const mail = mailLink(pro.email, 'Orçamento — Guia Mão de Obra');
  const portfolio = Array.isArray(pro.portfolio) ? pro.portfolio : [];

  root.innerHTML = `
    <article class="profile" style="--tile:${esc(tint)}">
      <figure class="profile__banner">
        ${pro.bannerURL
          ? `<img src="${esc(pro.bannerURL)}" alt="" decoding="async">`
          : `<svg class="profile__banner-pattern" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="currentColor" stroke-width=".3">${Array.from({ length: 8 }, (_, i) => `<circle cx="20" cy="4" r="${2 + i * 2.2}"/>`).join('')}</g></svg>`}
        <div class="profile__toolbar">
          <button class="glass-btn" data-action="back" aria-label="Voltar">${icon('chevronLeft', { stroke: 2.6 })}</button>
          <button class="glass-btn" data-action="share" aria-label="Compartilhar">${icon('share')}</button>
        </div>
      </figure>

      <header class="profile__head">
        ${avatarHTML(pro, 'avatar--xl')}
        <h1 class="profile__name">${esc(pro.name)}</h1>
        <div class="profile__spec">${esc(primarySpecialty(pro))}</div>
        <div class="profile__loc">${icon('pin')}${esc(pro.neighborhood)}, ${esc(pro.city)}</div>
      </header>

      <div class="contact-bar">
        <a class="contact-btn contact-btn--whatsapp ${wa ? '' : 'is-disabled'}" href="${esc(wa) || '#'}" target="_blank" rel="noopener" data-contact="whatsapp">
          ${icon('whatsapp')}WhatsApp
        </a>
        <a class="contact-btn ${tel ? '' : 'is-disabled'}" href="${esc(tel) || '#'}" data-contact="phone">${icon('phone')}Ligar</a>
        <a class="contact-btn ${mail ? '' : 'is-disabled'}" href="${esc(mail) || '#'}" data-contact="email">${icon('mail')}E-mail</a>
      </div>

      ${pro.bio ? `
        <h2 class="section-title">Sobre</h2>
        <div class="group"><div class="list">
          <p class="bio ${pro.bio.length > 240 ? 'is-clamped' : ''}" id="bio">${esc(pro.bio)}</p>
          ${pro.bio.length > 240 ? '<button class="row row--action" id="bio-more">Ler mais</button>' : ''}
        </div></div>` : ''}

      <h2 class="section-title">Portfólio ${portfolio.length ? `<span class="muted" style="font-size:15px;font-weight:400">${portfolio.length} fotos</span>` : ''}</h2>
      ${galleryHTML(pro, portfolio, tint)}

      <h2 class="section-title">Serviços</h2>
      <div class="chips">
        ${(pro.specs || []).map(getSpec).filter(Boolean).map(({ spec, category }) => `
          <a class="chip" href="#/s/${esc(spec.id)}"><span class="chip__dot" style="--tile:${esc(category.color)}"></span>${esc(spec.name)}</a>`).join('')}
      </div>

      <h2 class="section-title">Contato</h2>
      <div class="group">
        <ul class="list list--icons">
          ${pro.whatsapp ? infoRow('whatsapp', '#25d366', 'WhatsApp', formatPhoneBR(pro.whatsapp), wa, true) : ''}
          ${pro.phone && pro.phone !== pro.whatsapp ? infoRow('phone', '#34c759', 'Telefone', formatPhoneBR(pro.phone), tel) : ''}
          ${pro.email ? infoRow('mail', '#007aff', 'E-mail', pro.email, mail) : ''}
          ${infoRow('pin', '#ff3b30', 'Atende em', `${pro.neighborhood}, ${pro.city}`, `https://www.google.com/maps/search/${encodeURIComponent(`${pro.neighborhood}, ${pro.city}`)}`, true)}
        </ul>
        <p class="group__footer">Combine valores e detalhes diretamente com o profissional.</p>
      </div>
    </article>`;

  root.addEventListener('click', async (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'back') { haptic(); back('/explore'); return; }
    if (action === 'share') { haptic(); share(pro); return; }

    const contact = e.target.closest('[data-contact]');
    if (contact) haptic();

    if (e.target.closest('#bio-more')) {
      root.querySelector('#bio').classList.remove('is-clamped');
      e.target.closest('#bio-more').remove();
    }
    const item = e.target.closest('[data-photo]');
    if (item && portfolio.length) openLightbox(portfolio, Number(item.dataset.photo));
  });
}

function infoRow(iconName, color, label, value, href, external = false) {
  return `
    <li><a class="row" href="${esc(href)}" ${external ? 'target="_blank" rel="noopener"' : ''}>
      <span class="icon-tile" style="--tile:${color}">${icon(iconName)}</span>
      <div class="row__body">
        <div class="row__subtitle" style="margin:0">${esc(label)}</div>
        <div class="row__title">${esc(value)}</div>
      </div>
    </a></li>`;
}

function galleryHTML(pro, portfolio, tint) {
  if (portfolio.length) {
    return `<div class="gallery">${portfolio.map((url, i) => `
      <button class="gallery__item" data-photo="${i}" aria-label="Abrir foto ${i + 1}">
        <img src="${esc(url)}" alt="" loading="lazy" decoding="async">
      </button>`).join('')}</div>`;
  }
  // Demo profiles: tinted placeholders so the layout reads as intended.
  if (pro.demo && pro.portfolioCount) {
    const shades = [0, 12, 24, 6, 18, 30];
    return `<div class="gallery">${Array.from({ length: pro.portfolioCount }, (_, i) => `
      <div class="gallery__item"><div class="gallery__ph" style="background:color-mix(in srgb, ${esc(tint)} ${70 - shades[i % 6]}%, #1c1c1e)">${icon('image', { stroke: 1.5 })}</div></div>`).join('')}</div>`;
  }
  return '<p class="muted pad" style="font-size:15px">Nenhuma foto publicada ainda.</p>';
}

async function share(pro) {
  const url = `${location.origin}${location.pathname}#/p/${pro.id}`;
  const data = { title: pro.name, text: `${pro.name} — ${primarySpecialty(pro)} no Guia Mão de Obra`, url };
  try {
    if (navigator.share) await navigator.share(data);
    else {
      await navigator.clipboard.writeText(url);
      toast('Link copiado', 'success');
    }
  } catch (err) {
    if (err?.name !== 'AbortError') toast('Não foi possível compartilhar', 'error');
  }
}
