const { test } = require('node:test');
const assert = require('node:assert/strict');

// Ces tests sont autonomes : ils n'ouvrent aucune connexion MySQL et n'envoient
// aucun webhook réel.
process.env.DATA_ENCRYPTION_KEY = 'cle-de-test-webhook-non-utilisable-en-production';

const {
  encryptSecret,
  decryptSecret,
  isPrivateAddress,
  resolvePublicWebhookTarget,
  createPinnedLookup
} = require('../utils/pro-webhooks');

test('les plages IPv4 privées, locales et réservées sont bloquées', () => {
  for (const address of [
    '0.0.0.0', '10.20.30.40', '100.64.0.1', '127.0.0.1',
    '169.254.10.20', '172.16.0.1', '172.31.255.254',
    '192.0.2.10', '192.168.1.1', '198.18.0.1',
    '198.51.100.20', '203.0.113.5', '224.0.0.1', '255.255.255.255'
  ]) {
    assert.equal(isPrivateAddress(address), true, address + ' doit être refusée');
  }
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  assert.equal(isPrivateAddress('93.184.216.34'), false);
});

test('les plages IPv6 locales, mappées et réservées sont bloquées', () => {
  for (const address of [
    '::', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fd12:3456::1',
    'fe80::1', 'fec0::1', 'ff02::1', '2001:db8::1', '2001:10::1'
  ]) {
    assert.equal(isPrivateAddress(address), true, address + ' doit être refusée');
  }
  assert.equal(isPrivateAddress('2001:4860:4860::8888'), false);
});

test('la cible webhook exige HTTPS sur le port standard et sans identifiants URL', async () => {
  await assert.rejects(
    resolvePublicWebhookTarget('http://example.com/hook', async () => [{ address: '93.184.216.34', family: 4 }]),
    /HTTPS/
  );
  await assert.rejects(
    resolvePublicWebhookTarget('https://example.com:8443/hook', async () => [{ address: '93.184.216.34', family: 4 }]),
    /HTTPS/
  );
  await assert.rejects(
    resolvePublicWebhookTarget('https://user:pass@example.com/hook', async () => [{ address: '93.184.216.34', family: 4 }]),
    /identifiants/
  );
});

test('les hôtes locaux et les IP privées littérales sont refusés sans résolution DNS', async () => {
  await assert.rejects(resolvePublicWebhookTarget('https://localhost/hook'), /locale/);
  await assert.rejects(resolvePublicWebhookTarget('https://127.0.0.1/hook'), /adresse non publique/);
  await assert.rejects(resolvePublicWebhookTarget('https://[::1]/hook'), /adresse non publique/);
});

test('un domaine qui renvoie une adresse privée parmi plusieurs adresses est entièrement refusé', async () => {
  const fakeLookup = async () => [
    { address: '93.184.216.34', family: 4 },
    { address: '10.0.0.12', family: 4 }
  ];
  await assert.rejects(
    resolvePublicWebhookTarget('https://webhook.example.test/events', fakeLookup),
    /adresse non publique/
  );
});

test('la cible validée conserve exactement une IP publique à utiliser pour la connexion', async () => {
  let lookedUpHost = null;
  const fakeLookup = async (hostname, options) => {
    lookedUpHost = hostname;
    assert.equal(options.all, true);
    assert.equal(options.verbatim, true);
    return [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 }
    ];
  };
  const target = await resolvePublicWebhookTarget('https://webhook.example.test/events', fakeLookup);
  assert.equal(lookedUpHost, 'webhook.example.test');
  assert.equal(target.address, '93.184.216.34');
  assert.equal(target.family, 4);
  assert.equal(target.url.hostname, 'webhook.example.test');
});

test('le lookup HTTPS renvoie l’IP épinglée et ne résout pas à nouveau le domaine', async () => {
  const lookup = createPinnedLookup('93.184.216.34', 4);
  const oneAddress = await new Promise((resolve, reject) => {
    lookup('webhook.example.test', {}, (error, address, family) => {
      if (error) return reject(error);
      resolve({ address, family });
    });
  });
  assert.deepEqual(oneAddress, { address: '93.184.216.34', family: 4 });

  const allAddresses = await new Promise((resolve, reject) => {
    lookup('webhook.example.test', { all: true }, (error, addresses) => {
      if (error) return reject(error);
      resolve(addresses);
    });
  });
  assert.deepEqual(allAddresses, [{ address: '93.184.216.34', family: 4 }]);
});

test('le secret de webhook est chiffré et déchiffré sans être stocké en clair', () => {
  const secret = 'webhook-secret-de-test-123';
  const encrypted = encryptSecret(secret);
  assert.notEqual(encrypted, secret);
  assert.equal(encrypted.split(':').length, 3);
  assert.equal(decryptSecret(encrypted), secret);
});
