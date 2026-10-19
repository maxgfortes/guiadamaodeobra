/**
 * Subscription state machine, driven by Mercado Pago payments.
 *
 * `applyPayment` is idempotent: it is called both right after the card is
 * charged (callable) and on every webhook notification for the same payment.
 * The `payments/{id}` document records whether that payment already granted
 * time, so a plan is never credited twice and e-mails fire once per change.
 *
 * Professional doc fields owned by the server (clients cannot write them):
 *   active: boolean                       listed in the directory?
 *   subscription: {
 *     status: 'active' | 'expired' | 'revoked' | 'refunded'
 *     planId, expiresAt (Timestamp), lastPaymentId, updatedAt,
 *     reminderFor?: number                expiresAt millis already reminded
 *   }
 */
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { getPlan, addMonths } from './plans.js';
import { rejectionMessage } from './mercadopago.js';
import { sendMail, paymentApprovedEmail, paymentFailedEmail, expiringSoonEmail, expiredEmail } from './email.js';
import { REMINDER_DAYS } from './config.js';

export const REF_SEPARATOR = '|';

/** external_reference = "<uid>|<planId>" */
export function buildReference(uid, planId) {
  return `${uid}${REF_SEPARATOR}${planId}`;
}

export function parseReference(ref) {
  const [uid, planId] = String(ref || '').split(REF_SEPARATOR);
  return uid && getPlan(planId) ? { uid, planId } : null;
}

/** New expiry: extend from the current expiry if still active, else from now. */
export function computeExpiry(currentExpiresAt, months, now = new Date()) {
  const current = currentExpiresAt?.toDate?.() || null;
  const base = current && current > now ? current : now;
  return addMonths(base, months);
}

const FAILED = new Set(['rejected', 'cancelled']);
const REVERSED = new Set(['refunded', 'charged_back']);

/**
 * Persist a Mercado Pago payment and update the professional accordingly.
 * @returns {{ status, statusDetail, message, expiresAt?: Date, changed: boolean }}
 */
export async function applyPayment(payment) {
  const ref = parseReference(payment.external_reference);
  if (!ref) {
    logger.warn('Payment without a valid external_reference ignored', { id: payment.id });
    return { status: payment.status, changed: false, ignored: true };
  }
  const { uid, planId } = ref;
  const plan = getPlan(planId);
  const db = getFirestore();
  const payRef = db.doc(`payments/${payment.id}`);
  const proRef = db.doc(`professionals/${uid}`);

  const result = await db.runTransaction(async (tx) => {
    const [paySnap, proSnap] = await Promise.all([tx.get(payRef), tx.get(proRef)]);
    const prev = paySnap.exists ? paySnap.data() : null;
    const pro = proSnap.exists ? proSnap.data() : null;
    const changed = prev?.status !== payment.status;
    const out = {
      status: payment.status,
      statusDetail: payment.status_detail,
      changed,
      name: pro?.name || '',
      email: pro?.email || payment.payer?.email || '',
    };

    const record = {
      uid,
      planId,
      name: pro?.name || '',
      payerEmail: payment.payer?.email || '',
      amount: payment.transaction_amount,
      installments: payment.installments || 1,
      method: payment.payment_method_id || '',
      status: payment.status,
      statusDetail: payment.status_detail || '',
      updatedAt: FieldValue.serverTimestamp(),
      ...(paySnap.exists ? {} : { createdAt: FieldValue.serverTimestamp(), applied: false }),
    };

    if (payment.status === 'approved' && !prev?.applied) {
      if (!pro) {
        // Paid before the profile existed: keep the credit pending on the payment.
        logger.error('Approved payment for missing professional', { uid, id: payment.id });
      } else {
        const expiresAt = computeExpiry(pro.subscription?.expiresAt, plan.months);
        tx.update(proRef, {
          active: true,
          subscription: {
            status: 'active',
            planId,
            expiresAt: Timestamp.fromDate(expiresAt),
            lastPaymentId: String(payment.id),
            updatedAt: FieldValue.serverTimestamp(),
          },
        });
        record.applied = true;
        record.approvedAt = FieldValue.serverTimestamp();
        out.expiresAt = expiresAt;
      }
    } else if (REVERSED.has(payment.status) && prev?.applied && pro?.subscription?.lastPaymentId === String(payment.id)) {
      // Refund / chargeback of the payment that granted the current period.
      tx.update(proRef, {
        active: false,
        'subscription.status': 'refunded',
        'subscription.updatedAt': FieldValue.serverTimestamp(),
      });
    }

    tx.set(payRef, record, { merge: true });
    return out;
  });

  result.message = payment.status === 'approved'
    ? 'Pagamento aprovado! Seu perfil já está no ar.'
    : FAILED.has(payment.status)
      ? rejectionMessage(payment.status_detail)
      : 'Pagamento em análise. Avisaremos por e-mail assim que for aprovado.';

  // E-mails only on state transitions (webhook retries won't resend).
  if (result.changed) {
    if (payment.status === 'approved' && result.expiresAt) {
      await sendMail({
        to: result.email,
        ...paymentApprovedEmail({ name: result.name, plan, amount: payment.transaction_amount, expiresAt: result.expiresAt, uid, paymentId: payment.id }),
      });
    } else if (FAILED.has(payment.status)) {
      await sendMail({
        to: result.email,
        ...paymentFailedEmail({ name: result.name, plan, amount: payment.transaction_amount, reason: rejectionMessage(payment.status_detail) }),
      });
    }
  }
  return result;
}

/**
 * Hourly sweep: deactivate expired profiles and send one renewal reminder
 * per expiry date, REMINDER_DAYS before it.
 */
export async function sweepSubscriptions(now = Timestamp.now()) {
  const col = getFirestore().collection('professionals');

  const expired = await col.where('active', '==', true).where('subscription.expiresAt', '<=', now).get();
  for (const doc of expired.docs) {
    await doc.ref.update({
      active: false,
      'subscription.status': 'expired',
      'subscription.updatedAt': FieldValue.serverTimestamp(),
    });
    await sendMail({ to: doc.get('email'), ...expiredEmail({ name: doc.get('name') }) });
  }

  const soon = Timestamp.fromMillis(now.toMillis() + REMINDER_DAYS * 864e5);
  const expiring = await col.where('active', '==', true).where('subscription.expiresAt', '<=', soon).get();
  let reminders = 0;
  for (const doc of expiring.docs) {
    const expiresAt = doc.get('subscription.expiresAt');
    if (!expiresAt || expiresAt.toMillis() <= now.toMillis()) continue;
    if (doc.get('subscription.reminderFor') === expiresAt.toMillis()) continue;
    await sendMail({ to: doc.get('email'), ...expiringSoonEmail({ name: doc.get('name'), expiresAt: expiresAt.toDate() }) });
    await doc.ref.update({ 'subscription.reminderFor': expiresAt.toMillis() });
    reminders++;
  }
  return { expired: expired.size, reminders };
}
