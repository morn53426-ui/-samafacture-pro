// Vérifie la correction du point XSS trouvé dans AUDIT_PRODUCTION.md §2.3 (public/factures.html
// et public/devis.html) : escapeHtml(JSON.stringify(email)) inséré dans un attribut onclick='...'
// délimité par des apostrophes. Contrairement aux autres tests de cette session, celui-ci est
// entièrement exécutable ici (aucune dépendance externe — juste la fonction escapeHtml, copiée
// à l'identique depuis public/js/api.js pour rester testable en Node pur, ce fichier n'étant pas
// un module CommonJS car pensé pour tourner dans un navigateur).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Copie exacte de public/js/api.js — à garder synchronisée si la fonction change là-bas.
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Reconstruit exactement le motif utilisé dans factures.html/devis.html. */
function construireAttributOnclick(email) {
  return `onclick='openSendModal(1, ${escapeHtml(JSON.stringify(email || ''))}, "envoyer")'`;
}

describe('Correction XSS — client_email dans un attribut onclick', () => {
  test('un email contenant une apostrophe ne casse plus hors de l\'attribut', () => {
    const emailMalveillant = `a' onmouseover='alert(1)`;
    const attribut = construireAttributOnclick(emailMalveillant);

    // Le test décisif : en ne comptant QUE les apostrophes qui délimitent réellement
    // l'attribut HTML (celle juste après onclick= et celle tout à la fin), il ne doit y avoir
    // aucune apostrophe brute ailleurs dans la chaîne — sinon le navigateur la traiterait comme
    // la fin de l'attribut.
    const interieur = attribut.slice("onclick='".length, -1); // retire les 2 apostrophes délimitantes
    assert.ok(!interieur.includes("'"), `une apostrophe brute subsiste dans l'attribut : ${interieur}`);

    // Le HTML généré doit contenir la version échappée, pas l'apostrophe brute.
    assert.match(attribut, /&#039;/);
  });

  test('un email avec des guillemets doubles ne casse pas non plus (JSON.stringify les utilise)', () => {
    const attribut = construireAttributOnclick(`"><script>alert(1)</script>`);
    const interieur = attribut.slice("onclick='".length, -1);
    assert.ok(!interieur.includes("'"), `apostrophe brute : ${interieur}`);
    // Les guillemets doubles de JSON.stringify sont eux aussi échappés (pas strictement
    // nécessaire pour un attribut délimité par des apostrophes, mais escapeHtml échappe les
    // deux types de guillemets de la même façon — comportement voulu et déjà celui utilisé
    // partout ailleurs dans le projet).
    assert.match(attribut, /&quot;/);
  });

  test('un email normal (sans caractère spécial) reste lisible tel quel', () => {
    const attribut = construireAttributOnclick('client@exemple.com');
    assert.match(attribut, /client@exemple\.com/);
  });

  test('email absent (undefined/null) ne fait pas planter la construction', () => {
    assert.doesNotThrow(() => construireAttributOnclick(undefined));
    assert.doesNotThrow(() => construireAttributOnclick(null));
  });
});
