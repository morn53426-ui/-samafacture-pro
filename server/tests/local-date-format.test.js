const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'js', 'api.js'),
  'utf8'
);

function loadFormatDate(user) {
  const location = { hostname: 'samafacture.test', port: '', pathname: '/dashboard.html' };
  const localStorage = {
    getItem(key) {
      return key === 'sf_user' ? JSON.stringify(user) : null;
    },
    setItem() {},
    removeItem() {}
  };
  const context = {
    window: { location, SAMAFACTURE_API_URL: '/api' },
    location,
    localStorage,
    document: {
      readyState: 'loading',
      addEventListener() {}
    },
    console,
    fetch: async () => { throw new Error('Unexpected network access in formatter test'); }
  };
  vm.runInNewContext(source, context, { filename: 'public/js/api.js' });
  return context;
}

test('une date SQL DATE reste le même jour pour les fuseaux proches de la limite UTC', () => {
  const { formatDate } = loadFormatDate({
    locale: 'fr-FR',
    fuseau_horaire: 'Pacific/Kiritimati',
    format_date: 'dd/MM/yyyy'
  });
  assert.equal(formatDate('2026-11-16'), '16/11/2026');
});

test('les trois formats de date n’ajoutent ni ne retirent un jour', () => {
  assert.equal(
    loadFormatDate({ format_date: 'dd/MM/yyyy' }).formatDate('2026-11-16'),
    '16/11/2026'
  );
  assert.equal(
    loadFormatDate({ format_date: 'yyyy-MM-dd' }).formatDate('2026-11-16'),
    '2026-11-16'
  );
  assert.equal(
    loadFormatDate({ format_date: 'MM/dd/yyyy' }).formatDate('2026-11-16'),
    '11/16/2026'
  );
});

test('un MySQL DATETIME UTC reste converti vers le fuseau du compte', () => {
  const { formatDate } = loadFormatDate({
    locale: 'fr-FR',
    fuseau_horaire: 'Europe/Paris',
    format_date: 'dd/MM/yyyy'
  });
  assert.equal(formatDate('2026-11-16 23:30:00'), '17/11/2026');
});

test('le PDF utilise le profil API pour les dates et montants même sans sf_user local', () => {
  const { Api, formatDate, formatMontant } = loadFormatDate(null);
  assert.equal(Api.currentUser(), null, 'Le scénario headless ne fournit pas sf_user.');

  const profil = {
    locale: 'en-US',
    fuseau_horaire: 'Europe/Paris',
    format_date: 'MM/dd/yyyy',
    devise: 'USD'
  };
  assert.equal(formatDate('2026-11-16', profil), '11/16/2026');
  assert.equal(formatDate('2026-11-16 23:30:00', profil), '11/17/2026');
  assert.equal(formatMontant(1234.5, profil.devise, profil), '1,234.5 USD');
});

test('la date par défaut des formulaires suit le fuseau de l’entreprise', () => {
  const { dateCivileAujourdhui } = loadFormatDate({ fuseau_horaire: 'Africa/Dakar' });
  const instant = new Date('2026-11-16T23:30:00.000Z');
  assert.equal(dateCivileAujourdhui(undefined, instant), '2026-11-16');
  assert.equal(dateCivileAujourdhui('Europe/Paris', instant), '2026-11-17');
  assert.equal(dateCivileAujourdhui('Pacific/Kiritimati', instant), '2026-11-17');
});

test('les formulaires de facture, dépense, récurrence et achat utilisent la date civile partagée', () => {
  const root = path.join(__dirname, '..', '..', 'public');
  const invoice = fs.readFileSync(path.join(root, 'nouvelle-facture.html'), 'utf8');
  const expense = fs.readFileSync(path.join(root, 'depenses.html'), 'utf8');
  const recurring = fs.readFileSync(path.join(root, 'factures-recurrentes.html'), 'utf8');
  const purchasing = fs.readFileSync(path.join(root, 'achats.html'), 'utf8');

  assert.match(invoice, /date_emission'\)\.value = dateCivileAujourdhui\(\)/);
  assert.match(expense, /date_depense'\)\.value = dateCivileAujourdhui\(\)/);
  assert.match(recurring, /dateCivileAujourdhui\(accountTimezone\)/);
  assert.match(purchasing, /const today=dateCivileAujourdhui\(\)/);

  assert.doesNotMatch(invoice, /date_emission'\)\.value = new Date\(\)\.toISOString/);
  assert.doesNotMatch(expense, /date_depense'\)\.value = new Date\(\)\.toISOString/);
  assert.doesNotMatch(purchasing, /const today=new Date\(\)\.toISOString/);
});

test('une date SQL DATE invalide reste affichée telle quelle', () => {
  assert.equal(
    loadFormatDate({ format_date: 'dd/MM/yyyy' }).formatDate('2026-02-31'),
    '2026-02-31'
  );
});
