/**
 * Professionals data access.
 *
 * Single place that talks to Firestore for the public directory. Views never
 * import the SDK directly. In demo mode (no Firebase config) every call is
 * served from bundled sample data, so the whole UI works out of the box.
 *
 * Firestore model — collection `professionals`, doc id = Auth uid:
 *   name, nameLower, whatsapp, phone, email,
 *   specs: string[]          niche ids (see data/categories.js)
 *   categories: string[]     denormalized base category ids
 *   city, cityLower, neighborhood, bio,
 *   photoURL, bannerURL, portfolio: string[],
 *   published: bool, createdAt, updatedAt (server timestamps)
 */
import { getFirebase, isFirebaseConfigured } from './firebase.js';
import { appConfig } from '../firebase-config.js';
import { DEMO_PROFESSIONALS } from '../data/demo.js';
import { normalize } from '../core/utils.js';
import { specName } from '../data/categories.js';

const useDemo = !isFirebaseConfigured || appConfig.showDemoProfessionals;
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

function demoFor(predicate = () => true) {
  return useDemo ? DEMO_PROFESSIONALS.filter(predicate) : [];
}

/**
 * Run a Firestore list query. While demo profiles are enabled, a failing
 * query (Firestore not created yet, index still building, offline) degrades
 * to demo-only results instead of breaking the screen.
 */
async function queryOrDemo(buildQuery) {
  const fb = await getFirebase();
  if (!fb) return [];
  try {
    return (await fb.fs.getDocs(buildQuery(fb))).docs.map(fromDoc);
  } catch (err) {
    if (!useDemo) throw err;
    console.warn('Firestore query failed; showing demo data only.', err);
    return [];
  }
}

/** Professionals offering a given niche, newest first. */
export function listBySpec(specId) {
  return cached(`spec:${specId}`, async () => {
    const real = await queryOrDemo(({ db, fs }) => fs.query(
      fs.collection(db, 'professionals'),
      fs.where('published', '==', true),
      fs.where('specs', 'array-contains', specId),
      fs.orderBy('updatedAt', 'desc'),
      fs.limit(100),
    ));
    return [...real, ...demoFor((p) => p.specs.includes(specId))].sort(byRecent);
  });
}

/** Most recently updated profiles (home carousel + search corpus). */
export function listRecent(max = 60) {
  return cached(`recent:${max}`, async () => {
    const real = await queryOrDemo(({ db, fs }) => fs.query(
      fs.collection(db, 'professionals'),
      fs.where('published', '==', true),
      fs.orderBy('updatedAt', 'desc'),
      fs.limit(max),
    ));
    return [...real, ...demoFor()].sort(byRecent).slice(0, max);
  });
}

/** One profile by id (demo or Firestore). Returns null if missing/hidden. */
export async function getProfessional(id) {
  if (id.startsWith('demo-')) return DEMO_PROFESSIONALS.find((p) => p.id === id) || null;
  const fb = await getFirebase();
  if (!fb) return null;
  const { db, fs } = fb;
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
