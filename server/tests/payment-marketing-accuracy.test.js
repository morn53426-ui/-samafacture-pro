const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('la page publique distingue les règlements saisis du checkout des plans', () => {
  const home = read('public/index.html');
  assert.match(home, /Modes de règlement que vous pouvez enregistrer/);
  assert.match(home, /paiements en ligne des plans, Wave ou PayDunya/);
  assert.doesNotMatch(home, /Compatible avec Wave.*Stripe/);
});

test('le README décrit les plans comme des paiements uniques sans promesse mensuelle', () => {
  const readme = read('README.md');
  assert.match(readme, /paiements uniques en XOF/);
  assert.match(readme, /ne renouvelle pas automatiquement/);
  assert.doesNotMatch(readme, /FCFA par mois pour Starter/);
});

test('la page présente distinctement les trois moyens prévus sans activer le paiement récurrent', () => {
  const subscription = read('public/abonnement.html');
  const billingRoute = read('server/routes/abonnement.js');
  assert.match(subscription, /Moyens de paiement prévus/);
  assert.ok(subscription.includes('<strong>Wave</strong>'));
  assert.ok(subscription.includes('<strong>Orange Money</strong>'));
  assert.ok(subscription.includes('<strong>Carte bancaire</strong>'));
  assert.match(subscription, /Aucun paiement ni débit automatique ne sera lancé/i);
  assert.match(subscription, /renouvellement automatique facultatif après consentement explicite/i);
  assert.match(subscription, /comingSoon: true/);
  assert.ok(subscription.includes('Abonnement mensuel (en préparation)'));
  assert.doesNotMatch(subscription, /Payer avec Orange Money|Payer par carte bancaire/);
  assert.ok(billingRoute.includes('return res.status(503)'));
  assert.ok(billingRoute.includes('PAIEMENT_RECURRENT_NON_CONFIGURE'));
});

test('la politique indique les prestataires réellement utilisés et conserve la mention de validation juridique', () => {
  const privacy = read('public/confidentialite.html');
  assert.match(privacy, /prestataire effectivement choisi et configuré \(Wave ou PayDunya\)/);
  assert.match(privacy, /aucun checkout Stripe n'est intégré/);
  assert.match(privacy, /Modèle à valider avant publication/);
  assert.match(privacy, /Dans l'offre hébergée, l'infrastructure est administrée par l'exploitant du service/);
  assert.doesNotMatch(privacy, /base de données que vous contrôlez/);
});
