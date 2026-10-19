/**
 * Integration tests for the subscription state machine.
 * Requires the Firestore emulator:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node --test test/integration.test.js
 * (skipped automatically when the emulator variable is not set)
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let db, Timestamp, applyPayment, sweepSubscriptions;

before(async () => {
  if (!enabled) return;
  const { initializeApp } = await import('firebase-admin/app');
  const fsMod = await import('firebase-admin/firestore');
  initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-guia' });
  db = fsMod.getFirestore();
  Timestamp = fsMod.Timestamp;
  ({ applyPayment, sweepSubscriptions } = await import('../src/subscriptions.js'));
});

const uid = `it-${Date.now()}`;
const pay = (id, status, planId = 'mensal', extra = {}) => ({
  id, status, status_detail: status === 'approved' ? 'accredited' : 'cc_rejected_insufficient_amount',
  external_reference: `${uid}|${planId}`, transaction_amount: 29.9, installments: 1,
  payment_method_id: 'visa', payer: { email: 'pro@teste.com' }, ...extra,
});
const pro = () => db.doc(`professionals/${uid}`).get().then((s) => s.data());

test('approved payment activates for the plan duration, exactly once', { skip: !enabled }, async () => {
  await db.doc(`professionals/${uid}`).set({ name: 'Teste', email: 'pro@teste.com', published: true });
  const r1 = await applyPayment(pay(1001, 'approved'));
  assert.equal(r1.changed, true);
  const p1 = await pro();
  assert.equal(p1.active, true);
  const days = (p1.subscription.expiresAt.toMillis() - Date.now()) / 864e5;
  assert.ok(days > 27 && days < 32, `~1 month, got ${days}`);

  // Webhook retry of the same payment: no extra time.
  const r2 = await applyPayment(pay(1001, 'approved'));
  assert.equal(r2.changed, false);
  assert.equal((await pro()).subscription.expiresAt.toMillis(), p1.subscription.expiresAt.toMillis());
});

test('renewal extends from the current expiry', { skip: !enabled }, async () => {
  const before = (await pro()).subscription.expiresAt.toMillis();
  await applyPayment(pay(1002, 'approved', 'trimestral'));
  const p = await pro();
  const addedDays = (p.subscription.expiresAt.toMillis() - before) / 864e5;
  assert.ok(addedDays > 88 && addedDays < 93, `~3 months added, got ${addedDays}`);
  assert.equal(p.subscription.planId, 'trimestral');
});

test('rejected payment is recorded and changes nothing', { skip: !enabled }, async () => {
  const before = await pro();
  const r = await applyPayment(pay(1003, 'rejected'));
  assert.match(r.message, /insuficiente/);
  const after = await pro();
  assert.equal(after.subscription.expiresAt.toMillis(), before.subscription.expiresAt.toMillis());
  assert.equal((await db.doc('payments/1003').get()).get('status'), 'rejected');
});

test('refund of the last granting payment deactivates', { skip: !enabled }, async () => {
  await applyPayment(pay(1002, 'refunded', 'trimestral'));
  const p = await pro();
  assert.equal(p.active, false);
  assert.equal(p.subscription.status, 'refunded');
});

test('sweep expires overdue profiles and reminds those about to expire', { skip: !enabled }, async () => {
  const past = Timestamp.fromMillis(Date.now() - 1000);
  const soon = Timestamp.fromMillis(Date.now() + 2 * 864e5);
  await db.doc(`professionals/${uid}-a`).set({ name: 'A', email: 'a@t.com', active: true, subscription: { status: 'active', expiresAt: past } });
  await db.doc(`professionals/${uid}-b`).set({ name: 'B', email: 'b@t.com', active: true, subscription: { status: 'active', expiresAt: soon } });
  const r1 = await sweepSubscriptions();
  assert.ok(r1.expired >= 1 && r1.reminders >= 1);
  const a = (await db.doc(`professionals/${uid}-a`).get()).data();
  const b = (await db.doc(`professionals/${uid}-b`).get()).data();
  assert.equal(a.active, false);
  assert.equal(a.subscription.status, 'expired');
  assert.equal(b.active, true);
  assert.equal(b.subscription.reminderFor, soon.toMillis());
  // Second sweep: no duplicate reminder for B.
  const r2 = await sweepSubscriptions();
  assert.equal(r2.reminders, 0);
});
