/**
 * Firebase web configuration.
 *
 * Project: guiadamaodeobra
 * (Firebase console → Project settings → Your apps → Web app).
 * These values are NOT secrets: access is enforced by the security rules
 * in /firestore.rules and /storage.rules.
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
  /** Firebase JS SDK version loaded from the gstatic CDN. */
  sdkVersion: '10.12.2',
  /** Region of the Cloud Functions (must match functions/src/config.js). */
  functionsRegion: 'southamerica-east1',
  /**
   * Mercado Pago PUBLIC key (Suas integrações → Credenciais).
   * Use the TEST- key while testing; APP_USR- in production.
   * The secret access token lives only in Cloud Functions secrets.
   */
  mercadoPagoPublicKey: 'YOUR_MP_PUBLIC_KEY',
};

export const isPaymentsConfigured = !appConfig.mercadoPagoPublicKey.startsWith('YOUR_');

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

