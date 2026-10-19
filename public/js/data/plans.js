/**
 * Plans shown on the payment screen.
 * DISPLAY ONLY — the charged amount comes from functions/src/plans.js.
 * Keep both files in sync when changing prices.
 */
export const PLANS = [
  { id: 'mensal', name: 'Mensal', months: 1, price: 29.9 },
  { id: 'trimestral', name: 'Trimestral', months: 3, price: 79.9, badge: 'Economize 11%' },
  { id: 'semestral', name: 'Semestral', months: 6, price: 149.9, badge: 'Mais escolhido', featured: true },
  { id: 'anual', name: 'Anual', months: 12, price: 269.9, badge: 'Economize 25%' },
];

export const getPlan = (id) => PLANS.find((p) => p.id === id) || null;

export const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const perMonth = (plan) => brl(plan.price / plan.months);
