/**
 * Lazy Firebase loader.
 *
 * The SDK is imported from the official CDN only when it is first needed,
 * so the first paint of the directory never waits on Firebase. Every caller
 * goes through `getFirebase()`, which resolves to a single shared instance.
 */
import { firebaseConfig, appConfig, isFirebaseConfigured, useEmulators } from '../firebase-config.js';

const CDN = `https://www.gstatic.com/firebasejs/${appConfig.sdkVersion}`;

let instancePromise = null;

/**
 * @returns {Promise<null | {app, auth, db, storage, fs, st, au}>}
 *   `fs`, `st`, `au` are the Firestore / Storage / Auth module namespaces.
 *   Resolves to null in demo mode (no config).
 */
export function getFirebase() {
  if (!isFirebaseConfigured) return Promise.resolve(null);
  if (!instancePromise) {
    instancePromise = (async () => {
      const [appMod, au, fs, st] = await Promise.all([
        import(`${CDN}/firebase-app.js`),
        import(`${CDN}/firebase-auth.js`),
        import(`${CDN}/firebase-firestore.js`),
        import(`${CDN}/firebase-storage.js`),
      ]);
      const app = appMod.initializeApp(firebaseConfig);
      const auth = au.getAuth(app);
      auth.languageCode = 'pt';
      const db = fs.getFirestore(app);
      const storage = st.getStorage(app);
      if (useEmulators) {
        const host = location.hostname;
        au.connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
        fs.connectFirestoreEmulator(db, host, 8080);
        st.connectStorageEmulator(storage, host, 9199);
      }
      return { app, auth, db, storage, fs, st, au };
    })().catch((err) => {
      // Allow a retry on the next call (e.g. flaky mobile network).
      instancePromise = null;
      throw err;
    });
  }
  return instancePromise;
}

export { isFirebaseConfigured };
