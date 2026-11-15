const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  creerSessionWave,
  consulterSessionWave,
  creerFacturePaydunya,
  confirmerFacturePaydunya
} = require('../config/payments');

test('tous les appels sortants Wave et PayDunya portent un délai maximal', async () => {
  const originalFetch = global.fetch;
  const observed = [];
  global.fetch = async (url, options = {}) => {
    observed.push({ url: String(url), signal: options.signal });
    let payload = {};
    if (String(url).includes('/checkout/sessions') && options.method === 'POST') {
      payload = { wave_launch_url: 'https://wave.test/checkout', id: 'wave-session-test' };
    } else if (String(url).includes('/checkout-invoice/create')) {
      payload = { response_code: '00', response_text: 'https://paydunya.test/checkout', token: 'paydunya-token-test' };
    } else {
      payload = { status: 'completed' };
    }
    return { ok: true, json: async () => payload };
  };

  try {
    await creerSessionWave({
      amount: 100,
      reference: 'test-wave',
      successUrl: 'https://example.test/success',
      errorUrl: 'https://example.test/error',
      credentials: { WAVE_API_KEY: 'test-key' }
    });
    await consulterSessionWave('wave-session-test', { WAVE_API_KEY: 'test-key' });
    await creerFacturePaydunya({
      amount: 100,
      description: 'Test',
      reference: 'test-paydunya',
      returnUrl: 'https://example.test/success',
      cancelUrl: 'https://example.test/cancel',
      callbackUrl: 'https://example.test/callback',
      credentials: {
        PAYDUNYA_MODE: 'test',
        PAYDUNYA_MASTER_KEY: 'master',
        PAYDUNYA_PRIVATE_KEY: 'private',
        PAYDUNYA_TOKEN: 'token'
      }
    });
    await confirmerFacturePaydunya('paydunya-token-test', {
      PAYDUNYA_MODE: 'test',
      PAYDUNYA_MASTER_KEY: 'master',
      PAYDUNYA_PRIVATE_KEY: 'private',
      PAYDUNYA_TOKEN: 'token'
    });

    assert.equal(observed.length, 4, 'les quatre appels prestataires doivent être observés');
    for (const call of observed) {
      assert.ok(call.signal instanceof AbortSignal, call.url + ' doit porter un AbortSignal');
      assert.equal(call.signal.aborted, false, call.url + ' ne doit pas être déjà expiré');
    }
  } finally {
    global.fetch = originalFetch;
  }
});
