/**
 * Profile tab: entry point for professionals.
 * Visitors never need an account — this tab is only for those offering services.
 */
import { pageHead } from '../ui/components.js';
import { icon, chevron } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { currentUser, getMyProfile, signOut } from '../services/auth.js';
import { isFirebaseConfigured } from '../services/firebase.js';
import { primarySpecialty } from '../services/professionals.js';
import { esc, avatarHTML } from '../core/utils.js';

const BENEFITS = [
  ['sparkles', '#ff9500', 'Perfil profissional grátis', 'Foto, capa, descrição e portfólio.'],
  ['whatsapp', '#25d366', 'Clientes no seu WhatsApp', 'Sem intermediários e sem taxas.'],
  ['pin', '#ff3b30', 'Seja encontrado na sua região', 'Apareça para quem busca no seu bairro.'],
];

export async function meView(_params, { root, isStale }) {
  root.innerHTML = `${pageHead({ title: 'Perfil' })}<div class="center-spinner"><div class="spinner"></div></div>`;

  let user = null;
  let profile = null;
  try {
    user = await currentUser();
    if (user) profile = await getMyProfile(user.uid);
  } catch (err) {
    console.error(err);
  }
  if (isStale()) return;

  if (!user) return renderGuest(root);
  return renderMember(root, user, profile);
}

function renderGuest(root) {
  root.innerHTML = `
    ${pageHead({ title: 'Perfil', subtitle: 'Para buscar e contratar você não precisa de conta.' })}
    <div class="group mt-16">
      <div class="card" style="padding:24px 20px;text-align:center">
        <div class="icon-tile icon-tile--lg" style="--tile:#007aff;margin:0 auto 14px">${icon('briefcase')}</div>
        <h2 style="margin:0 0 6px;font-size:22px;letter-spacing:.35px">Você presta serviços?</h2>
        <p class="muted" style="margin:0 0 18px;font-size:15px">Cadastre-se em 2 minutos com sua conta Google e comece a receber pedidos.</p>
        <a class="btn btn--block" href="signup.html">Cadastrar meu serviço</a>
        ${isFirebaseConfigured ? '<a class="text-btn mt-8" href="signup.html">Já tenho cadastro · Entrar</a>' : ''}
      </div>
    </div>
    <div class="group">
      <ul class="list list--icons">
        ${BENEFITS.map(([ic, color, title, sub]) => `
          <li><div class="row">
            <span class="icon-tile" style="--tile:${color}">${icon(ic)}</span>
            <div class="row__body"><div class="row__title">${title}</div><div class="row__subtitle">${sub}</div></div>
          </div></li>`).join('')}
      </ul>
    </div>`;
}

function renderMember(root, user, profile) {
  const display = profile || { name: user.displayName || 'Profissional', photoURL: user.photoURL, specs: [] };
  root.innerHTML = `
    ${pageHead({ title: 'Perfil' })}
    <div class="group mt-8">
      <ul class="list">
        <li><a class="row" href="${profile ? `#/p/${esc(user.uid)}` : 'signup.html'}" style="padding-top:12px;padding-bottom:12px">
          ${avatarHTML(display, 'avatar--md')}
          <div class="row__body">
            <div class="row__title" style="font-size:20px;font-weight:600">${esc(display.name)}</div>
            <div class="row__subtitle">${profile ? esc(primarySpecialty(profile)) : 'Cadastro incompleto'} · ${esc(user.email || '')}</div>
          </div>
          ${chevron}
        </a></li>
      </ul>
    </div>

    ${profile ? `
      <div class="group">
        <ul class="list list--icons">
          <li><a class="row" href="#/p/${esc(user.uid)}"><span class="icon-tile" style="--tile:#007aff">${icon('eye')}</span><div class="row__body"><div class="row__title">Ver perfil público</div></div>${chevron}</a></li>
          <li><a class="row" href="signup.html"><span class="icon-tile" style="--tile:#ff9500">${icon('edit')}</span><div class="row__body"><div class="row__title">Editar perfil</div></div>${chevron}</a></li>
          <li><div class="row"><span class="icon-tile" style="--tile:${profile.published ? '#34c759' : '#8e8e93'}">${icon('checkCircle')}</span><div class="row__body"><div class="row__title">Status</div></div><span class="row__detail">${profile.published ? 'Visível' : 'Oculto'}</span></div></li>
        </ul>
      </div>` : `
      <div class="group">
        <a class="btn btn--block" href="signup.html">Concluir cadastro</a>
        <p class="group__footer">Complete seus dados para aparecer nas buscas.</p>
      </div>`}

    <div class="group">
      <ul class="list"><li><button class="row row--destructive" id="logout">Sair</button></li></ul>
    </div>`;

  root.querySelector('#logout').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try {
      await signOut();
      toast('Você saiu da sua conta', 'success');
      renderGuest(root);
    } catch {
      toast('Não foi possível sair', 'error');
      e.currentTarget.disabled = false;
    }
  });
}
