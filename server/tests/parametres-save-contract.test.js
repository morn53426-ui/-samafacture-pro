const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');

describe('Contrat de sauvegarde des paramètres — régression bouton Enregistrer', () => {
  test('la page Paramètres possède un bouton submit identifiable et un handler de formulaire', () => {
    const html = fs.readFileSync(path.join(root, 'public', 'parametres.html'), 'utf8');
    assert.match(html, /id="entreprise-save-button"/);
    assert.match(html, /id="entreprise-form"/);
    assert.match(html, /addEventListener\('submit'/);
    assert.match(html, /Api\.put\('\/auth\/entreprise'/);
    assert.match(html, /facture_template:\s*template/);
    assert.match(html, /localStorage\.setItem\('sf_user'/);
  });

  test('PERSO_COULEURS est déclarée avant fill() et son premier appel', () => {
    const html = fs.readFileSync(path.join(root, 'public', 'parametres.html'), 'utf8');
    const declaration = html.indexOf('const PERSO_COULEURS =');
    const functionFill = html.indexOf('function fill()');
    const callFill = html.indexOf('\n  fill();');
    assert.ok(declaration >= 0, 'PERSO_COULEURS doit exister');
    assert.ok(functionFill >= 0, 'fill() doit exister');
    assert.ok(callFill >= 0, 'fill() doit être appelé');
    assert.ok(declaration < functionFill, 'PERSO_COULEURS doit être déclarée avant fill()');
    assert.ok(declaration < callFill, "PERSO_COULEURS doit être déclarée avant l'initialisation");
  });

  test('api.js évite le piège Live Server en local et utilise Express:4000', () => {
    const js = fs.readFileSync(path.join(root, 'public', 'js', 'api.js'), 'utf8');
    assert.match(js, /window\.SAMAFACTURE_API_URL/);
    assert.match(js, /localhost.*127\.0\.0\.1/s);
    assert.match(js, /:4000\/api/);
  });

  test('npm test cible les fichiers de test et séquence les suites partageant MySQL', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'server', 'package.json'), 'utf8'));
    assert.match(pkg.scripts.test, /^node --test .*"tests\/\\*\\.test\\.js"$/);
    assert.match(pkg.scripts.test, /--test-concurrency=1/);
  });
});
