/**
 * Plan selection + card payment (signup.html#plano).
 *
 *   1. Choose a plan (1, 3, 6 or 12 months).
 *   2. Card form (Mercado Pago Card Payment Brick).
 *   3. Result: approved → profile goes live; in_process → wait for the
 *      webhook (live Firestore listener); rejected → reason + retry.
 */
import { PLANS, getPlan, brl, perMonth } from '../data/plans.js';
import { mountCardBrick, payPlan, isPaymentsConfigured } from '../services/payments.js';
import { getFirebase } from '../services/firebase.js';
import { invalidateCache } from '../services/professionals.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { esc, haptic } from '../core/utils.js';

const fmtDate = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

function subscriptionSummary(profile) {
  const sub = profile?.subscription;
  const exp = sub?.expiresAt?.toDate?.();
  if (profile?.active && exp) return { tone: 'success', text: `Plano ativo até ${fmtDate(exp)}. Renovar soma o tempo ao plano atual.` };
  if (sub?.status === 'expired') return { tone: 'warning', text: 'Seu plano expirou. Renove para voltar a aparecer nas buscas.' };
  if (sub?.status === 'revoked' || sub?.status === 'refunded') return { tone: 'warning', text: 'Seu perfil foi desativado. Escolha um plano para reativar.' };
  return { tone: 'info', text: 'Último passo: escolha um plano para publicar seu perfil.' };
}

/**
 * @param {HTMLElement} root
 * @param {{ user, profile, onEdit: () => void }} ctx
 */
export function renderPlans(root, ctx) {
  let selected = 'semestral';
  let brick = null;
  let unwatch = null;
  const summary = subscriptionSummary(ctx.profile);

  const cleanup = () => {
    brick?.unmount();
    brick = null;
    unwatch?.();
    unwatch = null;
  };

  function stepPlans() {
    cleanup();
    history.replaceState(null, '', '#plano');
    root.innerHTML = `
      <section class="view">
        <header class="page-head">
          <h1 class="large-title">Escolha seu plano</h1>
          <p class="subtitle">Seu perfil fica visível para clientes durante todo o período. Sem renovação automática.</p>
        </header>
        <div class="notice notice--${summary.tone}">${icon(summary.tone === 'success' ? 'checkCircle' : 'info')}<span>${esc(summary.text)}</span></div>

        <div class="plans" role="radiogroup" aria-label="Planos">
          ${PLANS.map((p) => `
            <button type="button" class="plan ${p.id === selected ? 'is-selected' : ''} ${p.featured ? 'plan--featured' : ''}" role="radio" aria-checked="${p.id === selected}" data-plan="${p.id}">
              ${p.badge ? `<span class="plan__badge">${esc(p.badge)}</span>` : ''}
              <span class="plan__radio" aria-hidden="true">${icon('check', { stroke: 3 })}</span>
              <span class="plan__name">${esc(p.name)}</span>
              <span class="plan__price">${brl(p.price)}</span>
              <span class="plan__meta">${p.months === 1 ? '1 mês' : `${p.months} meses`} · ${perMonth(p)}/mês</span>
            </button>`).join('')}
        </div>

        <div class="group mt-24">
          <ul class="list list--icons">
            ${[
              ['eye', '#007aff', 'Perfil visível nas buscas'],
              ['whatsapp', '#25d366', 'Contatos ilimitados pelo WhatsApp'],
              ['image', '#ff9500', 'Portfólio com até 12 fotos'],
            ].map(([ic, c, t]) => `<li><div class="row"><span class="icon-tile" style="--tile:${c}">${icon(ic)}</span><div class="row__body"><div class="row__title">${t}</div></div></div></li>`).join('')}
          </ul>
          <p class="group__footer">Pagamento seguro processado pelo Mercado Pago. Seus dados de cartão não passam pelos nossos servidores.</p>
        </div>

        <div class="group center"><button type="button" class="text-btn" data-edit>Editar meu perfil</button></div>

        <div class="savebar"><div class="savebar__inner">
          <button type="button" class="btn btn--block" id="continue">Continuar · <span id="sel-price"></span></button>
        </div></div>
      </section>`;

    const price = root.querySelector('#sel-price');
    const update = () => { price.textContent = brl(getPlan(selected).price); };
    update();

    root.querySelector('.plans').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-plan]');
      if (!btn) return;
      haptic();
      selected = btn.dataset.plan;
      root.querySelectorAll('.plan').forEach((el) => {
        const on = el.dataset.plan === selected;
        el.classList.toggle('is-selected', on);
        el.setAttribute('aria-checked', on);
      });
      update();
    });
    root.querySelector('[data-edit]').addEventListener('click', () => { cleanup(); ctx.onEdit(); });
    root.querySelector('#continue').addEventListener('click', () => {
      if (!isPaymentsConfigured) {
        toast('Pagamentos ainda não configurados (chave pública do Mercado Pago).', 'error', 4000);
        return;
      }
      haptic();
      stepCard();
    });
  }

  async function stepCard() {
    const plan = getPlan(selected);
    root.innerHTML = `
      <section class="view">
        <header class="page-head">
          <button type="button" class="back-link" data-back-plans>${icon('chevronLeft', { stroke: 2.6 })}<span>Planos</span></button>
          <h1 class="large-title">Pagamento</h1>
        </header>
        <div class="group">
          <ul class="list">
            <li><div class="row"><div class="row__body"><div class="row__title">Plano ${esc(plan.name)}</div><div class="row__subtitle">${plan.months === 1 ? '1 mês' : `${plan.months} meses`} de perfil visível</div></div><span class="row__detail" style="color:var(--label);font-weight:600">${brl(plan.price)}</span></div></li>
          </ul>
        </div>
        <div class="brick-wrap">
          <div id="card-brick"></div>
          <div class="center-spinner" id="brick-loading"><div class="spinner"></div></div>
        </div>
        <p class="secure-note">${icon('checkCircle')} Pagamento protegido pelo Mercado Pago</p>
      </section>`;

    root.querySelector('[data-back-plans]').addEventListener('click', stepPlans);

    try {
      brick = await mountCardBrick('card-brick', {
        amount: plan.price,
        email: ctx.profile?.email || ctx.user.email || '',
        onReady: () => root.querySelector('#brick-loading')?.remove(),
        onError: (err) => console.warn('Brick error', err),
        onSubmit: (formData) => submit(plan, formData),
      });
    } catch (err) {
      console.error(err);
      root.querySelector('#brick-loading')?.remove();
      root.querySelector('#card-brick').innerHTML = '<div class="empty"><p>Não foi possível carregar o formulário de pagamento. Verifique sua conexão.</p><button class="btn btn--sm mt-16" data-retry>Tentar de novo</button></div>';
      root.querySelector('[data-retry]').addEventListener('click', stepCard);
    }
  }

  async function submit(plan, formData) {
    try {
      const res = await payPlan(plan.id, formData);
      invalidateCache();
      if (res.status === 'approved') {
        haptic(20);
        stepResult('approved', res);
      } else if (res.status === 'in_process' || res.status === 'pending') {
        stepResult('pending', res);
      } else {
        haptic(40);
        toast(res.message || 'Pagamento recusado.', 'error', 5000);
        showInlineError(res.message);
        // Rejecting keeps the Brick on screen so the user can fix data and retry.
        throw new Error(res.message);
      }
    } catch (err) {
      if (!err.code) throw err; // rejection from our own branch above
      console.error(err);
      const msg = err.message || 'Falha ao processar o pagamento.';
      toast(msg, 'error', 5000);
      showInlineError(msg);
      throw err;
    }
  }

  function showInlineError(message) {
    let el = root.querySelector('.pay-error');
    if (!el) {
      el = document.createElement('div');
      el.className = 'notice notice--error pay-error';
      root.querySelector('.brick-wrap')?.before(el);
    }
    el.innerHTML = `${icon('alertCircle')}<span>${esc(message || 'Pagamento recusado.')}</span>`;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function stepResult(kind, res) {
    cleanup();
    const uid = ctx.user.uid;
    const approved = kind === 'approved';
    const exp = res.expiresAt ? fmtDate(new Date(res.expiresAt)) : '';
    root.innerHTML = `
      <section class="view result">
        <div class="result__icon result__icon--${approved ? 'success' : 'pending'}">${approved ? icon('check', { stroke: 3 }) : '<div class="spinner"></div>'}</div>
        <h1 class="large-title center">${approved ? 'Perfil no ar!' : 'Pagamento em análise'}</h1>
        <p class="subtitle center" id="result-text">${approved
          ? `Pagamento aprovado. Seu perfil está visível${exp ? ` até ${esc(exp)}` : ''}. Enviamos o comprovante por e-mail.`
          : 'O Mercado Pago está analisando o pagamento. Isso costuma levar poucos minutos — esta tela atualiza sozinha e você também receberá um e-mail.'}</p>
        <div class="pad mt-24">
          <a class="btn btn--block" href="index.html#/p/${esc(uid)}">Ver meu perfil</a>
          <a class="btn btn--block btn--secondary mt-8" href="index.html">Ir para o início</a>
        </div>
      </section>`;
    if (approved) return;

    // Wait for the webhook to flip `active` (live listener on own profile).
    const fb = await getFirebase();
    unwatch = fb.fs.onSnapshot(fb.fs.doc(fb.db, 'professionals', uid), (snap) => {
      if (snap.get('active') === true) {
        const expAt = snap.get('subscription.expiresAt')?.toDate();
        stepResult('approved', { expiresAt: expAt?.toISOString() });
        toast('Pagamento aprovado!', 'success');
      }
    });
  }

  stepPlans();
  return cleanup;
}
