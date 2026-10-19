/**
 * Home carousel banners, served from Firestore (`banners`, managed in admin.html).
 * Falls back to built-in banners in demo mode or while none are published.
 */
import { getFirebase } from './firebase.js';
import { appConfig } from '../firebase-config.js';

const DEFAULT_BANNERS = [
  { id: 'd1', title: 'Profissionais de confiança', subtitle: 'Fale direto no WhatsApp, sem intermediários.', cta: 'Explorar', link: '#/explore', color: '#007aff' },
  { id: 'd2', title: 'Ar-condicionado em dia', subtitle: 'Limpeza e manutenção antes do calor.', cta: 'Ver técnicos', link: '#/s/ar-condicionado', color: '#30b0c7' },
  { id: 'd3', title: 'Você presta serviços?', subtitle: 'Crie seu perfil e receba clientes.', cta: 'Cadastrar', link: 'signup.html', color: '#5856d6' },
];

let cache = null;

export async function listBanners() {
  if (cache) return cache;
  let banners = [];
  try {
    const fb = await getFirebase();
    if (fb) {
      const { db, fs } = fb;
      const q = fs.query(fs.collection(db, 'banners'), fs.where('active', '==', true), fs.orderBy('order', 'asc'), fs.limit(10));
      banners = (await fs.getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn('Banners unavailable', err);
  }
  if (!banners.length && appConfig.showDemoProfessionals) banners = DEFAULT_BANNERS;
  cache = banners;
  return banners;
}
