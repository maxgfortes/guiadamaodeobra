/**
 * Minimal Mercado Pago REST client (no SDK dependency).
 * Docs: https://www.mercadopago.com.br/developers/pt/reference
 */
import crypto from 'node:crypto';

// MP_API_URL is only for local tests against a mock server (see test/).
const API = process.env.MP_API_URL || 'https://api.mercadopago.com';

export class MercadoPagoError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function mpRequest(accessToken, path, { method = 'GET', body, idempotencyKey } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
  if (!res.ok) {
    throw new MercadoPagoError(json?.message || `Mercado Pago HTTP ${res.status}`, res.status, json || text);
  }
  return json;
}

/** Create a card payment from a Card Payment Brick token. */
export function createCardPayment(accessToken, payload, idempotencyKey) {
  return mpRequest(accessToken, '/v1/payments', { method: 'POST', body: payload, idempotencyKey });
}

export function getPayment(accessToken, id) {
  return mpRequest(accessToken, `/v1/payments/${encodeURIComponent(id)}`);
}

/**
 * Validate the `x-signature` header of a webhook notification.
 * Manifest: `id:{data.id};request-id:{x-request-id};ts:{ts};`
 * https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export function verifyWebhookSignature({ signature, requestId, dataId, secret }) {
  if (!signature || !secret) return false;
  const parts = Object.fromEntries(
    String(signature).split(',').map((p) => p.trim().split('=').map((s) => s.trim())),
  );
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;
  // Alphanumeric ids must be lowercased per MP docs.
  const id = /^[a-z0-9]+$/i.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  let manifest = '';
  if (id) manifest += `id:${id};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(v1));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Human-readable (pt-BR) reason for a rejected card payment. */
export function rejectionMessage(statusDetail) {
  const map = {
    cc_rejected_insufficient_amount: 'Saldo ou limite insuficiente no cartão.',
    cc_rejected_bad_filled_security_code: 'Código de segurança (CVV) inválido.',
    cc_rejected_bad_filled_date: 'Data de validade do cartão inválida.',
    cc_rejected_bad_filled_card_number: 'Número do cartão inválido.',
    cc_rejected_bad_filled_other: 'Confira os dados do cartão.',
    cc_rejected_call_for_authorize: 'O banco emissor precisa autorizar o pagamento. Ligue para o seu banco e tente de novo.',
    cc_rejected_card_disabled: 'Cartão desativado. Ative-o com o seu banco ou use outro cartão.',
    cc_rejected_duplicated_payment: 'Pagamento duplicado: você já fez um pagamento com esse valor.',
    cc_rejected_high_risk: 'Pagamento recusado pela análise de segurança. Tente outro cartão.',
    cc_rejected_max_attempts: 'Limite de tentativas atingido. Use outro cartão.',
    cc_rejected_blacklist: 'Pagamento não autorizado. Use outro cartão.',
    cc_rejected_card_error: 'Não foi possível processar o cartão. Tente novamente.',
    cc_rejected_invalid_installments: 'Número de parcelas não aceito para este cartão.',
    cc_amount_rate_limit_exceeded: 'Limite do meio de pagamento excedido. Use outro cartão.',
  };
  return map[statusDetail] || 'Pagamento recusado. Tente outro cartão ou fale com o seu banco.';
}
