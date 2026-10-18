/**
 * Client-side image processing + Cloud Storage uploads.
 *
 * Phone photos are often 4–12 MB; we downscale and re-encode as JPEG in the
 * browser before upload. This keeps uploads fast on mobile data, profiles
 * light to load, and well under the 5 MB limit in storage.rules.
 */
import { getFirebase } from './firebase.js';

export const IMAGE_PRESETS = {
  avatar: { max: 640, quality: 0.85, square: true },
  banner: { max: 1600, quality: 0.82 },
  portfolio: { max: 1600, quality: 0.82 },
};

const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif|gif)$/i;
const MAX_INPUT = 25 * 1024 * 1024;

export function validateImageFile(file) {
  if (!file) return 'Nenhum arquivo selecionado.';
  if (file.type && !ACCEPTED.test(file.type)) return 'Formato não suportado. Use JPG, PNG ou WEBP.';
  if (file.size > MAX_INPUT) return 'Imagem muito grande (máx. 25 MB).';
  return '';
}

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* fall back to <img> (e.g. older Safari) */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Resize/crop an image File into a JPEG Blob according to a preset. */
export async function compressImage(file, preset = IMAGE_PRESETS.portfolio) {
  const src = await loadBitmap(file);
  const sw = src.width, sh = src.height;
  let sx = 0, sy = 0, cw = sw, ch = sh;
  if (preset.square) { // center-crop avatars
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2; sy = (sh - side) / 2; cw = ch = side;
  }
  const scale = Math.min(1, preset.max / Math.max(cw, ch));
  const w = Math.round(cw * scale), h = Math.round(ch * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff'; // flatten transparent PNGs
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, sx, sy, cw, ch, 0, 0, w, h);
  src.close?.();

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode-failed'))), 'image/jpeg', preset.quality));
}

/**
 * Upload a Blob to Storage and return its public download URL.
 * @param {string} path  e.g. professionals/{uid}/avatar.jpg
 * @param {(pct:number)=>void} [onProgress]
 */
export async function uploadImage(path, blob, onProgress) {
  const fb = await getFirebase();
  if (!fb) throw new Error('firebase-not-configured');
  const { storage, st } = fb;
  const ref = st.ref(storage, path);
  const task = st.uploadBytesResumable(ref, blob, {
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=31536000',
  });
  await new Promise((resolve, reject) => {
    task.on('state_changed',
      (s) => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0),
      reject,
      resolve);
  });
  return st.getDownloadURL(ref);
}

/** Best-effort delete of a previously uploaded file by its download URL. */
export async function deleteByUrl(url) {
  const fb = await getFirebase();
  if (!fb || !url) return;
  try {
    await fb.st.deleteObject(fb.st.ref(fb.storage, url));
  } catch (err) {
    if (err.code !== 'storage/object-not-found') console.warn('delete failed', err);
  }
}
