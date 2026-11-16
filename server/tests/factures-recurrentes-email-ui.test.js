const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pagePath = path.join(__dirname, '..', '..', 'public', 'factures-recurrentes.html');
const page = fs.readFileSync(pagePath, 'utf8');

test("le réglage d'email automatique est explicite et désactivé par défaut", () => {
  assert.match(page, /type="checkbox" id="envoi_auto_email"/);
  assert.match(page, /envoi_auto_email: document\.getElementById\('envoi_auto_email'\)\.checked/);
  assert.match(page, /Option désactivée par défaut/);
});

test("l'interface indique le prérequis SMTP et l'absence de reprise automatique des emails échoués", () => {
  assert.match(page, /Nécessite un serveur SMTP configuré/);
  assert.match(page, /l'email n'est pas retenté automatiquement/);
  assert.match(page, /renvoyer depuis la facture/);
});

test("un modèle existant peut être rouvert et modifié depuis la liste", () => {
  assert.match(page, /onclick="modifierRecurrente\(\$\{r\.id\}\)"/);
  assert.match(page, /function modifierRecurrente\(id\)/);
  assert.match(page, /Api\.put\(\`\/factures-recurrentes\/\$\{id\}\`, payload\)/);
  assert.match(page, /document\.getElementById\('envoi_auto_email'\)\.checked = Number\(modele\.envoi_auto_email\) === 1/);
});

test("la liste signale les modèles pour lesquels l'envoi automatique est activé", () => {
  assert.match(page, /Email auto activé/);
  assert.match(page, /Number\(r\.envoi_auto_email\) === 1/);
});
