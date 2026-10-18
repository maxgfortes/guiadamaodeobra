# Guia Mão de Obra

A mobile-first web directory for finding local labor and services: electricians, plumbers, cleaners, painters, mechanics, tutors and more.

- **Clients** browse a category tree and contact professionals directly over WhatsApp, phone or e-mail. They don't need an account.
- **Professionals** sign in with Google and publish a profile with photo, banner, services, location, description and a portfolio.

Built with plain **HTML, CSS and vanilla JavaScript (ES modules)** on **Firebase** (Auth, Firestore, Storage, Hosting). The UI follows Apple's HIG from the iOS 7–14 era: translucent bars, grouped tables, system colors, SF typography and light/dark mode.

---

## Features

| Screen | What it does |
| --- | --- |
| **Home** | Search shortcut, category grid, most-searched niches, newest professionals, call-to-action for professionals |
| **Explore** | Tree navigation: **Category → Group → Specification → Professionals** |
| **Professionals list** | Everyone working in a niche, a city filter, a one-tap WhatsApp button on each row |
| **Profile** | Banner, avatar, name, specialty, location, WhatsApp / call / e-mail buttons, bio, services, portfolio with a full-screen viewer, share |
| **Search** | Matches niches instantly and professionals by name, niche, city or neighborhood. Ignores accents and keeps the query in the URL |
| **Profile tab** | Guests see a signup pitch. Signed-in professionals can view or edit their profile, check whether it is visible, and sign out |
| **Signup (`signup.html`)** | Google sign-in, then one form: photos, contacts, multi-select services, city and neighborhood, description, portfolio (up to 12 photos), a visibility switch |

Every action gives feedback: pressed states, toasts, an upload progress overlay, skeleton loaders, empty and error states, and vibration on devices that support it.

## Project structure

```
public/                    # Firebase Hosting root (static, no build step)
├── index.html             # App shell: logo navbar + routed content + tab bar
├── signup.html            # Professional signup / profile editor
├── manifest.webmanifest   # Installable PWA metadata
├── assets/                # App icons
├── css/app.css            # Design system (tokens, components, dark mode)
└── js/
    ├── app.js             # Entry: routes, tab bar, view lifecycle
    ├── signup.js          # Signup flow (auth, form, uploads, save)
    ├── firebase-config.js # ← your Firebase web config goes here
    ├── core/              # router.js (hash router), utils.js (escaping, phone, links)
    ├── data/              # categories.js (taxonomy), demo.js (sample professionals)
    ├── services/          # firebase.js (lazy SDK), professionals.js, auth.js, images.js
    ├── ui/                # icons, components, toast, sheet, lightbox
    └── views/             # home, explore, list, profile, search, me, notfound
firestore.rules            # Firestore security rules
firestore.indexes.json     # Composite indexes for list queries
storage.rules              # Storage security rules
firebase.json              # Hosting / emulator configuration
```

### Data model

**Taxonomy**: `public/js/data/categories.js`. The category tree is static and versioned with the code, so navigation is instant and costs no Firestore reads. Specification ids are unique across the whole tree. To add a niche, append it. Never rename an existing id, because profiles store these ids.

**Firestore `professionals/{uid}`** (the document id is the Firebase Auth uid):

```js
{
  name, nameLower,
  whatsapp, phone, email,          // digits only for phones
  specs: ['eletricista', ...],     // niche ids (1–12)
  categories: ['eletrica-hidraulica'],
  city, cityLower, neighborhood,
  bio,                             // ≤ 600 chars
  photoURL, bannerURL, portfolio: [url, ...],  // ≤ 12
  published: true,
  createdAt, updatedAt             // server timestamps
}
```

**Storage**: `professionals/{uid}/avatar-*.jpg`, `banner-*.jpg`, `portfolio/*.jpg`. Images are resized and re-encoded to JPEG in the browser before upload (avatar 640 px square; banner and portfolio 1600 px). This keeps uploads fast on mobile data.

### Security rules

- Anyone can read a profile with `published == true`. Owners can always read their own profile.
- A professional can only create, update or delete `professionals/{their uid}`.
- Every write is checked against the schema: allowed keys only, types and sizes, 1–12 services, image URLs, server timestamps, and `createdAt` can't change.
- In Storage, only the owner can write to their own folder, only images, and at most 5 MB each.
- Everything else is denied.

## Getting started

### 1. Run locally (demo mode, no setup)

```bash
npm run dev          # http://localhost:5173
```

While `js/firebase-config.js` still has its placeholder values, the app runs in **demo mode**. Browsing uses bundled sample professionals, and the signup form can be previewed but not saved.

### 2. Create the Firebase project

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method → Google**: enable it.
3. **Firestore Database**: create it in production mode.
4. **Storage**: enable it.
5. **Project settings → Your apps → Web app**: register an app and copy its config into `public/js/firebase-config.js`.
6. **Authentication → Settings → Authorized domains**: add your custom domain if you use one. `*.web.app` and `localhost` are already allowed.

```bash
cp .firebaserc.example .firebaserc   # set your project id
npx firebase-tools login
npm run deploy:rules                 # Firestore rules + indexes, Storage rules
npm run deploy:hosting               # publish /public
```

Once real professionals have signed up, set `appConfig.showDemoProfessionals = false` in `firebase-config.js` to hide the sample data.

### 3. Local development with emulators

```bash
npm run emulators                    # Auth, Firestore, Storage, Hosting (needs Java)
# open http://localhost:5000/?emulators
```

The `?emulators` flag works only on localhost. It connects the app to the Emulator Suite under a `demo-guia` project, so you don't need a real Firebase project. Google sign-in then shows the emulator's fake-account screen.

The full flow has been verified against the emulators: sign-in, compressed uploads, profile create and edit, listing by niche, and rejected writes (another user's uid, unknown keys, no services, unfiltered list).

## Design notes

- **Typography**: the SF Pro system stack (`-apple-system`), falling back to system fonts elsewhere. Sizes follow iOS text styles: Large Title 34, Title 22, Body 17, Footnote 13.
- **Colors**: iOS system colors, with separate light and dark values, used through CSS custom properties.
- **Components**: grouped inset tables, Settings-style icon tiles, translucent bars (`backdrop-filter`), a slide-up sheet, a progress overlay, an iOS switch, a segmented chip filter.
- **Motion**: push and pop slide transitions between screens, spring animations on sheets and toasts. Respects `prefers-reduced-motion`.
- **Performance**: no framework and no build step. The Firebase SDK loads only when needed, so first paint never waits for it. Images are compressed on the device and lazy-loaded.
- **Safety**: everything users enter is escaped before rendering (`esc()` in `core/utils.js`).

## Known limitations / next steps

- Search runs in the browser over the 300 most recently updated profiles, which is fine at MVP scale. Move to Algolia or Typesense as the directory grows.
- There are no reviews, ratings or moderation tools yet. Abuse would be handled manually in the Firebase console.

## Credits

Interface icons are adapted from [Feather Icons](https://feathericons.com) (MIT).

## License

MIT
