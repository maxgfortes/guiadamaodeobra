/**
 * Firebase web configuration.
 *
 * Replace the placeholder values with your project's config
 * (Firebase console → Project settings → Your apps → Web app).
 * These values are NOT secrets: access is enforced by the security rules
 * in /firestore.rules and /storage.rules.
 *
 * While the placeholders are in place the app runs in DEMO MODE:
 * browsing uses bundled sample professionals and signup is disabled.
 */
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

/** App-level switches. */
export const appConfig = {
  /** Mix bundled sample professionals into results (handy for a fresh project). */
  showDemoProfessionals: true,
  /** Firebase JS SDK version loaded from the gstatic CDN. */
  sdkVersion: '10.12.2',
};

/**
 * Local development against the Firebase Emulator Suite:
 *   npm run emulators   →   open http://localhost:5000/?emulators
 * The flag is remembered for the tab session so hash navigation keeps it.
 */
const EMU_KEY = 'gmo:emulators';
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
let emu = false;
try {
  if (isLocal && new URLSearchParams(location.search).has('emulators')) sessionStorage.setItem(EMU_KEY, '1');
  emu = isLocal && sessionStorage.getItem(EMU_KEY) === '1';
} catch { /* storage unavailable */ }
export const useEmulators = emu;

if (useEmulators) {
  // "demo-" project ids are emulator-only and need no real Firebase project.
  Object.assign(firebaseConfig, {
    apiKey: 'demo-key',
    authDomain: 'demo-guia.firebaseapp.com',
    projectId: 'demo-guia',
    storageBucket: 'demo-guia.appspot.com',
    appId: 'demo-app',
  });
}

export const isFirebaseConfigured = !String(firebaseConfig.apiKey).startsWith('YOUR_');
