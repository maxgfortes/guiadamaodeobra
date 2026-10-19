/**
 * Subscription plans — the SERVER is the source of truth for prices.
 * The frontend mirrors these for display (public/js/data/plans.js), but the
 * amount charged always comes from here, never from the client.
 */
export const PLANS = {
  mensal: { id: 'mensal', name: 'Mensal', months: 1, price: 29.9 },
  trimestral: { id: 'trimestral', name: 'Trimestral', months: 3, price: 79.9 },
  semestral: { id: 'semestral', name: 'Semestral', months: 6, price: 149.9 },
  anual: { id: 'anual', name: 'Anual', months: 12, price: 269.9 },
};

export const getPlan = (id) => PLANS[id] || null;

/** Add calendar months, clamping to month end (Jan 31 + 1 month → Feb 28/29). */
export function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export const formatBRL = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
