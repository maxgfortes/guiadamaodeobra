/**
 * Professionals data access.
 *
 * Single place that talks to Firestore for the public directory. Views never
 * import the SDK directly.
 *
 * Firestore model — collection `professionals`, doc id = Auth uid:
 *   name, nameLower, whatsapp, phone, email,
 *   specs: string[]          niche ids (see data/categories.js)
 *   categories: string[]     denormalized base category ids
 *   city, cityLower, neighborhood, bio,
 *   photoURL, bannerURL, portfolio: string[],
 *   published: bool          the professional's own visibility switch
 *   active: bool             server-only: paid subscription in force
 *   subscription: {...}      server-only: status, planId, expiresAt
 *   createdAt, updatedAt     server timestamps
 */
import { getFirebase } from './firebase.js';
import { normalize } from '../core/utils.js';
import { specName } from '../data/categories.js';

const cache = new Map(); // key → { at, value }
const TTL = 60_000;

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = await loader();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function invalidateCache() {
  cache.clear();
}

/** Firestore doc → plain object with millis timestamps. */
function fromDoc(snap) {
  const d = snap.data();
  return {
    id: snap.id,
    ...d,
    updatedAt: d.updatedAt?.toMillis?.() ?? 0,
    createdAt: d.createdAt?.toMillis?.() ?? 0,
  };
}

const byRecent = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);

/** Run a Firestore list query and map the documents. */
async function runQuery(buildQuery) {
  const fb = await getFirebase();
  return (await fb.fs.getDocs(buildQuery(fb))).docs.map(fromDoc);
}

/** Professionals offering a given niche, newest first. */
export function listBySpec(specId) {
  return cached(`spec:${specId}`, async () => {
    const list = await runQuery(({ db, fs }) => fs.query(
      fs.collection(db, 'professionals'),
      fs.where('published', '==', true),
      fs.where('active', '==', true),
      fs.where('specs', 'array-contains', specId),
      fs.orderBy('updatedAt', 'desc'),
      fs.limit(100),
    ));
    return list.sort(byRecent);
  });
}

/** Most recently updated profiles (home carousel + search corpus). */
export function listRecent(max = 60) {
  return cached(`recent:${max}`, async () => {
    const list = await runQuery(({ db, fs }) => fs.query(
      fs.collection(db, 'professionals'),
      fs.where('published', '==', true),
      fs.where('active', '==', true),
      fs.orderBy('updatedAt', 'desc'),
      fs.limit(max),
    ));
    return list;
  });
}

/** One profile by id. Returns null if missing or not visible to the caller. */
export async function getProfessional(id) {
  const { db, fs } = await getFirebase();
  try {
    const snap = await fs.getDoc(fs.doc(db, 'professionals', id));
    return snap.exists() ? fromDoc(snap) : null;
  } catch (err) {
    // Hidden profiles are unreadable to non-owners: treat as "not found".
    if (err.code === 'permission-denied') return null;
    throw err;
  }
}

/**
 * Text search over name, niches, city and neighborhood.
 * Firestore has no full-text search; for an MVP-sized directory we search a
 * recent window client-side (accent-insensitive). Swap for Algolia/Typesense
 * when the directory outgrows it.
 */
export async function searchProfessionals(term) {
  const q = normalize(term);
  if (q.length < 2) return [];
  const words = q.split(/\s+/);
  const pool = await listRecent(300);
  return pool.filter((p) => {
    const hay = normalize([p.name, p.city, p.neighborhood, ...p.specs.map(specName)].join(' '));
    return words.every((w) => hay.includes(w));
  });
}

/** Primary specialty label for cards/headers. */
export function primarySpecialty(pro, preferSpecId) {
  const id = preferSpecId && pro.specs?.includes(preferSpecId) ? preferSpecId : pro.specs?.[0];
  return id ? specName(id) : 'Profissional';
}
