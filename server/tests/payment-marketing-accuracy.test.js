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

test('le checkout PayDunya ne prétend pas sélectionner Orange Money ou la carte bancaire', () => {
  const subscription = read('public/abonnement.html');
  assert.match(subscription, /Payer avec PayDunya/);
  assert.doesNotMatch(subscription, /Orange Money \/ Carte/);
  assert.match(subscription, /Type de paiement/);
  assert.match(subscription, /Paiement unique/);
});

test('la politique indique les prestataires réellement utilisés et conserve la mention de validation juridique', () => {
  const privacy = read('public/confidentialite.html');
  assert.match(privacy, /prestataire effectivement choisi et configuré \(Wave ou PayDunya\)/);
  assert.match(privacy, /aucun checkout Stripe n'est intégré/);
  assert.match(privacy, /Modèle à valider avant publication/);
  assert.match(privacy, /Dans l'offre hébergée, l'infrastructure est administrée par l'exploitant du service/);
  assert.doesNotMatch(privacy, /base de données que vous contrôlez/);
});
