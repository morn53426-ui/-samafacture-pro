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
  return context.formatDate;
}

test('une date SQL DATE reste le même jour pour les fuseaux proches de la limite UTC', () => {
  const formatDate = loadFormatDate({
    locale: 'fr-FR',
    fuseau_horaire: 'Pacific/Kiritimati',
    format_date: 'dd/MM/yyyy'
  });
  assert.equal(formatDate('2026-11-16'), '16/11/2026');
});

test('les trois formats de date n’ajoutent ni ne retirent un jour', () => {
  assert.equal(
    loadFormatDate({ format_date: 'dd/MM/yyyy' })('2026-11-16'),
    '16/11/2026'
  );
  assert.equal(
    loadFormatDate({ format_date: 'yyyy-MM-dd' })('2026-11-16'),
    '2026-11-16'
  );
  assert.equal(
    loadFormatDate({ format_date: 'MM/dd/yyyy' })('2026-11-16'),
    '11/16/2026'
  );
});

test('un MySQL DATETIME UTC reste converti vers le fuseau du compte', () => {
  const formatDate = loadFormatDate({
    locale: 'fr-FR',
    fuseau_horaire: 'Europe/Paris',
    format_date: 'dd/MM/yyyy'
  });
  assert.equal(formatDate('2026-11-16 23:30:00'), '17/11/2026');
});

test('une date SQL DATE invalide reste affichée telle quelle', () => {
  assert.equal(
    loadFormatDate({ format_date: 'dd/MM/yyyy' })('2026-02-31'),
    '2026-02-31'
  );
});
