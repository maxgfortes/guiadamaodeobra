/**
 * Professional signup / profile editor (signup.html).
 *
 * Flow
 *   1. Google sign-in (the only auth method).
 *   2. Single-page form, prefilled from Google or from the existing profile:
 *      photo, banner, name, WhatsApp, e-mail, services, city/neighborhood,
 *      description, portfolio, visibility.
 *   3. Save: compress + upload new images to Storage, write the Firestore doc,
 *      remove images that were replaced/deleted.
 *   4. Not active yet (first signup / expired)? → plan + card payment
 *      (views/plans.js). Cloud Functions activate the profile once paid.
 *
 * Deep link: signup.html#plano opens the payment step directly.
 */
import { getFirebase, isFirebaseConfigured } from './services/firebase.js';
import { currentUser, signInWithGoogle, signOut, getMyProfile, authErrorMessage } from './services/auth.js';
import { compressImage, uploadImage, deleteByUrl, validateImageFile, IMAGE_PRESETS } from './services/images.js';
import { invalidateCache } from './services/professionals.js';
import { CATEGORIES, getSpec, categoriesForSpecs } from './data/categories.js';
import { icon, chevron } from './ui/icons.js';
import { toast } from './ui/toast.js';
import { openSheet } from './ui/sheet.js';
import { demoNote } from './ui/components.js';
import { renderPlans } from './views/plans.js';
import { initPWA } from './core/pwa.js';
import {
  esc, normalize, digits, maskPhoneBR, formatPhoneBR, isEmail, avatarHTML, haptic, debounce,
} from './core/utils.js';

const root = document.getElementById('signup');
const MAX_SPECS = 12;
const MAX_PORTFOLIO = 12;
const BIO_MAX = 600;

/* ---------- State ---------- */
const state = {
  user: null,
  existing: null,      // Firestore doc as loaded (null on first signup)
  photo: null,         // { url, file? } — file set when newly picked
  banner: null,
  portfolio: [],       // [{ url, file? }]
  specs: [],
  saving: false,
  dirty: false,
};

/* ==========================================================================
   Boot
   ========================================================================== */
initPWA();
boot();

const wantsPlans = () => location.hash === '#plano';
let stopPlans = null;

/** Payment step for the signed-in professional. */
function showPlans() {
  stopPlans?.();
  window.scrollTo(0, 0);
  stopPlans = renderPlans(root, {
    user: state.user,
    profile: state.existing,
    onEdit: () => { history.replaceState(null, '', location.pathname); renderForm(); window.scrollTo(0, 0); },
  });
}

async function boot() {
  if (!isFirebaseConfigured) return renderAuth({ demo: true });
  try {
    // Completes a pending redirect sign-in (popup fallback) if any.
    const fb = await getFirebase();
    await fb.au.getRedirectResult(fb.auth).catch((err) => toast(authErrorMessage(err), 'error'));
    const user = await currentUser();
    if (user) await enterForm(user);
    else renderAuth();
  } catch (err) {
    console.error(err);
    renderAuth();
    toast('Falha ao conectar. Verifique sua internet.', 'error');
  }
}

async function enterForm(user) {
  root.innerHTML = '<div class="center-spinner" style="padding-top:120px"><div class="spinner"></div></div>';
  state.user = user;
  try {
    state.existing = await getMyProfile(user.uid);
  } catch (err) {
    console.error(err);
    toast('Não foi possível carregar seu perfil.', 'error');
  }
  const p = state.existing;
  state.photo = p?.photoURL ? { url: p.photoURL } : (user.photoURL ? { url: user.photoURL, google: true } : null);
  state.banner = p?.bannerURL ? { url: p.bannerURL } : null;
  state.portfolio = (p?.portfolio || []).map((url) => ({ url }));
  state.specs = [...(p?.specs || [])];
  if (p && (wantsPlans() || !p.active)) showPlans();
  else renderForm();
}

/* ==========================================================================
   Screen 1 — Google sign-in
   ========================================================================== */
function renderAuth({ demo = false } = {}) {
  root.innerHTML = `
    <section class="auth-hero">
      <div class="auth-hero__art">${icon('briefcase', { stroke: 1.6 })}</div>
      <h1>Mostre seu trabalho para quem precisa</h1>
      <p>Crie seu perfil profissional grátis e receba pedidos direto no WhatsApp.</p>
      <button class="btn btn--block btn--google" id="google" ${demo ? 'disabled' : ''}>
        ${icon('google')}<span>Continuar com Google</span>
      </button>
      ${demo ? `<button class="btn btn--block btn--secondary mt-8" id="preview">Ver formulário (demonstração)</button>` : ''}
      <p class="legal">Usamos sua conta Google apenas para identificar seu perfil. Seus contatos ficam visíveis publicamente para clientes.</p>
    </section>
    ${demo ? demoNote() : ''}
    <div class="group steps">
      <ul class="list list--icons">
        ${[
          ['person', '#007aff', '1. Entre com o Google', 'Sem senha para lembrar.'],
          ['edit', '#ff9500', '2. Preencha seu perfil', 'Serviços, região, fotos e descrição.'],
          ['whatsapp', '#25d366', '3. Receba clientes', 'Contato direto, sem taxas.'],
        ].map(([ic, c, t, s]) => `
          <li><div class="row"><span class="icon-tile" style="--tile:${c}">${icon(ic)}</span>
            <div class="row__body"><div class="row__title">${t}</div><div class="row__subtitle">${s}</div></div></div></li>`).join('')}
      </ul>
    </div>`;

  root.querySelector('#preview')?.addEventListener('click', () => {
    state.user = { uid: 'demo', displayName: '', email: '' };
    renderForm();
  });

  const btn = root.querySelector('#google');
  btn.addEventListener('click', async () => {
    haptic();
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span><span>Conectando…</span>';
    try {
      const user = await signInWithGoogle();
      if (user) {
        toast(`Olá, ${(user.displayName || '').split(' ')[0] || 'bem-vindo'}!`, 'success');
        await enterForm(user);
      }
    } catch (err) {
      console.error(err);
      toast(authErrorMessage(err), err.code === 'auth/popup-closed-by-user' ? 'info' : 'error');
      btn.disabled = false;
      btn.innerHTML = `${icon('google')}<span>Continuar com Google</span>`;
    }
  });
}

/* ==========================================================================
   Screen 2 — Profile form
   ========================================================================== */
function renderForm() {
  const p = state.existing || {};
  const u = state.user;
  const isEdit = Boolean(state.existing);

  root.innerHTML = `
    <form id="form" class="view" novalidate>
      <header class="page-head">
        <h1 class="large-title">${isEdit ? 'Editar perfil' : 'Seu perfil'}</h1>
        <p class="subtitle">${isEdit ? 'As alterações aparecem na hora para os clientes.' : 'Leva uns 2 minutos. Capriche nas fotos!'}</p>
      </header>
      ${state.user.uid === 'demo' ? demoNote() : ''}

      <!-- Banner + avatar -->
      <div class="media-edit mt-16">
        <label class="media-edit__banner" aria-label="Alterar capa">
          <span id="banner-preview">${state.banner ? `<img src="${esc(state.banner.url)}" alt="">` : ''}</span>
          <span class="cam-badge">${icon('camera')}</span>
          <input type="file" accept="image/*" id="banner-input">
        </label>
        <label class="media-edit__avatar" aria-label="Alterar foto de perfil">
          <span id="avatar-preview">${avatarHTML({ name: p.name || u.displayName, photoURL: state.photo?.url })}</span>
          <span class="cam-badge">${icon('camera')}</span>
          <input type="file" accept="image/*" id="avatar-input">
        </label>
      </div>

      <p class="group__header">Dados</p>
      <div class="group">
        <div class="list">
          <label class="field"><span class="field__label">Nome</span>
            <input name="name" autocomplete="name" maxlength="80" required placeholder="Nome completo" value="${esc(p.name || u.displayName || '')}"></label>
        </div>
      </div>

      <p class="group__header">Contato</p>
      <div class="group">
        <div class="list">
          <label class="field"><span class="field__label">WhatsApp</span>
            <input name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" required placeholder="(11) 98765-4321" value="${esc(formatPhoneBR(p.whatsapp || ''))}"></label>
          <label class="field"><span class="field__label">E-mail</span>
            <input name="email" type="email" inputmode="email" autocomplete="email" required placeholder="voce@email.com" value="${esc(p.email || u.email || '')}"></label>
          <label class="field"><span class="field__label">Telefone</span>
            <input name="phone" type="tel" inputmode="tel" placeholder="Opcional" value="${esc(p.phone && p.phone !== p.whatsapp ? formatPhoneBR(p.phone) : '')}"></label>
        </div>
        <p class="group__footer">Clientes falam com você por esses canais. Se o telefone ficar vazio, usamos o WhatsApp.</p>
      </div>

      <p class="group__header">Serviços oferecidos</p>
      <div class="group">
        <div class="list">
          <button type="button" class="row" id="pick-specs">
            <div class="row__body"><div class="row__title">Selecionar serviços</div></div>
            <span class="row__detail" id="specs-count"></span>${chevron}
          </button>
          <div class="selected-chips" id="specs-chips"></div>
        </div>
        <p class="group__footer">Escolha até ${MAX_SPECS}. O primeiro aparece como sua especialidade principal.</p>
      </div>

      <p class="group__header">Localização</p>
      <div class="group">
        <div class="list">
          <label class="field"><span class="field__label">Cidade</span>
            <input name="city" autocomplete="address-level2" maxlength="60" required placeholder="Ex.: São Paulo" value="${esc(p.city || '')}"></label>
          <label class="field"><span class="field__label">Bairro</span>
            <input name="neighborhood" maxlength="60" required placeholder="Ex.: Vila Mariana" value="${esc(p.neighborhood || '')}"></label>
        </div>
      </div>

      <p class="group__header">Sobre você</p>
      <div class="group">
        <div class="list">
          <label class="field field--textarea"><span class="sr-only">Descrição</span>
            <textarea name="bio" maxlength="${BIO_MAX}" rows="5" placeholder="Conte sua experiência, diferenciais, horários de atendimento…">${esc(p.bio || '')}</textarea></label>
        </div>
        <p class="counter" id="bio-count"></p>
      </div>

      <p class="group__header">Portfólio <span id="port-count"></span></p>
      <div class="port-grid" id="port-grid"></div>
      <p class="group__footer" style="margin-bottom:28px">Fotos de trabalhos realizados. Até ${MAX_PORTFOLIO} imagens.</p>

      <div class="group">
        <div class="list">
          <div class="field"><span class="field__label" style="flex:1;width:auto">Perfil visível nas buscas</span>
            <span class="switch"><input type="checkbox" name="published" ${p.published === false ? '' : 'checked'} aria-label="Perfil visível"><span class="switch__track"><span class="switch__thumb"></span></span></span>
          </div>
        </div>
        <p class="group__footer">Desative para pausar seu perfil temporariamente.</p>
      </div>

      ${state.user.uid !== 'demo' ? `
      <div class="group">
        <ul class="list">
          ${isEdit ? `<li><a class="row row--action" href="index.html#/p/${esc(u.uid)}" style="justify-content:center">Ver meu perfil público</a></li>` : ''}
          <li><button type="button" class="row row--destructive" id="logout">Sair da conta</button></li>
        </ul>
        <p class="group__footer center">Conectado como ${esc(u.email || '')}</p>
      </div>` : ''}

      <div class="savebar"><div class="savebar__inner">
        <button class="btn btn--block" type="submit" id="save">${state.existing?.active ? 'Salvar alterações' : 'Salvar e escolher plano'}</button>
      </div></div>
    </form>`;

  const form = root.querySelector('#form');
  wireMedia(form);
  wirePhones(form);
  renderSpecs();
  renderPortfolio();
  wireBio(form);

  form.addEventListener('input', () => { state.dirty = true; });
  root.querySelector('#pick-specs').addEventListener('click', openSpecPicker);
  root.querySelector('#logout')?.addEventListener('click', async () => {
    if (state.dirty && !confirm('Sair sem salvar as alterações?')) return;
    await signOut();
    state.dirty = false;
    toast('Você saiu da sua conta', 'success');
    renderAuth();
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); save(form); });
}

/* ---------- Banner / avatar pickers ---------- */
function wireMedia(form) {
  const bind = (inputId, key) => {
    form.querySelector(inputId).addEventListener('change', (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const err = validateImageFile(file);
      if (err) return toast(err, 'error');
      if (state[key]?.file) URL.revokeObjectURL(state[key].url);
      state[key] = { url: URL.createObjectURL(file), file };
      state.dirty = true;
      haptic();
      if (key === 'banner') {
        form.querySelector('#banner-preview').innerHTML = `<img src="${state.banner.url}" alt="">`;
      } else {
        form.querySelector('#avatar-preview').innerHTML = avatarHTML({ name: form.elements.name.value, photoURL: state.photo.url });
      }
    });
  };
  bind('#banner-input', 'banner');
  bind('#avatar-input', 'photo');
}

function wirePhones(form) {
  for (const name of ['whatsapp', 'phone']) {
    const input = form.elements[name];
    input.addEventListener('input', () => {
      const atEnd = input.selectionStart === input.value.length;
      input.value = maskPhoneBR(input.value);
      if (atEnd) input.setSelectionRange(input.value.length, input.value.length);
    });
  }
}

function wireBio(form) {
  const ta = form.elements.bio;
  const out = form.querySelector('#bio-count');
  const update = () => { out.textContent = `${ta.value.length}/${BIO_MAX}`; };
  ta.addEventListener('input', update);
  update();
}

/* ---------- Services (multi-select) ---------- */
function renderSpecs() {
  root.querySelector('#specs-count').textContent = state.specs.length ? `${state.specs.length} selecionado${state.specs.length > 1 ? 's' : ''}` : '';
  root.querySelector('#specs-chips').innerHTML = state.specs.map(getSpec).filter(Boolean).map(({ spec, category }, i) => `
    <span class="chip chip--static"><span class="chip__dot" style="--tile:${category.color}"></span>${esc(spec.name)}${i === 0 ? ' · principal' : ''}</span>`).join('');
}

function openSpecPicker() {
  let draft = [...state.specs];
  const sheet = openSheet({
    title: 'Serviços',
    rightLabel: 'Concluir',
    onRight: () => {
      state.specs = draft;
      state.dirty = true;
      renderSpecs();
    },
  });

  sheet.body.innerHTML = `
    <div class="searchbar">
      <label class="search-field">${icon('search')}<input type="search" placeholder="Buscar serviço" id="spec-q" autocomplete="off"></label>
    </div>
    <p class="picker-count" id="picker-count"></p>
    <div id="picker-list"></div>`;

  const list = sheet.body.querySelector('#picker-list');
  const count = sheet.body.querySelector('#picker-count');

  const paint = (term = '') => {
    const q = normalize(term);
    count.textContent = `${draft.length} de ${MAX_SPECS} selecionados`;
    list.innerHTML = CATEGORIES.map((cat) => {
      const groups = cat.groups.map((g) => {
        const specs = g.specs.filter((s) => !q || normalize(`${s.name} ${g.name} ${cat.name}`).includes(q));
        if (!specs.length) return '';
        return `
          <p class="group__header" style="margin-top:10px">${esc(g.name)}</p>
          <div class="group" style="margin-bottom:12px"><ul class="list">
            ${specs.map((s) => `
              <li><button type="button" class="row ${draft.includes(s.id) ? 'is-checked' : ''}" data-spec="${s.id}" aria-pressed="${draft.includes(s.id)}">
                <div class="row__body"><div class="row__title">${esc(s.name)}</div></div>
                ${icon('check', { cls: 'check', stroke: 2.6 })}
              </button></li>`).join('')}
          </ul></div>`;
      }).join('');
      if (!groups) return '';
      return `<div class="picker-cat"><span class="icon-tile" style="--tile:${cat.color}">${icon(cat.icon)}</span>${esc(cat.name)}</div>${groups}`;
    }).join('') || '<div class="empty"><p>Nenhum serviço encontrado.</p></div>';
  };

  list.addEventListener('click', (e) => {
    const row = e.target.closest('[data-spec]');
    if (!row) return;
    const id = row.dataset.spec;
    if (draft.includes(id)) draft = draft.filter((x) => x !== id);
    else if (draft.length >= MAX_SPECS) return toast(`Máximo de ${MAX_SPECS} serviços`, 'info');
    else draft.push(id);
    haptic();
    const on = draft.includes(id);
    row.classList.toggle('is-checked', on);
    row.setAttribute('aria-pressed', on);
    count.textContent = `${draft.length} de ${MAX_SPECS} selecionados`;
  });
  sheet.body.querySelector('#spec-q').addEventListener('input', debounce((e) => paint(e.target.value), 120));
  paint();
}

/* ---------- Portfolio ---------- */
function renderPortfolio() {
  const grid = root.querySelector('#port-grid');
  root.querySelector('#port-count').textContent = state.portfolio.length ? `· ${state.portfolio.length}/${MAX_PORTFOLIO}` : '';
  grid.innerHTML = state.portfolio.map((item, i) => `
    <div class="port-item">
      <img src="${esc(item.url)}" alt="Foto ${i + 1}" loading="lazy">
      <button type="button" class="port-item__remove" data-remove="${i}" aria-label="Remover foto ${i + 1}">${icon('close', { stroke: 3 })}</button>
    </div>`).join('') + (state.portfolio.length < MAX_PORTFOLIO ? `
    <label class="port-add">${icon('plus')}<span>Adicionar</span>
      <input type="file" accept="image/*" multiple id="port-input">
    </label>` : '');

  grid.querySelector('#port-input')?.addEventListener('change', (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    const room = MAX_PORTFOLIO - state.portfolio.length;
    if (files.length > room) toast(`Apenas ${room} foto(s) adicionada(s) — limite de ${MAX_PORTFOLIO}`, 'info');
    for (const file of files.slice(0, room)) {
      const err = validateImageFile(file);
      if (err) { toast(err, 'error'); continue; }
      state.portfolio.push({ url: URL.createObjectURL(file), file });
    }
    state.dirty = true;
    haptic();
    renderPortfolio();
  });

  grid.onclick = (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    e.preventDefault();
    const [removed] = state.portfolio.splice(Number(btn.dataset.remove), 1);
    if (removed?.file) URL.revokeObjectURL(removed.url);
    state.dirty = true;
    haptic();
    renderPortfolio();
  };
}

/* ==========================================================================
   Validation + save
   ========================================================================== */
function validate(form) {
  const v = (n) => form.elements[n].value.trim();
  const errors = [];
  const mark = (name, bad) => form.elements[name]?.closest('.field')?.classList.toggle('is-invalid', bad);

  const checks = [
    ['name', v('name').length >= 2, 'Informe seu nome completo.'],
    ['whatsapp', [10, 11].includes(digits(v('whatsapp')).length), 'WhatsApp inválido. Inclua o DDD.'],
    ['email', isEmail(v('email')), 'E-mail inválido.'],
    ['phone', !v('phone') || [10, 11].includes(digits(v('phone')).length), 'Telefone inválido.'],
    ['city', v('city').length >= 2, 'Informe sua cidade.'],
    ['neighborhood', v('neighborhood').length >= 2, 'Informe seu bairro.'],
  ];
  for (const [name, ok, msg] of checks) {
    mark(name, !ok);
    if (!ok) errors.push({ name, msg });
  }
  if (!state.specs.length) errors.push({ name: 'specs', msg: 'Selecione pelo menos um serviço.' });
  return errors;
}

async function save(form) {
  if (state.saving) return;
  const errors = validate(form);
  if (errors.length) {
    haptic(30);
    toast(errors[0].msg, 'error');
    const el = errors[0].name === 'specs' ? root.querySelector('#pick-specs') : form.elements[errors[0].name];
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (errors[0].name !== 'specs') el?.focus({ preventScroll: true });
    return;
  }
  if (state.user.uid === 'demo' || !isFirebaseConfigured) {
    toast('Modo demonstração: configure o Firebase para publicar.', 'info', 3500);
    return;
  }

  state.saving = true;
  const hud = showHud('Preparando…');
  const uid = state.user.uid;
  const prev = state.existing || {};
  const v = (n) => form.elements[n].value.trim();

  try {
    // 1. Upload new images (compressed), sequentially for steady progress on mobile.
    const jobs = [];
    if (state.photo?.file) jobs.push({ key: 'photo', item: state.photo, preset: IMAGE_PRESETS.avatar, path: `avatar-${Date.now()}.jpg` });
    if (state.banner?.file) jobs.push({ key: 'banner', item: state.banner, preset: IMAGE_PRESETS.banner, path: `banner-${Date.now()}.jpg` });
    state.portfolio.forEach((item) => {
      if (item.file) jobs.push({ key: 'portfolio', item, preset: IMAGE_PRESETS.portfolio, path: `portfolio/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg` });
    });

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      hud.set(`Enviando foto ${i + 1} de ${jobs.length}`, i / jobs.length);
      const blob = await compressImage(job.item.file, job.preset);
      const url = await uploadImage(`professionals/${uid}/${job.path}`, blob,
        (pct) => hud.set(`Enviando foto ${i + 1} de ${jobs.length}`, (i + pct) / jobs.length));
      URL.revokeObjectURL(job.item.url);
      job.item.url = url;
      delete job.item.file;
    }

    // 2. Write the profile document.
    hud.set('Salvando perfil…', 1);
    const fb = await getFirebase();
    const { db, fs } = fb;
    const whatsapp = digits(v('whatsapp'));
    const doc = {
      name: v('name'),
      nameLower: normalize(v('name')),
      whatsapp,
      phone: digits(v('phone')) || whatsapp,
      email: v('email'),
      specs: state.specs,
      categories: categoriesForSpecs(state.specs),
      city: v('city'),
      cityLower: normalize(v('city')),
      neighborhood: v('neighborhood'),
      bio: v('bio').slice(0, BIO_MAX),
      photoURL: state.photo?.url && /^https?:/.test(state.photo.url) ? state.photo.url : '',
      bannerURL: state.banner?.url || '',
      portfolio: state.portfolio.map((p) => p.url),
      published: form.elements.published.checked,
      // createdAt is only set on creation; merge keeps it (and server-only
      // billing fields) untouched on updates.
      ...(state.existing ? {} : { createdAt: fs.serverTimestamp() }),
      updatedAt: fs.serverTimestamp(),
    };
    await fs.setDoc(fs.doc(db, 'professionals', uid), doc, { merge: true });

    // 3. Clean up files that are no longer referenced (best effort).
    const keep = new Set([doc.photoURL, doc.bannerURL, ...doc.portfolio]);
    const old = [prev.photoURL, prev.bannerURL, ...(prev.portfolio || [])]
      .filter((u) => u && u.includes('firebasestorage') && !keep.has(u));
    Promise.all(old.map(deleteByUrl));

    state.existing = { ...prev, ...doc, createdAt: prev.createdAt || fs.Timestamp.now() };
    state.dirty = false;
    invalidateCache();
    if (state.existing.active) {
      hud.done(prev.name ? 'Perfil atualizado' : 'Perfil salvo!');
      setTimeout(() => { location.href = `index.html#/p/${uid}`; }, 900);
    } else {
      // Not paid yet: continue to the plan / payment step.
      hud.done('Perfil salvo!');
      setTimeout(() => { hud.close(); showPlans(); }, 700);
    }
  } catch (err) {
    console.error(err);
    hud.close();
    toast(err.code === 'permission-denied'
      ? 'Permissão negada. Verifique os dados e tente de novo.'
      : 'Não foi possível salvar. Verifique sua conexão.', 'error', 4000);
  } finally {
    state.saving = false;
  }
}

/** Blocking progress HUD for uploads. */
function showHud(text) {
  const el = document.createElement('div');
  el.className = 'hud-backdrop';
  el.innerHTML = `<div class="hud" role="alertdialog" aria-live="assertive"><div class="spinner"></div><div class="hud__text">${esc(text)}</div><div class="hud__bar"><span></span></div></div>`;
  document.body.appendChild(el);
  const textEl = el.querySelector('.hud__text');
  const bar = el.querySelector('.hud__bar span');
  return {
    set(t, pct = 0) { textEl.textContent = t; bar.style.width = `${Math.round(pct * 100)}%`; },
    done(t) {
      el.querySelector('.hud').innerHTML = `<div class="hud__done">${icon('checkCircle')}</div><div>${esc(t)}</div>`;
      haptic(20);
    },
    close() { el.remove(); },
  };
}

/* Warn before leaving with unsaved changes. */
window.addEventListener('beforeunload', (e) => {
  if (state.dirty && !state.saving) { e.preventDefault(); e.returnValue = ''; }
});
