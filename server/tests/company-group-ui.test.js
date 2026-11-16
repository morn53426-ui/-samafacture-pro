'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'groupe-entreprise.html'),
  'utf8'
);

describe('Retour visuel des invitations Entreprise', () => {
  test('affiche un état email confirmé uniquement lorsque le serveur le confirme', () => {
    assert.match(page, /result\.email_envoye\s*\?/);
    assert.match(page, /Email envoyé et confirmé\./);
    assert.match(page, /result\.avertissement/);
  });

  test('ne prétend pas que SMTP est absent quand un envoi échoue ou reste non confirmé', () => {
    assert.doesNotMatch(page, /Non \(SMTP à configurer\)/);
    assert.match(page, /Invitation créée\\. Son email sera traité par la file d’envoi sécurisée/);
    assert.match(page, /escapeHtml\(result\.avertissement/);
  });

  test('affiche le lien après le rechargement du groupe pour ne pas le perdre du DOM', () => {
    const handlerStart = page.indexOf("document.getElementById('invite-company-form').addEventListener");
    const handlerEnd = page.indexOf("root.querySelectorAll('[data-open]'", handlerStart);
    const handler = page.slice(handlerStart, handlerEnd);
    const reloadIndex = handler.indexOf('await load();');
    const linkIndex = handler.indexOf("latestInvitation.innerHTML=");
    assert.ok(reloadIndex >= 0 && linkIndex > reloadIndex, 'le lien doit être inséré après le re-rendu de la page');
  });

  test('annonce le résultat de l’invitation aux technologies d’assistance', () => {
    assert.match(page, /role="status" aria-live="polite"/);
  });

  test('conserve l’échappement du lien et la protection du nouvel onglet', () => {
    assert.match(page, /escapeHtml\(result\.invitation_url\)/);
    assert.match(page, /target="_blank" rel="noopener"/);
  });
});
