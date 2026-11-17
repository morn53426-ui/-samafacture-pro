const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('la page publique distingue les règlements de factures des abonnements indisponibles', () => {
  const home = read('public/index.html');
  assert.match(home, /Modes de règlement que vous pouvez enregistrer pour vos factures/);
  assert.match(home, /formules payantes mensuelles sont en préparation/i);
  assert.match(home, /aucun checkout d'abonnement ni prélèvement automatique n'est activé/i);
  assert.doesNotMatch(home, /paiement en ligne (?:des plans|des formules|des abonnements)/i);
  assert.doesNotMatch(home, /paiements en ligne des plans, Wave ou PayDunya/i);
  assert.doesNotMatch(home, /Compatible avec Wave.*Stripe/);
});

test("le README décrit l'état indisponible des abonnements et le renouvellement sur consentement", () => {
  const readme = read('README.md');
  assert.match(readme, /## Souscriptions aux plans \(en préparation\)/);
  assert.match(readme, /aucune souscription mensuelle, aucun mandat récurrent et aucun débit automatique ne sont activés/i);
  assert.match(readme, /HTTP .503.*PAIEMENT_RECURRENT_NON_CONFIGURE/);
  assert.match(readme, /renouvellement automatique sera facultatif.*désactivé par défaut.*consentement explicite/i);
  assert.ok(readme.includes('PUT /api/auth/plan'));
  assert.ok(readme.includes('HTTP `403` (`PAIEMENT_REQUIS`)'));
  assert.doesNotMatch(readme, /paiements uniques en XOF/i);
  assert.doesNotMatch(readme, /intégrations d'abonnement Wave et PayDunya déjà présentes/i);
});

test('la page abonnement garde les fournisseurs en attente et le renouvellement désactivé par défaut', () => {
  const subscription = read('public/abonnement.html');
  const billingRoute = read('server/routes/abonnement.js');
  assert.match(subscription, /Moyens de paiement prévus/i);
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

test('la politique de confidentialité garde ses mentions de prestataire et de validation', () => {
  const privacy = read('public/confidentialite.html');
  assert.match(privacy, /prestataire effectivement choisi et configuré \(Wave ou PayDunya\)/);
  assert.match(privacy, /aucun checkout Stripe n'est intégré/);
  assert.match(privacy, /Modèle à valider avant publication/);
  assert.match(privacy, /Dans l'offre hébergée, l'infrastructure est administrée par l'exploitant du service/);
  assert.doesNotMatch(privacy, /base de données que vous contrôlez/);
});
