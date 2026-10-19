/**
 * Transactional e-mails (SMTP via nodemailer).
 *
 * If SMTP is not configured (no SMTP_USER), messages are logged and skipped
 * so payment processing never fails because of e-mail.
 */
import nodemailer from 'nodemailer';
import { logger } from 'firebase-functions';
import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, APP_URL } from './config.js';
import { formatBRL } from './plans.js';

let transport = null;
function getTransport() {
  if (!SMTP_USER.value()) return null;
  if (!transport) {
    const port = SMTP_PORT.value();
    transport = nodemailer.createTransport({
      host: SMTP_HOST.value(),
      port,
      secure: port === 465,
      auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
    });
  }
  return transport;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });

/** iOS-flavoured HTML shell shared by every message. */
function layout({ title, intro, body = '', cta, ctaUrl, tone = '#007aff' }) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#000">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
      <tr><td style="padding:0 0 16px;font-weight:700;font-size:17px">🔧 Mão de <span style="color:#007aff">Obra</span></td></tr>
      <tr><td style="background:#fff;border-radius:16px;padding:28px 24px">
        <div style="width:44px;height:6px;border-radius:3px;background:${tone};margin-bottom:18px"></div>
        <h1 style="margin:0 0 10px;font-size:24px;line-height:30px">${esc(title)}</h1>
        <p style="margin:0 0 18px;font-size:16px;line-height:24px;color:#3c3c43">${intro}</p>
        ${body}
        ${cta ? `<a href="${esc(ctaUrl)}" style="display:inline-block;margin-top:8px;background:${tone};color:#fff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 22px;border-radius:12px">${esc(cta)}</a>` : ''}
      </td></tr>
      <tr><td style="padding:16px 8px;color:#8e8e93;font-size:12px;line-height:18px;text-align:center">
        Você recebeu este e-mail porque tem um perfil profissional no Guia Mão de Obra.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

function detailsTable(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f7;border-radius:12px;margin:0 0 18px">
    ${rows.map(([k, v], i) => `<tr><td style="padding:12px 14px;font-size:14px;color:#8e8e93;${i ? 'border-top:1px solid #e5e5ea;' : ''}">${esc(k)}</td>
      <td style="padding:12px 14px;font-size:14px;text-align:right;font-weight:600;${i ? 'border-top:1px solid #e5e5ea;' : ''}">${esc(v)}</td></tr>`).join('')}
  </table>`;
}

export async function sendMail({ to, subject, html }) {
  const t = getTransport();
  if (!t || !to) {
    logger.info('E-mail skipped (SMTP not configured or no recipient)', { to, subject });
    return false;
  }
  try {
    await t.sendMail({ from: MAIL_FROM.value(), to, subject, html });
    logger.info('E-mail sent', { to, subject });
    return true;
  } catch (err) {
    logger.error('E-mail failed', { to, subject, err: err.message });
    return false;
  }
}

/* ---------- Templates ---------- */

export function paymentApprovedEmail({ name, plan, amount, expiresAt, uid, paymentId }) {
  const first = String(name || '').split(' ')[0] || 'Olá';
  return {
    subject: 'Pagamento aprovado — seu perfil está no ar ✅',
    html: layout({
      tone: '#34c759',
      title: 'Pagamento aprovado!',
      intro: `${esc(first)}, recebemos seu pagamento. Seu perfil já está visível para clientes no Guia Mão de Obra.`,
      body: detailsTable([
        ['Plano', plan.name],
        ['Valor', formatBRL(amount)],
        ['Válido até', fmtDate(expiresAt)],
        ['Pagamento nº', String(paymentId)],
      ]),
      cta: 'Ver meu perfil',
      ctaUrl: `${APP_URL.value()}/#/p/${uid}`,
    }),
  };
}

export function paymentFailedEmail({ name, plan, amount, reason }) {
  const first = String(name || '').split(' ')[0] || 'Olá';
  return {
    subject: 'Não conseguimos aprovar seu pagamento',
    html: layout({
      tone: '#ff3b30',
      title: 'Pagamento não aprovado',
      intro: `${esc(first)}, o pagamento do seu plano não foi aprovado e seu perfil ainda não está visível.`,
      body: detailsTable([
        ['Plano', plan?.name || '—'],
        ['Valor', amount ? formatBRL(amount) : '—'],
        ['Motivo', reason],
      ]),
      cta: 'Tentar novamente',
      ctaUrl: `${APP_URL.value()}/signup.html#plano`,
    }),
  };
}

export function expiringSoonEmail({ name, expiresAt }) {
  const first = String(name || '').split(' ')[0] || 'Olá';
  return {
    subject: 'Seu plano vence em breve',
    html: layout({
      tone: '#ff9500',
      title: 'Seu plano está acabando',
      intro: `${esc(first)}, seu perfil fica visível até <strong>${esc(fmtDate(expiresAt))}</strong>. Renove para continuar recebendo clientes sem interrupção — o tempo restante é somado ao novo plano.`,
      cta: 'Renovar agora',
      ctaUrl: `${APP_URL.value()}/signup.html#plano`,
    }),
  };
}

export function expiredEmail({ name }) {
  const first = String(name || '').split(' ')[0] || 'Olá';
  return {
    subject: 'Seu plano expirou — perfil pausado',
    html: layout({
      tone: '#8e8e93',
      title: 'Seu perfil foi pausado',
      intro: `${esc(first)}, seu plano expirou e seu perfil deixou de aparecer nas buscas. Seus dados e fotos continuam salvos: é só renovar para voltar ao ar na hora.`,
      cta: 'Renovar plano',
      ctaUrl: `${APP_URL.value()}/signup.html#plano`,
    }),
  };
}
