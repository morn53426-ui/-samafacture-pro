// Vérifie que l'intégration PayDunya transmet le canal choisi dans invoice.channels.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { creerFacturePaydunya } = require('../config/payments');

const credentials = {
  PAYDUNYA_MODE: 'test',
  PAYDUNYA_MASTER_KEY: 'master-test',
  PAYDUNYA_PRIVATE_KEY: 'private-test',
  PAYDUNYA_TOKEN: 'token-test'
};

async function verifierCanal(t, channel) {
  const fetchOriginal = global.fetch;
  let requete;
  t.after(() => { global.fetch = fetchOriginal; });

  global.fetch = async (url, options) => {
    requete = { url, options };
    return {
      ok: true,
      json: async () => ({
        response_code: '00',
        response_text: 'https://sandbox.paydunya.test/checkout',
        token: 'token-facture-test'
      })
    };
  };

  const result = await creerFacturePaydunya({
    amount: 5000,
    description: 'Abonnement SamaFacture Pro',
    reference: 'ref-test',
    storeName: 'SamaFacture Pro',
    returnUrl: 'https://samafacture.test/retour',
    cancelUrl: 'https://samafacture.test/annulation',
    callbackUrl: 'https://samafacture.test/webhook',
    channels: [channel],
    credentials
  });

  assert.equal(result.checkoutUrl, 'https://sandbox.paydunya.test/checkout');
  assert.equal(requete.url, 'https://app.paydunya.com/sandbox-api/v1/checkout-invoice/create');
  const payload = JSON.parse(requete.options.body);
  assert.deepEqual(payload.invoice.channels, [channel]);
  assert.equal(payload.channels, undefined, 'channels doit être placé dans invoice selon le contrat API');
}

test('PayDunya limite le checkout au canal Orange Money Sénégal sélectionné', async t => {
  await verifierCanal(t, 'orange-money-senegal');
});

test('PayDunya limite le checkout au canal carte bancaire sélectionné', async t => {
  await verifierCanal(t, 'card');
});

test('le comportement historique sans canal sélectionné reste compatible', async t => {
  const fetchOriginal = global.fetch;
  let payload;
  t.after(() => { global.fetch = fetchOriginal; });
  global.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        response_code: '00',
        response_text: 'https://sandbox.paydunya.test/checkout',
        token: 'token-facture-test'
      })
    };
  };
  await creerFacturePaydunya({
    amount: 5000,
    description: 'Abonnement',
    reference: 'ref-test',
    returnUrl: 'https://samafacture.test/retour',
    cancelUrl: 'https://samafacture.test/annulation',
    callbackUrl: 'https://samafacture.test/webhook',
    credentials
  });
  assert.equal(Object.hasOwn(payload.invoice, 'channels'), false);
});
