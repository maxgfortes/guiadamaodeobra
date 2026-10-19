/**
 * Guia Mão de Obra — Cloud Functions (2nd gen, São Paulo region).
 *
 *   createPayment         callable  Charge a card (Mercado Pago Card Payment Brick token)
 *   mpWebhook             https     Mercado Pago payment notifications (/api/mp-webhook)
 *   expireSubscriptions   schedule  Hourly: renewal reminders + deactivate expired profiles
 *   adminBootstrap        callable  Grant the admin claim to e-mails listed in ADMIN_EMAILS
 *   adminSetRole          callable  Grant/revoke admin for another user (admins only)
 *   adminSetActive        callable  Manually grant days / revoke a profile (admins only)
 *   adminDeleteUser       callable  Delete Auth user + profile + Storage files (admins only)
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { setGlobalOptions, logger } from 'firebase-functions';
import { onCall, onRequest, HttpsError } from 'firebase-functions/https';
import { onSchedule } from 'firebase-functions/scheduler';

import {
  REGION, TIME_ZONE, APP_URL, adminEmails,
  MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, SMTP_PASS,
} from './config.js';
import { getPlan } from './plans.js';
import { createCardPayment, getPayment, verifyWebhookSignature, MercadoPagoError } from './mercadopago.js';
import { applyPayment, buildReference, sweepSubscriptions } from './subscriptions.js';

initializeApp();
setGlobalOptions({ region: REGION, maxInstances: 10 });

const db = () => getFirestore();

/* ==========================================================================
   Payments
   ========================================================================== */

export const createPayment = onCall(
  { secrets: [MP_ACCESS_TOKEN, SMTP_PASS], timeoutSeconds: 60 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Entre com sua conta para pagar.');

    const { planId, token, paymentMethodId, issuerId, installments, payer } = request.data || {};
    const plan = getPlan(planId);
    if (!plan) throw new HttpsError('invalid-argument', 'Plano inválido.');
    if (!token || typeof token !== 'string') throw new HttpsError('invalid-argument', 'Dados do cartão ausentes.');
    if (!paymentMethodId) throw new HttpsError('invalid-argument', 'Bandeira do cartão não identificada.');

    const proSnap = await db().doc(`professionals/${uid}`).get();
    if (!proSnap.exists) throw new HttpsError('failed-precondition', 'Salve seu perfil antes de pagar.');
    const pro = proSnap.data();

    const email = String(payer?.email || pro.email || request.auth.token.email || '').trim();
    const n = Math.min(Math.max(parseInt(installments, 10) || 1, 1), 12);

    const payload = {
      transaction_amount: plan.price, // server-side price, never trusted from client
      token,
      description: `Guia Mão de Obra — Plano ${plan.name}`,
      installments: n,
      payment_method_id: String(paymentMethodId),
      ...(issuerId ? { issuer_id: Number(issuerId) || String(issuerId) } : {}),
      payer: {
        email,
        ...(payer?.identification?.number
          ? { identification: { type: String(payer.identification.type || 'CPF'), number: String(payer.identification.number).replace(/\D/g, '') } }
          : {}),
      },
      external_reference: buildReference(uid, plan.id),
      notification_url: `${APP_URL.value()}/api/mp-webhook`,
      statement_descriptor: 'GUIAMAODEOBRA',
      metadata: { uid, plan_id: plan.id },
    };

    let payment;
    try {
      // The card token is single-use, so it makes a natural idempotency key.
      payment = await createCardPayment(MP_ACCESS_TOKEN.value(), payload, `${uid}-${token}`.slice(0, 64));
    } catch (err) {
      logger.error('Mercado Pago payment failed', { uid, status: err.status, body: err.body });
      if (err instanceof MercadoPagoError && err.status < 500) {
        throw new HttpsError('invalid-argument', 'Não foi possível processar o cartão. Confira os dados e tente novamente.');
      }
      throw new HttpsError('unavailable', 'Mercado Pago indisponível no momento. Tente novamente em instantes.');
    }

    const result = await applyPayment(payment);
    return {
      paymentId: String(payment.id),
      status: payment.status,
      statusDetail: payment.status_detail,
      message: result.message,
      expiresAt: result.expiresAt ? result.expiresAt.toISOString() : null,
    };
  },
);

/**
 * Mercado Pago webhook. Configure in the MP dashboard (Suas integrações →
 * Webhooks) with the URL https://<site>/api/mp-webhook and event "Pagamentos".
 * The payment is always re-fetched from the API, so the payload is never trusted.
 */
export const mpWebhook = onRequest(
  { secrets: [MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, SMTP_PASS], timeoutSeconds: 60, invoker: 'public' },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

    const type = req.body?.type || req.query.type || req.query.topic;
    const dataId = req.query['data.id'] || req.body?.data?.id || req.query.id;
    if (type !== 'payment' || !dataId) { res.status(200).send('ignored'); return; }

    const secret = MP_WEBHOOK_SECRET.value();
    if (secret) {
      const ok = verifyWebhookSignature({
        signature: req.get('x-signature'),
        requestId: req.get('x-request-id'),
        dataId,
        secret,
      });
      if (!ok) {
        logger.warn('Invalid webhook signature', { dataId });
        res.status(401).send('invalid signature');
        return;
      }
    }

    try {
      const payment = await getPayment(MP_ACCESS_TOKEN.value(), dataId);
      const result = await applyPayment(payment);
      logger.info('Webhook processed', { id: dataId, status: payment.status, changed: result.changed });
      res.status(200).send('ok');
    } catch (err) {
      logger.error('Webhook processing failed', { dataId, err: err.message });
      // Non-2xx makes Mercado Pago retry later.
      res.status(500).send('error');
    }
  },
);

/* ==========================================================================
   Scheduled: reminders + expiration
   ========================================================================== */

export const expireSubscriptions = onSchedule(
  { schedule: 'every 60 minutes', timeZone: TIME_ZONE, secrets: [SMTP_PASS], timeoutSeconds: 300 },
  async () => {
    const result = await sweepSubscriptions();
    logger.info('Subscriptions sweep done', result);
  },
);

/* ==========================================================================
   Admin
   ========================================================================== */

function requireAdmin(request) {
  if (request.auth?.token?.admin !== true) {
    throw new HttpsError('permission-denied', 'Acesso restrito a administradores.');
  }
}

/** First-admin bootstrap: e-mails in the ADMIN_EMAILS param may claim admin. */
export const adminBootstrap = onCall(async (request) => {
  const token = request.auth?.token;
  if (!token) throw new HttpsError('unauthenticated', 'Entre com sua conta.');
  if (token.admin === true) return { admin: true };
  const allowed = adminEmails();
  if (!token.email_verified || !allowed.includes(String(token.email).toLowerCase())) {
    throw new HttpsError('permission-denied', 'Esta conta não é administradora.');
  }
  const user = await getAuth().getUser(request.auth.uid);
  await getAuth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
  logger.info('Admin bootstrapped', { email: token.email });
  return { admin: true };
});

export const adminSetRole = onCall(async (request) => {
  requireAdmin(request);
  const { email, admin } = request.data || {};
  if (!email) throw new HttpsError('invalid-argument', 'Informe o e-mail.');
  let user;
  try {
    user = await getAuth().getUserByEmail(String(email).trim());
  } catch {
    throw new HttpsError('not-found', 'Usuário não encontrado. Ele precisa entrar no site ao menos uma vez.');
  }
  if (user.uid === request.auth.uid && !admin) throw new HttpsError('failed-precondition', 'Você não pode remover seu próprio acesso.');
  await getAuth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: Boolean(admin) });
  return { uid: user.uid, admin: Boolean(admin) };
});

/**
 * { uid, active: true, days } → extends the subscription by `days`.
 * { uid, active: false }      → revokes immediately.
 */
export const adminSetActive = onCall(async (request) => {
  requireAdmin(request);
  const { uid, active, days } = request.data || {};
  if (!uid) throw new HttpsError('invalid-argument', 'uid obrigatório.');
  const ref = db().doc(`professionals/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Profissional não encontrado.');

  if (!active) {
    await ref.update({
      active: false,
      'subscription.status': 'revoked',
      'subscription.updatedAt': FieldValue.serverTimestamp(),
    });
    return { active: false };
  }

  const n = Math.min(Math.max(parseInt(days, 10) || 30, 1), 3660);
  const current = snap.get('subscription.expiresAt')?.toDate();
  const base = current && current > new Date() ? current : new Date();
  const expiresAt = new Date(base.getTime() + n * 864e5);
  await ref.update({
    active: true,
    subscription: {
      ...(snap.get('subscription') || {}),
      status: 'active',
      planId: snap.get('subscription.planId') || 'cortesia',
      expiresAt: Timestamp.fromDate(expiresAt),
      grantedBy: request.auth.token.email || request.auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
  });
  return { active: true, expiresAt: expiresAt.toISOString() };
});

export const adminDeleteUser = onCall({ timeoutSeconds: 120 }, async (request) => {
  requireAdmin(request);
  const { uid } = request.data || {};
  if (!uid || typeof uid !== 'string') throw new HttpsError('invalid-argument', 'uid obrigatório.');
  if (uid === request.auth.uid) throw new HttpsError('failed-precondition', 'Você não pode excluir a própria conta por aqui.');

  // Storage files, profile doc, then the Auth account. Payments are kept for accounting.
  await getStorage().bucket().deleteFiles({ prefix: `professionals/${uid}/` }).catch((err) =>
    logger.warn('Storage cleanup failed', { uid, err: err.message }));
  await db().doc(`professionals/${uid}`).delete();
  await getAuth().deleteUser(uid).catch((err) => {
    if (err.code !== 'auth/user-not-found') throw err;
  });
  logger.info('User deleted by admin', { uid, by: request.auth.token.email });
  return { deleted: true };
});

