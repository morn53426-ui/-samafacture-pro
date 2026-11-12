const crypto = require('crypto');

function waveConfigured(credentials = process.env) {
  return !!(credentials.WAVE_API_KEY && credentials.WAVE_SIGNING_SECRET);
}
function paydunyaConfigured(credentials = process.env) {
  return !!(credentials.PAYDUNYA_MASTER_KEY && credentials.PAYDUNYA_PRIVATE_KEY && credentials.PAYDUNYA_TOKEN);
}

// ---------------------------------------------------------------------------
// Wave Checkout API — https://docs.wave.com/checkout
// ---------------------------------------------------------------------------

/** Crée une session de paiement Wave et renvoie l'URL de paiement à ouvrir. */
async function creerSessionWave({ amount, reference, successUrl, errorUrl, credentials = process.env }) {
  const res = await fetch('https://api.wave.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.WAVE_API_KEY}`,
      'Content-Type': 'application/json'
    },
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
function verifierSignatureWave(rawBody, signatureHeader, signingSecret = process.env.WAVE_SIGNING_SECRET) {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(',').map(p => p.split('=')));
  const { t: timestamp, v1: signature } = parts;
  if (!timestamp || !signature) return false;

  const expected = crypto
    .createHmac('sha256', signingSecret)
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
async function consulterSessionWave(sessionId, credentials = process.env) {
  const res = await fetch(`https://api.wave.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${credentials.WAVE_API_KEY}` }
  });
  if (!res.ok) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// PayDunya — https://developers.paydunya.com (Orange Money, carte bancaire, Wave agrégé)
// ---------------------------------------------------------------------------

function paydunyaBaseUrl(credentials = process.env) {
  return credentials.PAYDUNYA_MODE === 'live'
    ? 'https://app.paydunya.com/api/v1'
    : 'https://app.paydunya.com/sandbox-api/v1';
}

function paydunyaHeaders(credentials = process.env) {
  return {
    'Content-Type': 'application/json',
    'PAYDUNYA-MASTER-KEY': credentials.PAYDUNYA_MASTER_KEY,
    'PAYDUNYA-PRIVATE-KEY': credentials.PAYDUNYA_PRIVATE_KEY,
    'PAYDUNYA-TOKEN': credentials.PAYDUNYA_TOKEN
  };
}

/** Crée une facture de paiement PayDunya et renvoie l'URL de paiement hébergée. */
async function creerFacturePaydunya({ amount, description, reference, storeName, returnUrl, cancelUrl, callbackUrl, credentials = process.env }) {
  const res = await fetch(`${paydunyaBaseUrl(credentials)}/checkout-invoice/create`, {
    method: 'POST',
    headers: paydunyaHeaders(credentials),
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
function verifierHashPaydunya(hash, masterKey = process.env.PAYDUNYA_MASTER_KEY) {
  if (!hash || !masterKey) return false;
  const expected = crypto.createHash('sha512').update(masterKey).digest('hex');
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
async function confirmerFacturePaydunya(token, credentials = process.env) {
  const res = await fetch(`${paydunyaBaseUrl(credentials)}/checkout-invoice/confirm/${encodeURIComponent(token)}`, {
    headers: paydunyaHeaders(credentials)
  });
  if (!res.ok) return null;
  return res.json();
}

module.exports = {
  waveConfigured, paydunyaConfigured,
  creerSessionWave, verifierSignatureWave, consulterSessionWave,
  creerFacturePaydunya, verifierHashPaydunya, confirmerFacturePaydunya
};
