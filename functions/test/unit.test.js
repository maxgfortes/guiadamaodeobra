/**
 * Pure unit tests (no emulator): plan math, references, webhook signature.
 * Run: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { addMonths, getPlan, PLANS } from '../src/plans.js';
import { buildReference, parseReference, computeExpiry } from '../src/subscriptions.js';
import { verifyWebhookSignature, rejectionMessage } from '../src/mercadopago.js';

test('plans: 1, 3, 6 and 12 months exist with positive prices', () => {
  assert.deepEqual(Object.values(PLANS).map((p) => p.months), [1, 3, 6, 12]);
  for (const p of Object.values(PLANS)) assert.ok(p.price > 0);
  assert.equal(getPlan('nope'), null);
});

test('addMonths clamps to month end', () => {
  const d = addMonths(new Date(2026, 0, 31), 1); // Jan 31 → Feb 28
  assert.equal(d.getMonth(), 1);
  assert.equal(d.getDate(), 28);
  assert.equal(addMonths(new Date(2026, 4, 10), 12).getFullYear(), 2027);
});

test('reference roundtrip and rejection of unknown plans', () => {
  assert.deepEqual(parseReference(buildReference('abc123', 'anual')), { uid: 'abc123', planId: 'anual' });
  assert.equal(parseReference('abc123|vitalicio'), null);
  assert.equal(parseReference(''), null);
});

test('computeExpiry extends active subscriptions and restarts expired ones', () => {
  const now = new Date(2026, 5, 1);
  const future = { toDate: () => new Date(2026, 5, 20) };
  const past = { toDate: () => new Date(2026, 4, 1) };
  assert.equal(computeExpiry(future, 1, now).getTime(), new Date(2026, 6, 20).getTime());
  assert.equal(computeExpiry(past, 1, now).getTime(), new Date(2026, 6, 1).getTime());
  assert.equal(computeExpiry(null, 3, now).getTime(), new Date(2026, 8, 1).getTime());
});

test('webhook signature: valid, tampered and missing', () => {
  const secret = 's3cr3t';
  const ts = '1700000000';
  const manifest = `id:123456;request-id:req-1;ts:${ts};`;
  const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const signature = `ts=${ts},v1=${v1}`;
  assert.equal(verifyWebhookSignature({ signature, requestId: 'req-1', dataId: '123456', secret }), true);
  assert.equal(verifyWebhookSignature({ signature, requestId: 'req-1', dataId: '999', secret }), false);
  assert.equal(verifyWebhookSignature({ signature: undefined, requestId: 'req-1', dataId: '123456', secret }), false);
});

test('rejection messages are localized with a fallback', () => {
  assert.match(rejectionMessage('cc_rejected_insufficient_amount'), /insuficiente/);
  assert.match(rejectionMessage('whatever'), /recusado/i);
});
