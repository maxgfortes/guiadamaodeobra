/**
 * Authentication (Google only) + the signed-in professional's own profile.
 */
import { getFirebase } from './firebase.js';
import { invalidateCache } from './professionals.js';

/** Resolve the current user once Firebase has restored the session. */
export async function currentUser() {
  const fb = await getFirebase();
  await fb.auth.authStateReady();
  return fb.auth.currentUser;
}

/** Subscribe to auth changes. Returns an unsubscribe fn. */
export async function onUser(cb) {
  const fb = await getFirebase();
  return fb.au.onAuthStateChanged(fb.auth, cb);
}

/**
 * Google sign-in. Popup first (best UX); falls back to redirect where popups
 * are blocked (some in-app browsers / iOS standalone mode).
 */
export async function signInWithGoogle() {
  const fb = await getFirebase();
  const { au, auth } = fb;
  const provider = new au.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const cred = await au.signInWithPopup(auth, provider);
    return cred.user;
  } catch (err) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(err.code)) {
      await au.signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

export async function signOut() {
  const fb = await getFirebase();
  await fb.au.signOut(fb.auth);
  invalidateCache();
}

/** The signed-in user's profile document (or null if not registered yet). */
export async function getMyProfile(uid) {
  const { db, fs } = await getFirebase();
  const snap = await fs.getDoc(fs.doc(db, 'professionals', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Human-readable messages for common Auth errors. */
export function authErrorMessage(err) {
  const map = {
    'auth/popup-closed-by-user': 'Login cancelado.',
    'auth/network-request-failed': 'Sem conexão. Tente novamente.',
    'auth/unauthorized-domain': 'Domínio não autorizado no Firebase Auth.',
  };
  return map[err?.code || err?.message] || 'Não foi possível entrar. Tente novamente.';
}
