import { emptyState } from '../ui/components.js';

export function notFoundView() {
  return emptyState({
    iconName: 'search',
    title: 'Página não encontrada',
    text: 'O endereço pode estar incorreto ou a página foi removida.',
    action: '<a class="btn btn--sm" href="#/">Ir para o início</a>',
  });
}
