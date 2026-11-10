const crypto = require('crypto');

function waveConfigured() {
  return !!(process.env.WAVE_API_KEY && process.env.WAVE_SIGNING_SECRET);
}
function paydunyaConfigured() {
  return !!(process.env.PAYDUNYA_MASTER_KEY && process.env.PAYDUNYA_PRIVATE_KEY && process.env.PAYDUNYA_TOKEN);
}

// ---------------------------------------------------------------------------
// Wave Checkout API — https://docs.wave.com/checkout
// ---------------------------------------------------------------------------

/** Crée une session de paiement Wave et renvoie l'URL de paiement à ouvrir. */
async function creerSessionWave({ amount, reference, successUrl, errorUrl }) {
  const res = await fetch('https://api.wave.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WAVE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      amount: String(Math.round(amount)),
      currency: 'XOF',
      client_reference: reference,
      success_url: successUrl,
      error_url: errorUrl
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || "Impossible de créer la session de paiement Wave.");
  }
  return { checkoutUrl: data.wave_launch_url, sessionId: data.id };
}

/** Vérifie la signature d'un webhook Wave (header Wave-Signature: t=...,v1=...). Rejette
 *  aussi une signature techniquement valide mais trop ancienne (> 5 min), pour limiter la
 *  fenêtre d'une éventuelle attaque par rejeu si une requête signée venait à être interceptée. */
function verifierSignatureWave(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(',').map(p => p.split('=')));
  const { t: timestamp, v1: signature } = parts;
  if (!timestamp || !signature) return false;

  const expected = crypto
    .createHmac('sha256', process.env.WAVE_SIGNING_SECRET)
    .update(timestamp + rawBody)
    .digest('hex');

  let valid;
  try {
    valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
  if (!valid) return false;

  const tsMs = Number(timestamp) * (String(timestamp).length <= 10 ? 1000 : 1);
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
    console.warn('⚠️  Webhook Wave avec une signature valide mais un horodatage trop ancien/futur — ignoré.');
    return false;
  }
  return true;
}

/** Consulte l'état d'une session Wave directement auprès de Wave (vérification de secours). */
async function consulterSessionWave(sessionId) {
  const res = await fetch(`https://api.wave.com/v1/checkout/sessions/${encodeURIComponent(String(sessionId))}`, {
    headers: { Authorization: `Bearer ${process.env.WAVE_API_KEY}` },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// PayDunya — https://developers.paydunya.com (Orange Money, carte bancaire, Wave agrégé)
// ---------------------------------------------------------------------------

function paydunyaBaseUrl() {
  return process.env.PAYDUNYA_MODE === 'live'
    ? 'https://app.paydunya.com/api/v1'
    : 'https://app.paydunya.com/sandbox-api/v1';
}

function paydunyaHeaders() {
  return {
    'Content-Type': 'application/json',
    'PAYDUNYA-MASTER-KEY': process.env.PAYDUNYA_MASTER_KEY,
    'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY,
    'PAYDUNYA-TOKEN': process.env.PAYDUNYA_TOKEN
  };
}

/** Crée une facture de paiement PayDunya et renvoie l'URL de paiement hébergée. */
async function creerFacturePaydunya({ amount, description, reference, storeName, returnUrl, cancelUrl, callbackUrl }) {
  const res = await fetch(`${paydunyaBaseUrl()}/checkout-invoice/create`, {
    method: 'POST',
    headers: paydunyaHeaders(),
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      invoice: {
        total_amount: Math.round(amount),
        description
      },
      store: { name: storeName || 'SamaFacture Pro' },
      custom_data: { reference },
      actions: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        callback_url: callbackUrl
      }
    })
  });
  const data = await res.json();
  if (data.response_code !== '00') {
    throw new Error(data.response_text || data.description || 'Impossible de créer la facture PayDunya.');
  }
  return { checkoutUrl: data.response_text, token: data.token };
}

/** Vérifie que la notification IPN vient bien de PayDunya (hash SHA-512 de la clé maître). */
function verifierHashPaydunya(hash) {
  if (!hash) return false;
  const expected = crypto.createHash('sha512').update(process.env.PAYDUNYA_MASTER_KEY).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
  } catch {
    return false;
  }
}

/**
 * Confirme le statut réel d'une facture PayDunya directement auprès de PayDunya (API
 * "confirm"), plutôt que de faire confiance au contenu de la notification IPN.
 *
 * Important : contrairement à Wave (signature HMAC calculée sur le corps de la requête),
 * le "hash" envoyé par PayDunya dans son IPN est TOUJOURS le même (sha512 de la clé maître
 * du compte marchand) — il prouve seulement que l'appelant connaît cette clé, mais ne signe
 * pas le contenu (montant, référence, statut) de la notification. Un attaquant qui a
 * intercepté une seule notification légitime (ou effectué un vrai paiement d'un centime)
 * connaît ce hash pour toujours et pourrait forger une notification "complétée" pour
 * n'importe quelle référence/montant. On ne crédite donc jamais un paiement sur la seule
 * foi de l'IPN : on interroge PayDunya pour obtenir le statut authentique avant de confirmer.
 */
async function confirmerFacturePaydunya(token) {
  const res = await fetch(`${paydunyaBaseUrl()}/checkout-invoice/confirm/${encodeURIComponent(String(token))}`, {
    headers: paydunyaHeaders(),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) return null;
  return res.json();
}

module.exports = {
  waveConfigured, paydunyaConfigured,
  creerSessionWave, verifierSignatureWave, consulterSessionWave,
  creerFacturePaydunya, verifierHashPaydunya, confirmerFacturePaydunya
};
