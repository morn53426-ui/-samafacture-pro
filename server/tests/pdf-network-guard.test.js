// Test unitaire pur de la règle réseau appliquée à Chromium pendant la génération PDF.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const sessionPath = require.resolve('../utils/session');
require.cache[sessionPath] = { id: sessionPath, filename: sessionPath, loaded: true, exports: { getTokenVersion: async () => 0 } };
const { urlPdfAutorisee } = require('../utils/pdf');

const APP = 'http://app:4000';

test("autorise l'application, data:, blob: et ses polices locales", () => {
  assert.equal(urlPdfAutorisee('http://app:4000/facture-detail.html?id=1', APP), true);
  assert.equal(urlPdfAutorisee('http://app:4000/api/factures/1', APP), true);
  assert.equal(urlPdfAutorisee('data:image/png;base64,AAAA', APP), true);
  assert.equal(urlPdfAutorisee('blob:http://app:4000/uuid', APP), true);
  assert.equal(urlPdfAutorisee('http://app:4000/fonts/ibm-plex-sans-latin-400-normal.woff2', APP), true);
});

test('bloque les hôtes externes, le réseau interne et les URL invalides', () => {
  assert.equal(urlPdfAutorisee('https://attaquant.example/collecte?t=jwt', APP), false);
  assert.equal(urlPdfAutorisee('https://fonts.googleapis.com/css2?family=Inter', APP), false); // polices auto-hébergées
  assert.equal(urlPdfAutorisee('https://fonts.gstatic.com/s/inter.woff2', APP), false);
  assert.equal(urlPdfAutorisee('http://169.254.169.254/latest/meta-data/', APP), false);
  assert.equal(urlPdfAutorisee('http://mysql:3306/', APP), false);
  assert.equal(urlPdfAutorisee('http://app:4001/', APP), false);          // autre port
  assert.equal(urlPdfAutorisee('http://app:4000.attaquant.example/', APP), false); // faux préfixe
  assert.equal(urlPdfAutorisee('pas une url', APP), false);
});
