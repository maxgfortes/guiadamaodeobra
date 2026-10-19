# Guia Mão de Obra

A mobile-first web marketplace for finding local labor and services: electricians, plumbers, cleaners, painters, mechanics, tutors and more.

- **Clients** browse a category tree and contact professionals directly over WhatsApp, phone or e-mail. They don't need an account.
- **Professionals** sign in with Google, build a profile (photo, banner, services, location, description, portfolio) and pay for a plan by card. Once **Mercado Pago** approves the payment, the profile goes live automatically.
- **Admins** manage professionals, payments, home banners and other admins from `admin.html`.

Built with plain **HTML, CSS and vanilla JavaScript (ES modules)** on **Firebase** (Auth, Firestore, Storage, Hosting, **Cloud Functions 2nd gen**), with **Mercado Pago** for payments. The UI follows Apple's HIG from the iOS 7–14 era and installs as a **PWA** that works offline.

---

## Features

| Area | What it does |
| --- | --- |
| **Home** | Rotating image banners served from Firestore (each opens its link in a new tab; managed in the admin), search shortcut, category grid, most-searched niches, newest professionals |
| **Explore** | Tree navigation: **Category → Group → Specification → Professionals** |
| **Professionals list** | Paid and visible professionals in a niche, a city filter, a one-tap WhatsApp button |
| **Profile** | Banner, avatar, name, specialty, location, WhatsApp / call / e-mail buttons, bio, services, portfolio with a full-screen viewer, share |
| **Search** | Niches and professionals. Ignores accents |
| **Signup (`signup.html`)** | Google sign-in → profile form → **plan + card payment** → profile live |
| **Plans** | 1, 3, 6 or 12 months, prepaid. Renewing adds the new period to the time left |
| **Profile tab** | Plan status, expiry date, renew shortcut, edit profile, install the app |
| **Admin (`admin.html`)** | Overview (counts, revenue), professionals (search, filter, +30 days / +1 year, deactivate, delete user), payments, banners (image upload or URL + link, reorder, on/off), admins (grant or revoke) |
| **E-mails** | Payment approved, payment failed (with the card's rejection reason), renewal reminder 3 days before expiry, plan expired |
| **PWA** | Installable (manifest, maskable icon, shortcuts), service worker with offline shell, update prompt, `viewport-fit=cover` + safe areas, native bounce scrolling |
| **Navigation** | Screens stay alive like native tabs: switching tabs or going back re-attaches the screen without reloading, keeping its scroll position. Each tab remembers its last screen; tapping the active tab pops to its root |
| **Motion** | iOS push/pop transitions (View Transitions API, CSS fallback), staggered list entrances, image fade-in, spring sheets, tab icon bounce |

## How payments work

```
Professional ─► signup.html: profile form ─► saved (active = false, not listed)
           └──► plan screen ─► Mercado Pago Card Payment Brick (card is tokenized by MP)
                    │ token
                    ▼
     createPayment (Cloud Function)  ── POST /v1/payments (server-side price) ──► Mercado Pago
                    │                                                               │
                    ├─ approved ─► professional.active = true, expiresAt = +N months │
                    ├─ in_process ─► "under review" screen (live listener)          │
                    └─ rejected ─► reason shown + "failed" e-mail                   │
                                                                                    ▼
     mpWebhook (/api/mp-webhook) ◄── notification (signature verified) ─── status changes
          └─► re-fetches the payment from the MP API ─► same idempotent applyPayment()

     expireSubscriptions (hourly) ─► reminder e-mail 3 days before ─► deactivate + e-mail on expiry
```

- **Prices live on the server** (`functions/src/plans.js`). The client never sends the amount that gets charged. `public/js/data/plans.js` is a copy used only for display, so keep the two in sync.
- **Idempotent.** Every payment is recorded in `payments/{id}`, together with whether it already granted time. Webhook retries never add time twice or send duplicate e-mails.
- **Refunds and chargebacks** of the payment that granted the current period deactivate the profile.
- Card data never touches our code or database (Mercado Pago tokenizes it in the Brick).

## Project structure

```
public/                    # Firebase Hosting root (static, no build step)
├── index.html             # App shell: logo navbar + routed content + tab bar
├── signup.html            # Professional signup / editor / payment
├── admin.html             # Admin console
├── sw.js                  # Service worker (offline shell, caching strategies)
├── manifest.webmanifest   # PWA metadata
├── css/app.css            # Design system (tokens, components, motion, dark mode)
└── js/
    ├── app.js             # Main app: routes, tab bar, view lifecycle
    ├── signup.js          # Signup flow (auth, form, uploads, save → plans)
    ├── admin.js           # Admin console
    ├── firebase-config.js # Firebase web config + Mercado Pago PUBLIC key
    ├── core/              # router, utils, pwa (SW + install)
    ├── data/              # categories (taxonomy), plans (display)
    ├── services/          # firebase (lazy SDK + callables), professionals, auth,
    │                      # images, banners, payments (Brick + createPayment)
    ├── ui/                # icons, components, toast, sheet, action sheet,
    │                      # lightbox, carousel, motion
    └── views/             # home, explore, list, profile, search, me, plans, notfound
functions/                 # Cloud Functions (Node 22, ESM)
├── src/index.js           # createPayment, mpWebhook, expireSubscriptions, admin*
├── src/subscriptions.js   # applyPayment state machine + hourly sweep
├── src/mercadopago.js     # REST client, webhook signature check, rejection messages
├── src/email.js           # SMTP (nodemailer) + HTML templates
├── src/plans.js           # Plans and prices (source of truth)
├── src/config.js          # Params and secrets
└── test/                  # unit + emulator integration tests
firestore.rules · firestore.indexes.json · storage.rules · firebase.json
```

### Data model

**`professionals/{uid}`** (the document id is the Firebase Auth uid)

| Field | Written by | Notes |
| --- | --- | --- |
| `name`, `whatsapp`, `phone`, `email`, `specs[]`, `categories[]`, `city`, `neighborhood`, `bio`, `photoURL`, `bannerURL`, `portfolio[]`, `published` | professional | Validated by the rules |
| `active` | **server only** | `true` while a paid period is running |
| `subscription { status, planId, expiresAt, lastPaymentId, reminderFor }` | **server only** | `status`: `active` / `expired` / `revoked` / `refunded` |

A profile is publicly visible only when `published == true` (the professional's own switch) **and** `active == true` (paid).

**`payments/{mpPaymentId}`**: `uid`, `planId`, `amount`, `installments`, `status`, `statusDetail`, `applied`, `createdAt`, `approvedAt`. Written only by Functions. Readable by the payer and by admins.

**`banners/{id}`**: `imageURL` (required), `link` (`https://…`, opened in a new tab), `alt`, `active`, `order`. Anyone can read them; only admins can write.

### Security

- **Firestore.** A professional can only write their own profile. Server-only fields (`active`, `subscription`, `createdAt`) can't be created or changed by the client. Every write is checked against the schema. Payments can't be written from the client. Banners need the `admin` claim. Everything else is denied.
- **Storage.** Only the owner writes to their own folder, and `banners/` only by admins. Images only, at most 5 MB each.
- **Functions.** Callables check authentication or the `admin` claim on the server. The webhook verifies Mercado Pago's `x-signature` (HMAC-SHA256) and always re-fetches the payment from the API.

## Setup

### 1. Firebase project

The web config for the `guiadamaodeobra` project is already in `public/js/firebase-config.js`, and `.firebaserc` points to it. In the Firebase console:

1. **Authentication → Sign-in method → Google**: enable it.
2. **Firestore Database**: create it.
3. **Storage**: enable it.
4. **Upgrade to the Blaze plan.** Cloud Functions need it, and calling the Mercado Pago API (outbound network) needs it too.

### 2. Mercado Pago

1. Create an application at <https://www.mercadopago.com.br/developers/panel/app>, product **Checkout Transparente / Bricks**.
2. Copy the **Public Key** into `appConfig.mercadoPagoPublicKey` in `public/js/firebase-config.js`.
3. Keep the **Access Token** for the secret below. While testing, use the test credentials (`TEST-…`) and [test cards](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/additional-content/your-integrations/test/cards).
4. **Webhooks** (Your integrations → Webhooks): set the URL to `https://guiadamaodeobra.web.app/api/mp-webhook`, select the **Payments** event, and copy the **signing secret**.

### 3. Secrets and parameters for Functions

```bash
npx firebase-tools login
npx firebase-tools functions:secrets:set MP_ACCESS_TOKEN     # Access Token (APP_USR-… / TEST-…)
npx firebase-tools functions:secrets:set MP_WEBHOOK_SECRET   # webhook signing secret
npx firebase-tools functions:secrets:set SMTP_PASS           # SMTP password (Gmail: app password)
```

On the first deploy the CLI asks for these parameters (it saves them in `functions/.env.guiadamaodeobra`):

| Param | Example |
| --- | --- |
| `APP_URL` | `https://guiadamaodeobra.web.app` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` | `smtp.gmail.com` / `465` / `seuemail@gmail.com` |
| `MAIL_FROM` | `Guia Mão de Obra <seuemail@gmail.com>` |
| `ADMIN_EMAILS` | `voce@gmail.com,socio@gmail.com` (these accounts can turn themselves into admins) |

If `SMTP_USER` is empty, e-mails are logged and skipped. Payments keep working.

### 4. Deploy

```bash
cd functions && npm install && cd ..
npm run deploy          # hosting + rules + indexes + functions
```

Step-by-step checklist in Portuguese: [`PRODUCAO.md`](PRODUCAO.md).

Then open `https://guiadamaodeobra.web.app/admin.html` with an account listed in `ADMIN_EMAILS`. The first visit grants the admin claim automatically.

## Development and tests

```bash
npm run dev                                   # static server against the real Firebase project (no SW on localhost)
npm run emulators                             # Auth, Firestore, Storage, Functions, Hosting (needs Java)
# open http://localhost:5000/?emulators       → the app talks to the emulators
cd functions && npm test                      # unit tests (plans, signature, references)
cd functions && npm run test:integration      # subscription state machine on the Firestore emulator
```

For emulator runs, Functions read `functions/.env.local` and `functions/.secret.local` (both gitignored). `MP_API_URL` can point the Mercado Pago client at a local mock server.

**Verified locally against the emulators and a Mercado Pago mock:**
- Signup goes to the plan screen.
- The client can't activate its own profile.
- A rejected card shows its reason.
- An approved payment activates the profile for the plan period.
- A pending payment, later approved via webhook, adds time.
- A webhook with an invalid signature gets 401, and a webhook retry changes nothing.
- An inactive profile stays out of public lists.
- A non-admin is blocked from admin functions.
- The admin console works: stats, +30 days, payments, banners (created in the admin and shown on the home page), and deleting a user.
- The service worker runs, offline reload works, and View Transitions work.

## Design notes

- **Typography and colors:** the SF Pro stack and iOS system colors, with separate light and dark values, through CSS custom properties.
- **Components:** grouped tables, Settings-style icon tiles, translucent bars, slide-up sheet, iOS action sheet, segmented control, switch, progress overlay.
- **Motion:** only `transform` and `opacity` are animated. Push transitions use View Transitions with the bars pinned in place.
- **Production only:** no sample data ships with the app. Lists start empty until professionals sign up and pay.
- **Performance:** no framework and no build step. The Firebase and Mercado Pago SDKs load only when needed. Images are compressed on the device and lazy-loaded. Static assets use stale-while-revalidate.

## Known limitations / next steps

- Search runs in the browser over the 300 most recently updated profiles. Move to Algolia or Typesense as the directory grows.
- Plans are prepaid and don't renew automatically. Recurring billing could use Mercado Pago `preapproval`.
- There are no reviews or ratings yet.

## Credits

Interface icons are adapted from [Feather Icons](https://feathericons.com) (MIT).

## License

MIT
