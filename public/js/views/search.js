/**
 * Search: niches (instant, from the static tree) + professionals
 * (name, city, neighborhood, niche) with debounced querying.
 */
import { allSpecs, CATEGORIES } from '../data/categories.js';
import { searchProfessionals } from '../services/professionals.js';
import { pageHead, proRow, navRow, iconTile, emptyState } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { esc, normalize, debounce } from '../core/utils.js';
import { currentQuery } from '../core/router.js';

const SUGGESTIONS = ['Eletricista', 'Diarista', 'Encanador', 'Pintor', 'Ar-condicionado', 'Montador de móveis'];

export function searchView(_params, { root, isStale }) {
  const initial = currentQuery().get('q') || '';
  root.innerHTML = `
    ${pageHead({ title: 'Buscar' })}
    <div class="searchbar">
      <label class="search-field">
        ${icon('search')}
        <span class="sr-only">Buscar</span>
        <input id="q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off"
          placeholder="Serviço, nome ou bairro" value="${esc(initial)}">
        <button class="search-field__clear" id="clear" type="button" aria-label="Limpar" ${initial ? '' : 'hidden'}>${icon('closeFill')}</button>
      </label>
    </div>
    <div id="out"></div>`;

  const input = root.querySelector('#q');
  const clear = root.querySelector('#clear');
  const out = root.querySelector('#out');
  let seq = 0;

  function idle() {
    out.innerHTML = `
      <p class="group__header mt-16">Sugestões</p>
      <div class="chips">${SUGGESTIONS.map((s) => `<button class="chip" data-suggest="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <p class="group__header mt-24">Categorias</p>
      <div class="group"><ul class="list list--icons">
        ${CATEGORIES.map((c) => navRow({ href: `#/c/${c.id}`, title: c.name, lead: iconTile(c) })).join('')}
      </ul></div>`;
  }

  async function run(term) {
    const q = normalize(term);
    clear.hidden = !term;
    // Keep the query in the URL (shareable, restores on back) without a new history entry.
    history.replaceState(null, '', term ? `#/search?q=${encodeURIComponent(term)}` : '#/search');
    if (q.length < 2) return idle();

    const mySeq = ++seq;
    const specs = allSpecs().filter(({ spec, group, category }) =>
      normalize(`${spec.name} ${group.name} ${category.name}`).includes(q)).slice(0, 8);

    const specHTML = specs.length ? `
      <p class="group__header mt-16">Especialidades</p>
      <div class="group"><ul class="list list--icons">
        ${specs.map(({ spec, category, group }) => navRow({
          href: `#/s/${spec.id}`, title: spec.name, subtitle: `${category.short} › ${group.name}`, lead: iconTile(category),
        })).join('')}
      </ul></div>` : '';

    out.innerHTML = `${specHTML}<p class="group__header mt-16">Profissionais</p><div class="center-spinner"><div class="spinner"></div></div>`;

    try {
      const pros = await searchProfessionals(term);
      if (mySeq !== seq || isStale()) return;
      const prosHTML = pros.length
        ? `<p class="group__header mt-16">Profissionais</p><div class="group"><ul class="list list--avatars">${pros.slice(0, 30).map((p) => proRow(p)).join('')}</ul></div>`
        : '';
      out.innerHTML = specHTML || prosHTML
        ? specHTML + prosHTML
        : emptyState({ title: 'Nenhum resultado', text: `Não encontramos nada para “${term}”. Tente outro termo ou explore as categorias.` });
    } catch (err) {
      console.error(err);
      if (mySeq === seq) out.innerHTML = specHTML + emptyState({ iconName: 'alertCircle', title: 'Falha na busca', text: 'Verifique sua conexão.' });
    }
  }

  const debounced = debounce(() => run(input.value.trim()), 220);
  input.addEventListener('input', debounced);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
  clear.addEventListener('click', () => { input.value = ''; run(''); input.focus(); });
  out.addEventListener('click', (e) => {
    const s = e.target.closest('[data-suggest]');
    if (s) { input.value = s.dataset.suggest; run(input.value); }
  });

  run(initial);
  // Focus on tab entry for quick typing (desktop; avoids jumping keyboard on back nav).
  if (!initial && matchMedia('(hover: hover)').matches) input.focus();
}
