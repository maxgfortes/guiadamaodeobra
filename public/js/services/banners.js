/**
 * Home carousel banners, served from Firestore (`banners`, managed in admin.html).
 * Each banner is an image; tapping it opens its link in a new tab.
 */
import { getFirebase } from './firebase.js';

let cache = null;

export async function listBanners() {
  if (cache) return cache;
  try {
    const { db, fs } = await getFirebase();
    const q = fs.query(fs.collection(db, 'banners'), fs.where('active', '==', true), fs.orderBy('order', 'asc'), fs.limit(10));
    cache = (await fs.getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => b.imageURL);
  } catch (err) {
    console.warn('Banners unavailable', err);
    cache = [];
  }
  return cache;
}
