/**
 * Professionals in a niche: /s/:specId
 * Includes a city filter built from the results.
 */
import { getSpec } from '../data/categories.js';
import { listBySpec } from '../services/professionals.js';
import { pageHead, proRow, emptyState, listSkeleton } from '../ui/components.js';
import { esc, normalize } from '../core/utils.js';

export function specListView({ specId }, { root, isStale }) {
  const entry = getSpec(specId);
  if (!entry) {
    root.innerHTML = emptyState({ title: 'Especialidade não encontrada', action: '<a class="btn btn--sm" href="#/explore">Explorar</a>' });
    return;
  }
  const { spec, group, category } = entry;

  root.innerHTML = `
    ${pageHead({
      title: spec.name,
      crumb: `${category.name} › ${group.name}`,
      backLabel: group.name,
      backHref: `#/c/${category.id}/${group.id}`,
    })}
    <div id="filters"></div>
    <div id="results">${listSkeleton(4)}</div>`;

  const results = root.querySelector('#results');
  const filters = root.querySelector('#filters');
  let all = [];
  let city = '';

  function render() {
    const list = city ? all.filter((p) => normalize(p.city) === city) : all;
    results.innerHTML = list.length
      ? `<p class="group__header mt-8">${list.length} ${list.length === 1 ? 'profissional' : 'profissionais'}</p>
         <div class="group"><ul class="list list--avatars">${list.map((p) => proRow(p, specId)).join('')}</ul></div>`
      : emptyState({
          iconName: 'briefcase',
          title: 'Ninguém por aqui ainda',
          text: `Ainda não há profissionais de ${spec.name.toLowerCase()} cadastrados. Conhece alguém? Indique o Guia!`,
          action: '<a class="btn btn--sm btn--secondary" href="signup.html">Sou profissional</a>',
        });
  }

  function renderFilters() {
    const cities = [...new Map(all.map((p) => [normalize(p.city), p.city])).entries()];
    if (cities.length < 2) { filters.innerHTML = ''; return; }
    filters.innerHTML = `
      <div class="chips chips--scroll mt-8" role="tablist" aria-label="Filtrar por cidade">
        <button class="chip ${city ? '' : 'is-selected'}" data-city="">Todas</button>
        ${cities.map(([key, label]) => `<button class="chip ${city === key ? 'is-selected' : ''}" data-city="${esc(key)}">${esc(label)}</button>`).join('')}
      </div>`;
  }

  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-city]');
    if (!btn) return;
    city = btn.dataset.city;
    renderFilters();
    render();
  });

  listBySpec(specId)
    .then((pros) => {
      if (isStale()) return;
      all = pros;
      renderFilters();
      render();
    })
    .catch((err) => {
      console.error(err);
      if (isStale()) return;
      results.innerHTML = emptyState({ iconName: 'alertCircle', title: 'Falha ao carregar', text: 'Verifique sua conexão e tente novamente.', action: '<button class="btn btn--sm" onclick="location.reload()">Tentar de novo</button>' });
    });
}
