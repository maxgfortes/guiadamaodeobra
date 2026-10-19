/**
 * Firebase web configuration.
 *
 * Project: guiadamaodeobra
 * (Firebase console → Project settings → Your apps → Web app).
 * These values are NOT secrets: access is enforced by the security rules
 * in /firestore.rules and /storage.rules.
 *
 * If the values are replaced by 'YOUR_…' placeholders the app runs in
 * DEMO MODE: browsing uses bundled sample professionals, signup is disabled.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyDYSd0ZoBVtXuw5bR_Ps6LkGZa3qGhInCk',
  authDomain: 'guiadamaodeobra.firebaseapp.com',
  projectId: 'guiadamaodeobra',
  storageBucket: 'guiadamaodeobra.firebasestorage.app',
  messagingSenderId: '735810487374',
  appId: '1:735810487374:web:f66b1ec7028346157daf1f',
  measurementId: 'G-XZ69F491PJ',
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
