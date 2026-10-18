/**
 * Home: hero + search shortcut, category grid, popular niches,
 * newest professionals and a call-to-action for professionals.
 */
import { CATEGORIES, POPULAR_SPECS, getSpec } from '../data/categories.js';
import { listRecent } from '../services/professionals.js';
import { iconTile, proMini, demoNote } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { esc } from '../core/utils.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function homeView(_params, { root, isStale }) {
  root.innerHTML = `
    <header class="page-head">
      <div class="breadcrumb">${esc(greeting())} 👋</div>
      <h1 class="large-title">Do que você precisa hoje?</h1>
    </header>

    <div class="searchbar">
      <a class="search-field search-field--button" href="#/search">
        ${icon('search')}<span>Eletricista, diarista, pintor…</span>
      </a>
    </div>
    ${demoNote()}

    <h2 class="section-title">Categorias <a href="#/explore">Ver todas</a></h2>
    <div class="cat-grid">
      ${CATEGORIES.map((c) => `
        <a class="cat-cell" href="#/c/${c.id}">
          ${iconTile(c, 'icon-tile--lg')}
          <span>${esc(c.short)}</span>
        </a>`).join('')}
    </div>

    <h2 class="section-title">Mais procurados</h2>
    <div class="chips chips--scroll">
      ${POPULAR_SPECS.map((id) => getSpec(id)).filter(Boolean).map(({ spec, category }) => `
        <a class="chip" href="#/s/${spec.id}"><span class="chip__dot" style="--tile:${category.color}"></span>${esc(spec.name)}</a>`).join('')}
    </div>

    <h2 class="section-title">Novos no Guia</h2>
    <div class="carousel" id="recent">
      ${'<div class="card pro-mini"><div class="avatar avatar--md skeleton"></div><div class="skeleton sk-line" style="width:80%"></div><div class="skeleton sk-line sk-line--w60"></div></div>'.repeat(3)}
    </div>

    <section class="promo">
      <svg class="promo__art" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z"/>'}</svg>
      <h3>Você é profissional?</h3>
      <p>Crie seu perfil grátis, mostre seus trabalhos e receba clientes direto no WhatsApp.</p>
      <a class="btn" href="signup.html">Cadastrar meu serviço</a>
    </section>

    <p class="footer-note">© ${new Date().getFullYear()} Guia Mão de Obra</p>
  `;

  listRecent(12)
    .then((pros) => {
      if (isStale()) return;
      const el = root.querySelector('#recent');
      el.innerHTML = pros.length
        ? pros.map(proMini).join('')
        : '<p class="muted pad">Seja o primeiro profissional a se cadastrar!</p>';
    })
    .catch((err) => {
      console.error(err);
      const el = root.querySelector('#recent');
      if (el) el.innerHTML = '<p class="muted pad">Não foi possível carregar agora.</p>';
    });
}
