/**
 * Admin console (admin.html).
 *
 * Access: Google sign-in + custom claim `admin`. The first admin is granted
 * by the `adminBootstrap` function to e-mails listed in ADMIN_EMAILS.
 *
 * Tabs
 *   Visão geral    counts + revenue (Firestore aggregation queries)
 *   Profissionais  search/filter; grant days, revoke, delete user (callables)
 *   Pagamentos     latest Mercado Pago payments
 *   Banners        home carousel CRUD (Firestore + Storage, admin-only rules)
 *   Admins         grant/revoke admin to another account
 */
import { getFirebase, callFunction, isFirebaseConfigured } from './services/firebase.js';
import { signInWithGoogle, signOut, currentUser, authErrorMessage } from './services/auth.js';
import { compressImage, uploadImage, deleteByUrl, validateImageFile, IMAGE_PRESETS } from './services/images.js';
import { primarySpecialty } from './services/professionals.js';
import { getPlan, brl } from './data/plans.js';
import { icon, chevron } from './ui/icons.js';
import { toast } from './ui/toast.js';
import { openSheet } from './ui/sheet.js';
import { actionSheet, confirmSheet } from './ui/actionsheet.js';
import { animateIn } from './ui/motion.js';
import { esc, normalize, avatarHTML, formatPhoneBR, debounce, haptic } from './core/utils.js';

const root = document.getElementById('admin');
const logoutBtn = document.getElementById('logout');
const TABS = [
  ['overview', 'Visão geral'],
  ['pros', 'Profissionais'],
  ['payments', 'Pagamentos'],
  ['banners', 'Banners'],
  ['admins', 'Admins'],
];
let fb = null;
let tab = sessionStorage.getItem('admin:tab') || 'overview';

const fmtDate = (ts) => (ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null)
  ?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) || '—';
const fmtDateTime = (ts) => (ts?.toDate?.() || null)
  ?.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) || '—';

/* ==========================================================================
   Access gate
   ========================================================================== */
boot();

async function boot() {
  if (!isFirebaseConfigured) {
    root.innerHTML = gateHTML('Firebase não configurado', 'Configure js/firebase-config.js para usar o console.');
    return;
  }
  fb = await getFirebase();
  const user = await currentUser();
  if (!user) return renderLogin();
  await checkAdmin(user);
}

function gateHTML(title, text, action = '') {
  return `<section class="auth-hero"><div class="auth-hero__art">${icon('briefcase', { stroke: 1.6 })}</div><h1>${esc(title)}</h1><p>${esc(text)}</p>${action}</section>`;
}

function renderLogin() {
  logoutBtn.hidden = true;
  root.innerHTML = gateHTML('Console de administração', 'Entre com uma conta Google autorizada.',
    `<button class="btn btn--block btn--google" id="google">${icon('google')}<span>Entrar com Google</span></button>`);
  root.querySelector('#google').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const user = await signInWithGoogle();
      if (user) await checkAdmin(user);
    } catch (err) {
      toast(authErrorMessage(err), 'error');
      btn.disabled = false;
    }
  });
}

async function checkAdmin(user) {
  root.innerHTML = '<div class="center-spinner" style="padding-top:120px"><div class="spinner"></div></div>';
  let claims = (await user.getIdTokenResult()).claims;
  if (claims.admin !== true) {
    try {
      await callFunction('adminBootstrap', {});
      claims = (await user.getIdTokenResult(true)).claims; // refresh to pick up the claim
    } catch { /* not in ADMIN_EMAILS */ }
  }
  logoutBtn.hidden = false;
  logoutBtn.onclick = async () => { await signOut(); renderLogin(); };
  if (claims.admin !== true) {
    root.innerHTML = gateHTML('Acesso negado', `${user.email} não é administrador.`,
      '<a class="btn btn--block btn--secondary" href="index.html">Voltar ao site</a>');
    return;
  }
  renderShell();
}

/* ==========================================================================
   Shell + tabs
   ========================================================================== */
function renderShell() {
  root.innerHTML = `
    <div class="admin-wrap">
      <nav class="segmented" role="tablist">
        ${TABS.map(([id, label]) => `<button role="tab" class="segmented__item ${id === tab ? 'is-active' : ''}" data-tab="${id}" aria-selected="${id === tab}">${label}</button>`).join('')}
      </nav>
      <div id="tab-body"></div>
    </div>`;
  root.querySelector('.segmented').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b || b.dataset.tab === tab) return;
    haptic();
    tab = b.dataset.tab;
    sessionStorage.setItem('admin:tab', tab);
    root.querySelectorAll('.segmented__item').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.tab === tab);
      el.setAttribute('aria-selected', el.dataset.tab === tab);
    });
    showTab();
  });
  showTab();
}

function showTab() {
  const body = root.querySelector('#tab-body');
  body.innerHTML = '<div class="center-spinner"><div class="spinner"></div></div>';
  body.classList.remove('fade-swap');
  void body.offsetWidth; // restart the fade animation
  body.classList.add('fade-swap');
  const views = { overview, pros, payments, banners, admins };
  views[tab](body).catch((err) => {
    console.error(err);
    body.innerHTML = `<div class="empty"><h2 class="empty__title">Erro ao carregar</h2><p>${esc(err.message)}</p></div>`;
  });
}

/* ==========================================================================
   Overview
   ========================================================================== */
async function overview(body) {
  const { db, fs } = fb;
  const pros = fs.collection(db, 'professionals');
  const pays = fs.collection(db, 'payments');
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [total, active, month, all] = await Promise.all([
    fs.getCountFromServer(pros),
    fs.getCountFromServer(fs.query(pros, fs.where('active', '==', true))),
    fs.getAggregateFromServer(
      fs.query(pays, fs.where('status', '==', 'approved'), fs.where('approvedAt', '>=', fs.Timestamp.fromDate(monthStart))),
      { sum: fs.sum('amount'), count: fs.count() }),
    fs.getAggregateFromServer(fs.query(pays, fs.where('status', '==', 'approved')), { sum: fs.sum('amount'), count: fs.count() }),
  ]);
  const t = total.data().count;
  const a = active.data().count;

  body.innerHTML = `
    <div class="stats">
      ${stat('Profissionais', t, '#007aff', 'person')}
      ${stat('Ativos (pagos)', a, '#34c759', 'check')}
      ${stat('Sem plano ativo', t - a, '#ff9500', 'close')}
      ${stat('Receita do mês', brl(month.data().sum || 0), '#5856d6', 'sparkles', `${month.data().count} pagamentos`)}
      ${stat('Receita total', brl(all.data().sum || 0), '#af52de', 'briefcase', `${all.data().count} pagamentos`)}
    </div>
    <p class="group__footer mt-16">Expirações e lembretes rodam automaticamente a cada hora (função <code>expireSubscriptions</code>).</p>`;
  animateIn(body);
}

function stat(label, value, color, ic, sub = '') {
  return `<div class="stat card"><span class="icon-tile" style="--tile:${color}">${icon(ic)}</span>
    <div class="stat__value">${esc(value)}</div><div class="stat__label">${esc(label)}</div>${sub ? `<div class="stat__sub">${esc(sub)}</div>` : ''}</div>`;
}

/* ==========================================================================
   Professionals
   ========================================================================== */
function proStatus(p) {
  const exp = p.subscription?.expiresAt;
  if (p.active) return { cls: 'success', label: `Ativo até ${fmtDate(exp)}` };
  const s = p.subscription?.status;
  if (s === 'expired') return { cls: 'warning', label: 'Expirado' };
  if (s === 'revoked') return { cls: 'neutral', label: 'Desativado' };
  if (s === 'refunded') return { cls: 'neutral', label: 'Estornado' };
  return { cls: 'danger', label: 'Pagamento pendente' };
}

async function pros(body) {
  const { db, fs } = fb;
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'professionals'), fs.orderBy('updatedAt', 'desc'), fs.limit(500)));
  let all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  let filter = 'all';
  let term = '';

  body.innerHTML = `
    <div class="searchbar" style="padding:0">
      <label class="search-field">${icon('search')}<input type="search" id="q" placeholder="Nome, e-mail, cidade ou telefone" autocomplete="off"></label>
    </div>
    <div class="chips chips--scroll mt-8" style="padding:0" id="filters">
      ${[['all', 'Todos'], ['active', 'Ativos'], ['pending', 'Pendentes'], ['expired', 'Expirados']].map(([id, l]) => `<button class="chip ${id === 'all' ? 'is-selected' : ''}" data-f="${id}">${l}</button>`).join('')}
    </div>
    <p class="group__header mt-16" id="count" style="margin-left:0"></p>
    <div class="list list--avatars" id="list"></div>`;

  const list = body.querySelector('#list');
  const render = () => {
    if (!list.isConnected) return; // tab switched while an action was running
    const q = normalize(term);
    const rows = all.filter((p) => {
      if (filter === 'active' && !p.active) return false;
      if (filter === 'pending' && (p.active || p.subscription?.status === 'expired')) return false;
      if (filter === 'expired' && p.subscription?.status !== 'expired') return false;
      return !q || normalize(`${p.name} ${p.email} ${p.city} ${p.neighborhood} ${p.whatsapp}`).includes(q);
    });
    body.querySelector('#count').textContent = `${rows.length} de ${all.length}`;
    list.innerHTML = rows.length ? rows.map((p) => {
      const st = proStatus(p);
      return `<button class="row pro-row" data-id="${esc(p.id)}">
        ${avatarHTML(p)}
        <div class="row__body">
          <div class="row__title">${esc(p.name)}</div>
          <div class="row__subtitle">${esc(primarySpecialty(p))} · ${esc(p.city)} · ${esc(p.email)}</div>
          <span class="pill pill--${st.cls}">${esc(st.label)}</span>
        </div>${chevron}
      </button>`;
    }).join('') : '<div class="empty"><p>Nenhum profissional encontrado.</p></div>';
  };

  body.querySelector('#q').addEventListener('input', debounce((e) => { term = e.target.value; render(); }, 150));
  body.querySelector('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    filter = b.dataset.f;
    body.querySelectorAll('#filters .chip').forEach((c) => c.classList.toggle('is-selected', c === b));
    render();
  });
  list.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const p = all.find((x) => x.id === row.dataset.id);
    const changed = await proActions(p);
    if (changed === 'deleted') all = all.filter((x) => x.id !== p.id);
    else if (changed) Object.assign(p, changed);
    render();
  });
  render();
  animateIn(body);
}

/** Action sheet for one professional. Returns patch, 'deleted' or null. */
async function proActions(p) {
  const choice = await actionSheet({
    title: p.name,
    message: `${p.email} · ${formatPhoneBR(p.whatsapp)}`,
    actions: [
      { id: 'view', label: 'Ver perfil público' },
      { id: 'grant30', label: 'Liberar +30 dias' },
      { id: 'grant365', label: 'Liberar +1 ano' },
      ...(p.active ? [{ id: 'revoke', label: 'Desativar perfil', destructive: true }] : []),
      { id: 'delete', label: 'Excluir usuário', destructive: true },
    ],
  });
  if (!choice) return null;
  if (choice === 'view') { window.open(`index.html#/p/${p.id}`, '_blank'); return null; }

  try {
    if (choice.startsWith('grant')) {
      const days = choice === 'grant30' ? 30 : 365;
      const res = await callFunction('adminSetActive', { uid: p.id, active: true, days });
      toast(`Perfil liberado até ${fmtDate(res.expiresAt)}`, 'success');
      return { active: true, subscription: { ...(p.subscription || {}), status: 'active', expiresAt: new Date(res.expiresAt) } };
    }
    if (choice === 'revoke') {
      if (!(await confirmSheet({ title: 'Desativar perfil?', message: 'Ele sai das buscas imediatamente.', confirmLabel: 'Desativar', destructive: true }))) return null;
      await callFunction('adminSetActive', { uid: p.id, active: false });
      toast('Perfil desativado', 'success');
      return { active: false, subscription: { ...(p.subscription || {}), status: 'revoked' } };
    }
    if (choice === 'delete') {
      if (!(await confirmSheet({ title: `Excluir ${p.name}?`, message: 'Remove conta, perfil e fotos. Não pode ser desfeito.', confirmLabel: 'Excluir definitivamente', destructive: true }))) return null;
      await callFunction('adminDeleteUser', { uid: p.id });
      toast('Usuário excluído', 'success');
      return 'deleted';
    }
  } catch (err) {
    console.error(err);
    toast(err.message || 'Operação falhou', 'error', 4000);
  }
  return null;
}

/* ==========================================================================
   Payments
   ========================================================================== */
const PAY_STATUS = {
  approved: ['success', 'Aprovado'],
  in_process: ['warning', 'Em análise'],
  pending: ['warning', 'Pendente'],
  rejected: ['danger', 'Recusado'],
  cancelled: ['neutral', 'Cancelado'],
  refunded: ['neutral', 'Estornado'],
  charged_back: ['danger', 'Chargeback'],
};

async function payments(body) {
  const { db, fs } = fb;
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'payments'), fs.orderBy('createdAt', 'desc'), fs.limit(100)));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  body.innerHTML = rows.length ? `
    <p class="group__header" style="margin-left:0">Últimos ${rows.length} pagamentos</p>
    <ul class="list">${rows.map((p) => {
      const [cls, label] = PAY_STATUS[p.status] || ['neutral', p.status];
      return `<li><div class="row">
        <div class="row__body">
          <div class="row__title">${esc(p.name || p.payerEmail || p.uid)}</div>
          <div class="row__subtitle">${esc(getPlan(p.planId)?.name || p.planId)} · ${p.installments > 1 ? `${p.installments}x · ` : ''}${esc(fmtDateTime(p.createdAt))} · nº ${esc(p.id)}</div>
          <span class="pill pill--${cls}">${esc(label)}</span>
        </div>
        <span class="row__detail" style="color:var(--label);font-weight:600">${brl(p.amount || 0)}</span>
      </div></li>`;
    }).join('')}</ul>`
    : '<div class="empty"><h2 class="empty__title">Nenhum pagamento ainda</h2><p>Os pagamentos aparecem aqui assim que forem processados pelo Mercado Pago.</p></div>';
  animateIn(body);
}

/* ==========================================================================
   Banners
   ========================================================================== */
async function banners(body) {
  const { db, fs } = fb;
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'banners'), fs.orderBy('order', 'asc')));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  body.innerHTML = `
    <div class="admin-actions"><p class="group__header" style="margin:0">${rows.length} banner(s) · exibidos na ordem abaixo</p>
      <button class="btn btn--sm" id="add">${icon('plus')}Novo banner</button></div>
    <div class="banner-admin">
      ${rows.map((b, i) => `
        <div class="banner-admin__item card">
          <div class="banner banner--preview" style="--banner:${esc(b.color || '#007aff')}">
            ${b.imageURL ? `<img class="banner__img" src="${esc(b.imageURL)}" alt="">` : '<span class="banner__glow"></span>'}
            <span class="banner__body"><strong class="banner__title">${esc(b.title)}</strong><span class="banner__subtitle">${esc(b.subtitle || '')}</span></span>
          </div>
          <div class="banner-admin__bar">
            <span class="pill pill--${b.active ? 'success' : 'neutral'}">${b.active ? 'Ativo' : 'Inativo'}</span>
            <span class="spacer"></span>
            <button class="round-btn" data-move="-1" data-id="${b.id}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${icon('chevronLeft')}</button>
            <button class="round-btn" data-move="1" data-id="${b.id}" ${i === rows.length - 1 ? 'disabled' : ''} aria-label="Descer">${icon('chevronRight')}</button>
            <button class="round-btn" data-edit="${b.id}" aria-label="Editar">${icon('edit')}</button>
            <button class="round-btn round-btn--danger" data-del="${b.id}" aria-label="Excluir">${icon('trash')}</button>
          </div>
        </div>`).join('') || '<div class="empty"><p>Nenhum banner. Enquanto não houver banners ativos, a home mostra os destaques padrão.</p></div>'}
    </div>`;

  body.querySelector('#add').addEventListener('click', () => editBanner(null, rows.length));
  body.querySelector('.banner-admin').addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.edit) editBanner(rows.find((r) => r.id === t.dataset.edit));
    if (t.dataset.del) {
      const b = rows.find((r) => r.id === t.dataset.del);
      if (!(await confirmSheet({ title: 'Excluir banner?', message: b.title, confirmLabel: 'Excluir', destructive: true }))) return;
      await fs.deleteDoc(fs.doc(db, 'banners', b.id));
      if (b.imageURL) deleteByUrl(b.imageURL);
      toast('Banner excluído', 'success');
      showTab();
    }
    if (t.dataset.move) {
      const i = rows.findIndex((r) => r.id === t.dataset.id);
      const j = i + Number(t.dataset.move);
      if (j < 0 || j >= rows.length) return;
      [rows[i], rows[j]] = [rows[j], rows[i]];
      const batch = fs.writeBatch(db);
      rows.forEach((r, k) => batch.update(fs.doc(db, 'banners', r.id), { order: k, updatedAt: fs.serverTimestamp() }));
      await batch.commit();
      showTab();
    }
  });
  animateIn(body);
}

function editBanner(b, nextOrder = 0) {
  const { db, fs } = fb;
  let file = null;
  const sheet = openSheet({
    title: b ? 'Editar banner' : 'Novo banner',
    rightLabel: 'Salvar',
    onRight: () => { save(); return false; },
  });
  sheet.body.innerHTML = `
    <form id="bf" class="banner-form" novalidate>
      <div class="banner banner--preview" id="bprev"></div>
      <p class="group__header mt-16">Conteúdo</p>
      <div class="group"><div class="list">
        <label class="field"><span class="field__label">Título</span><input name="title" maxlength="80" value="${esc(b?.title || '')}" placeholder="Ex.: Semana do eletricista"></label>
        <label class="field"><span class="field__label">Subtítulo</span><input name="subtitle" maxlength="140" value="${esc(b?.subtitle || '')}" placeholder="Opcional"></label>
        <label class="field"><span class="field__label">Botão</span><input name="cta" maxlength="30" value="${esc(b?.cta || '')}" placeholder="Ex.: Ver profissionais"></label>
        <label class="field"><span class="field__label">Link</span><input name="link" maxlength="500" value="${esc(b?.link || '')}" placeholder="#/s/eletricista ou https://…"></label>
      </div><p class="group__footer">Links internos começam com #/ (ex.: #/c/reformas). Externos com https://.</p></div>
      <p class="group__header">Aparência</p>
      <div class="group"><div class="list">
        <label class="field"><span class="field__label">Cor</span><input name="color" type="color" value="${esc(b?.color || '#007aff')}"></label>
        <label class="field"><span class="field__label">Imagem</span><input name="image" type="file" accept="image/*"></label>
        <div class="field"><span class="field__label" style="flex:1;width:auto">Ativo</span>
          <span class="switch"><input type="checkbox" name="active" ${b?.active === false ? '' : 'checked'}><span class="switch__track"><span class="switch__thumb"></span></span></span></div>
      </div><p class="group__footer">Imagem opcional, formato largo (ex.: 1600×640). Sem imagem, usa a cor de fundo.</p></div>
    </form>`;

  const form = sheet.body.querySelector('#bf');
  const prev = sheet.body.querySelector('#bprev');
  let imgURL = b?.imageURL || '';
  const paint = () => {
    const f = form.elements;
    prev.style.setProperty('--banner', f.color.value);
    prev.innerHTML = `${imgURL ? `<img class="banner__img" src="${esc(imgURL)}" alt="">` : '<span class="banner__glow"></span>'}
      <span class="banner__body"><strong class="banner__title">${esc(f.title.value || 'Título do banner')}</strong>
      <span class="banner__subtitle">${esc(f.subtitle.value)}</span>${f.cta.value ? `<span class="banner__cta">${esc(f.cta.value)}</span>` : ''}</span>`;
  };
  form.addEventListener('input', paint);
  form.elements.image.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const err = validateImageFile(f);
    if (err) { toast(err, 'error'); return; }
    file = f;
    imgURL = URL.createObjectURL(f);
    paint();
  });
  paint();

  async function save() {
    const f = form.elements;
    if (!f.title.value.trim()) { toast('Informe o título', 'error'); return; }
    const link = f.link.value.trim();
    if (link && !/^(#\/|signup\.html|https:\/\/)/.test(link)) { toast('Link deve começar com #/ ou https://', 'error'); return; }
    const btn = sheet.el.querySelector('[data-right]');
    btn.disabled = true;
    try {
      const ref = b ? fs.doc(db, 'banners', b.id) : fs.doc(fs.collection(db, 'banners'));
      let imageURL = b?.imageURL || '';
      if (file) {
        const blob = await compressImage(file, IMAGE_PRESETS.banner);
        imageURL = await uploadImage(`banners/${ref.id}-${Date.now()}.jpg`, blob);
        if (b?.imageURL) deleteByUrl(b.imageURL);
      }
      await fs.setDoc(ref, {
        title: f.title.value.trim(),
        subtitle: f.subtitle.value.trim(),
        cta: f.cta.value.trim(),
        link,
        color: f.color.value,
        imageURL,
        active: f.active.checked,
        order: b ? b.order : nextOrder,
        updatedAt: fs.serverTimestamp(),
      });
      toast('Banner salvo', 'success');
      sheet.close();
      showTab();
    } catch (err) {
      console.error(err);
      toast('Não foi possível salvar o banner', 'error');
      btn.disabled = false;
    }
  }
}

/* ==========================================================================
   Admins
   ========================================================================== */
async function admins(body) {
  body.innerHTML = `
    <p class="group__header" style="margin-left:0">Conceder ou remover acesso</p>
    <form class="list" id="af">
      <label class="field"><span class="field__label">E-mail</span><input name="email" type="email" required placeholder="pessoa@gmail.com"></label>
    </form>
    <p class="group__footer" style="margin-left:0">A pessoa precisa ter entrado no site com Google ao menos uma vez. O acesso vale no próximo login dela.</p>
    <div class="admin-actions mt-16">
      <button class="btn btn--sm" data-role="1">Tornar admin</button>
      <button class="btn btn--sm btn--secondary" data-role="0">Remover admin</button>
    </div>`;
  body.querySelector('.admin-actions').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-role]');
    if (!b) return;
    const email = body.querySelector('[name=email]').value.trim();
    if (!email) { toast('Informe o e-mail', 'error'); return; }
    b.disabled = true;
    try {
      await callFunction('adminSetRole', { email, admin: b.dataset.role === '1' });
      toast(b.dataset.role === '1' ? `${email} agora é admin` : `Acesso removido de ${email}`, 'success');
    } catch (err) {
      toast(err.message || 'Falhou', 'error');
    } finally {
      b.disabled = false;
    }
  });
}
