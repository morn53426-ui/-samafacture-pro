'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'groupe-entreprise.html'),
  'utf8'
);
const invitationPage = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'invitation.html'),
  'utf8'
);

describe('Retour visuel des invitations Entreprise', () => {
  test('ne termine pas le rattachement d’un groupe avant la preuve email indépendante', () => {
    assert.match(invitationPage, /verification_required/);
    assert.match(invitationPage, /Connectez-vous avec l’adresse email/i);
    assert.match(invitationPage, /confirmation sera envoyée à cette adresse/i);
  });

  test('préserve les jetons hors des URL pendant la connexion puis les consomme via la route dédiée', () => {
    assert.match(invitationPage, /URLSearchParams\\(location\\.hash\\.replace/);
    assert.match(invitationPage, /sessionStorage\\.setItem\\(invitationStorageKey,token\\)/);
    assert.match(invitationPage, /sessionStorage\\.setItem\\(verificationStorageKey,verificationToken\\)/);
    assert.match(invitationPage, /groupResumeUrl='invitation\\.html\\?type=company-group&resume=1'/);
    assert.doesNotMatch(invitationPage, /nextParams\\.set\\('verification_token'/);
    assert.match(invitationPage, /\\/pro\\/company-group\\/invitations\\/accept\\/verify/);
  });
  test('ne laisse pas les jetons de vérification dans le referer ou la barre d’adresse après lecture', () => {
    assert.match(invitationPage, /name="referrer" content="no-referrer"/);
    assert.match(invitationPage, /history\.replaceState/);
  });

  test('affiche un état email confirmé uniquement lorsque le serveur le confirme', () => {
    assert.match(page, /result\.email_envoye\s*\?/);
    assert.match(page, /Email envoyé et confirmé\./);
    assert.match(page, /result\.avertissement/);
  });

  test('ne prétend pas que SMTP est absent quand un envoi échoue ou reste non confirmé', () => {
    assert.doesNotMatch(page, /Non \(SMTP à configurer\)/);
    assert.ok(page.includes('Invitation créée. Son email sera traité par la file d’envoi sécurisée.'), 'un message de file d’envoi doit être prévu si le serveur ne fournit pas d’avertissement');
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

  test('permet de récupérer un lien actif après rechargement de la page', () => {
    assert.match(page, /data-copy-invitation=/);
    assert.match(page, /Api\.get\('\/pro\/company-group\/invitations\/'\+invitationId\+'\/link'\)/);
    assert.match(page, /copyInvitationLink\(button\.dataset\.copyInvitation,button\)/);
  });

  test('ne propose la relance manuelle que pour un email définitivement échoué', () => {
    assert.match(page, /item\.email_statut==='failed'\?/);
    assert.match(page, /data-retry-email=/);
    assert.match(page, /Api\.post\('\/pro\/company-group\/invitations\/'\+id\+'\/retry-email',\{\}\)/);
  });

  test('copie le lien sans l’injecter dans le DOM et prévoit un fallback navigateur', () => {
    assert.match(page, /navigator\.clipboard\?\.writeText/);
    assert.match(page, /document\.execCommand\('copy'\)/);
    assert.match(page, /field\.remove\(\)/);
  });

  test('annonce le résultat de l’invitation aux technologies d’assistance', () => {
    assert.match(page, /role="status" aria-live="polite"/);
  });

  test('conserve l’échappement du lien et la protection du nouvel onglet', () => {
    assert.match(page, /escapeHtml\(result\.invitation_url\)/);
    assert.match(page, /target="_blank" rel="noopener"/);
  });
});
