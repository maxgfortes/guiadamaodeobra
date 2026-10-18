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

export const isFirebaseConfigured = !String(firebaseConfig.apiKey).startsWith('YOUR_');
