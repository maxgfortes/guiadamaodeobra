/**
 * Runtime parameters and secrets.
 *
 * Secrets (set once with `firebase functions:secrets:set NAME`):
 *   MP_ACCESS_TOKEN     Mercado Pago access token (APP_USR-… or TEST-…)
 *   MP_WEBHOOK_SECRET   Mercado Pago webhook signing secret
 *   SMTP_PASS           SMTP password / app password
 *
 * Plain params (prompted on first deploy, stored in functions/.env.<project>):
 *   APP_URL, SMTP_HOST, SMTP_PORT, SMTP_USER, MAIL_FROM, ADMIN_EMAILS
 */
import { defineSecret, defineString, defineInt } from 'firebase-functions/params';

export const REGION = 'southamerica-east1';
export const TIME_ZONE = 'America/Sao_Paulo';

export const MP_ACCESS_TOKEN = defineSecret('MP_ACCESS_TOKEN');
export const MP_WEBHOOK_SECRET = defineSecret('MP_WEBHOOK_SECRET');
export const SMTP_PASS = defineSecret('SMTP_PASS');

export const APP_URL = defineString('APP_URL', { default: 'https://guiadamaodeobra.web.app' });
export const SMTP_HOST = defineString('SMTP_HOST', { default: 'smtp.gmail.com' });
export const SMTP_PORT = defineInt('SMTP_PORT', { default: 465 });
export const SMTP_USER = defineString('SMTP_USER', { default: '' });
export const MAIL_FROM = defineString('MAIL_FROM', { default: 'Guia Mão de Obra <no-reply@guiadamaodeobra.web.app>' });
/** Comma-separated e-mails allowed to bootstrap themselves as admins. */
export const ADMIN_EMAILS = defineString('ADMIN_EMAILS', { default: '' });

export const adminEmails = () =>
  ADMIN_EMAILS.value().split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

/** Days before expiry when the renewal reminder e-mail is sent. */
export const REMINDER_DAYS = 3;
