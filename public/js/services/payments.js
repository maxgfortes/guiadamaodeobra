/**
 * Mercado Pago Card Payment Brick + createPayment Cloud Function.
 *
 * The Brick renders a PCI-compliant card form and returns a single-use card
 * token; the token goes to our callable function, which charges the plan
 * price defined on the server. Card data never touches our code or database.
 */
import { appConfig, isPaymentsConfigured } from '../firebase-config.js';
import { callFunction } from './firebase.js';

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';
let sdkPromise = null;

function loadSdk() {
  if (window.MercadoPago) return Promise.resolve(window.MercadoPago);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.async = true;
      s.onload = () => resolve(window.MercadoPago);
      s.onerror = () => { sdkPromise = null; reject(new Error('mp-sdk-failed')); };
      document.head.appendChild(s);
    });
  }
  return sdkPromise;
}

export { isPaymentsConfigured };

/**
 * Mount the card form.
 * @param {string} containerId
 * @param {{ amount:number, email:string, onSubmit:(formData)=>Promise, onReady?:()=>void, onError?:(e)=>void }} opts
 * @returns {Promise<{ unmount: () => void }>}
 */
export async function mountCardBrick(containerId, { amount, email, onSubmit, onReady, onError }) {
  const MercadoPago = await loadSdk();
  const mp = new MercadoPago(appConfig.mercadoPagoPublicKey, { locale: 'pt-BR' });
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const controller = await mp.bricks().create('cardPayment', containerId, {
    initialization: { amount, payer: { email } },
    customization: {
      visual: {
        hidePaymentButton: false,
        style: {
          theme: dark ? 'dark' : 'default',
          customVariables: {
            baseColor: dark ? '#0a84ff' : '#007aff',
            borderRadiusMedium: '12px',
            borderRadiusLarge: '14px',
            fontSizeMedium: '16px',
          },
        },
        texts: { formSubmit: 'Pagar e ativar perfil' },
      },
      paymentMethods: { maxInstallments: 12 },
    },
    callbacks: {
      onReady: () => onReady?.(),
      onSubmit: (formData) => onSubmit(formData),
      onError: (err) => onError?.(err),
    },
  });
  return { unmount: () => controller?.unmount?.() };
}

/** Charge the selected plan with the Brick's form data. */
export function payPlan(planId, formData) {
  return callFunction('createPayment', {
    planId,
    token: formData.token,
    paymentMethodId: formData.payment_method_id,
    issuerId: formData.issuer_id,
    installments: formData.installments,
    payer: formData.payer,
  });
}
