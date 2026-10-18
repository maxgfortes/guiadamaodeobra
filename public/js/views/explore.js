/**
 * Category tree navigation:
 *   /explore            → all base categories
 *   /c/:catId           → groups of a category
 *   /c/:catId/:groupId  → specifications (niches) of a group
 */
import { CATEGORIES, getCategory, getGroup, specCount } from '../data/categories.js';
import { pageHead, navRow, iconTile, emptyState } from '../ui/components.js';
import { icon } from '../ui/icons.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function exploreView() {
  return `
    ${pageHead({ title: 'Explorar', subtitle: 'Escolha uma categoria para ver os profissionais.' })}
    <div class="searchbar">
      <a class="search-field search-field--button" href="#/search">${icon('search')}<span>Buscar serviço</span></a>
    </div>
    <div class="group mt-16">
      <ul class="list list--icons">
        ${CATEGORIES.map((c) => navRow({
          href: `#/c/${c.id}`,
          title: c.name,
          subtitle: c.groups.map((g) => g.name).join(' · '),
          lead: iconTile(c),
        })).join('')}
      </ul>
    </div>`;
}

export function categoryView({ catId }) {
  const cat = getCategory(catId);
  if (!cat) return notFound();
  return `
    ${pageHead({
      title: cat.name,
      subtitle: `${plural(cat.groups.length, 'grupo', 'grupos')} · ${plural(specCount(cat), 'especialidade', 'especialidades')}`,
      backLabel: 'Explorar',
      backHref: '#/explore',
    })}
    <div class="group mt-8">
      <ul class="list list--icons">
        ${cat.groups.map((g) => navRow({
          href: `#/c/${cat.id}/${g.id}`,
          title: g.name,
          subtitle: g.specs.map((s) => s.name).join(', '),
          lead: iconTile(cat),
          detail: String(g.specs.length),
        })).join('')}
      </ul>
    </div>`;
}

export function groupView({ catId, groupId }) {
  const cat = getCategory(catId);
  const group = cat && getGroup(catId, groupId);
  if (!group) return notFound();
  return `
    ${pageHead({ title: group.name, crumb: cat.name, backLabel: cat.short, backHref: `#/c/${cat.id}` })}
    <p class="group__header mt-8">Especialidades</p>
    <div class="group">
      <ul class="list">
        ${group.specs.map((s) => navRow({ href: `#/s/${s.id}`, title: s.name })).join('')}
      </ul>
      <p class="group__footer">Toque em uma especialidade para ver os profissionais disponíveis.</p>
    </div>`;
}

function notFound() {
  return emptyState({
    iconName: 'grid',
    title: 'Categoria não encontrada',
    text: 'Ela pode ter sido renomeada.',
    action: '<a class="btn btn--sm" href="#/explore">Ver categorias</a>',
  });
}
