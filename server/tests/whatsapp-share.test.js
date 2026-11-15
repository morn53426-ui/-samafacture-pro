const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  normaliserTelephoneWhatsApp,
  construireLienWhatsApp
} = require('../../public/js/whatsapp-share.js');

describe('Partage de factures et devis par WhatsApp', () => {
  test('normalise un numéro sénégalais local vers le format international', () => {
    assert.equal(normaliserTelephoneWhatsApp('77 123 45 67'), '221771234567');
  });

  test('conserve un numéro international et retire le préfixe 00', () => {
    assert.equal(normaliserTelephoneWhatsApp('+33 6 12 34 56 78'), '33612345678');
    assert.equal(normaliserTelephoneWhatsApp('00 221 77 123 45 67'), '221771234567');
  });

  test('prépare un message de facture avec un lien de consultation protégé', () => {
    const share = construireLienWhatsApp({
      id: 42,
      verification_code: 'a1b2c3d4e5',
      type: 'facture',
      numero: 'FAC-2026-0042',
      total: 177000,
      devise: 'FCFA',
      client_nom: 'Client Démo',
      client_telephone: '77 123 45 67'
    }, { baseUrl: 'https://samafacture.example/factures.html', entreprise: 'Entreprise Test' });

    assert.equal(share.telephone, '221771234567');
    assert.equal(new URL(share.whatsappUrl).hostname, 'wa.me');
    assert.equal(new URL(share.whatsappUrl).pathname, '/221771234567');
    assert.match(share.message, /votre facture FAC-2026-0042/);
    assert.match(share.message, /177[\u202f\u00a0 ]?000 FCFA/);
    assert.match(share.message, /https:\/\/samafacture\.example\/consulter\.html\?id=42&code=a1b2c3d4e5/);
    assert.equal(new URL(share.whatsappUrl).searchParams.get('text'), share.message);
  });

  test('identifie un devis et permet de choisir un destinataire si le téléphone est absent', () => {
    const share = construireLienWhatsApp({
      id: 7,
      verification_code: '0123456789',
      type: 'devis',
      numero: 'DV-0007',
      total: 5000,
      devise: 'FCFA'
    }, { baseUrl: 'https://samafacture.example/devis.html' });

    assert.equal(share.telephone, '');
    assert.equal(new URL(share.whatsappUrl).pathname, '/');
    assert.match(share.message, /votre devis DV-0007/);
  });

  test('refuse de créer un lien sans code de vérification', () => {
    assert.throws(() => construireLienWhatsApp({ id: 8, type: 'facture' }, {
      baseUrl: 'https://samafacture.example/factures.html'
    }), /Lien sécurisé indisponible/);
  });
});
