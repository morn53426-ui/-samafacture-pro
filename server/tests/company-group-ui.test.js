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
const professionalPage = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'professionnel.html'),
  'utf8'
);

describe('Retour visuel des invitations Entreprise', () => {
  test('ne termine pas le rattachement d’un groupe avant la preuve email indépendante', () => {
    assert.match(invitationPage, /verification_required/);
    assert.match(invitationPage, /Connectez-vous avec l’adresse email/i);
    assert.match(invitationPage, /confirmation sera envoyée à cette adresse/i);
  });

  test('préserve les jetons hors des URL pendant la connexion puis les consomme via la route dédiée', () => {
    assert.ok(invitationPage.includes("new URLSearchParams(location.hash.replace(/^#/,''))"));
    assert.ok(invitationPage.includes('sessionStorage.setItem(invitationStorageKey,token)'));
    assert.ok(invitationPage.includes('sessionStorage.setItem(verificationStorageKey,verificationToken)'));
    assert.ok(invitationPage.includes("groupResumeUrl='invitation.html?type=company-group&resume=1'"));
    assert.doesNotMatch(invitationPage, /nextParams\.set\('verification_token'/);
    assert.ok(invitationPage.includes('/pro/company-group/invitations/accept/verify'));
  });
  test('ne laisse pas les jetons de vérification dans le referer ou la barre d’adresse après lecture', () => {
    assert.match(invitationPage, /name="referrer" content="no-referrer"/);
    assert.match(invitationPage, /history\.replaceState/);
  });



  test('envoie l’acceptation depuis le compte personnel sans le sélecteur de société précédent', () => {
    assert.match(invitationPage, /const selectedCompany=localStorage\.getItem\('sf_company_owner'\)/);
    assert.match(invitationPage, /localStorage\.removeItem\('sf_company_owner'\)/);
    assert.match(invitationPage, /postInvitationAsOwnAccount\(endpoint/);
  });

  test('protège aussi les invitations classiques avec des jetons de fragment et une reprise après connexion', () => {
    assert.ok(invitationPage.includes("teamResumeUrl='invitation.html?type=team&resume=1'"));
    assert.ok(invitationPage.includes("sessionStorage.setItem(teamInvitationStorageKey,token)"));
    assert.ok(invitationPage.includes("sessionStorage.setItem(teamVerificationStorageKey,verificationToken)"));
    assert.ok(invitationPage.includes("'/pro/team/invitations/accept/verify'"));
    assert.ok(invitationPage.includes("'/pro/team/invitations/accept'"));
  });

  test('ne révèle plus le jeton d’invitation dans l’écran de gestion d’équipe', () => {
    assert.doesNotMatch(professionalPage, /result\.invitation_url/);
    assert.doesNotMatch(professionalPage, /Ouvrir le lien d’invitation/);
    assert.match(professionalPage, /result\.message \|\| 'Le lien a été placé dans la file d’envoi sécurisée\.'/);
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

  test('présente les indicateurs consolidés sans mélanger les devises', () => {
    assert.match(page, /factures_par_devise/);
    assert.match(page, /depenses_par_devise/);
    assert.match(page, /currencies=\[\.\.\.new Set/);
    assert.match(page, /Chiffre d’affaires facturé/);
    assert.match(page, /Factures impayées/);
    assert.match(page, /Factures en retard/);
  });

  test('affiche les soldes des caisses et la valorisation estimative des stocks', () => {
    assert.match(page, /caisses_par_devise/);
    assert.match(page, /Solde des caisses actives/);
    assert.match(page, /stocks_par_devise/);
    assert.match(page, /Valeur estimée du stock/);
    assert.match(page, /Alertes de stock/);
    assert.match(page, /stock\.valeur_stock_estimee/);
    assert.match(page, /row\.valeur_estimee/);
  });

  test('affiche les alertes par filiale et la tendance mensuelle', () => {
    assert.match(page, /Alertes du groupe/);
    assert.match(page, /performance_mensuelle/);
    assert.match(page, /Performance sur les six derniers mois/);
    assert.match(page, /Factures échues et niveaux de stock/);
  });

  test('organise le centre de pilotage en modules, actions rapides et cartes consolidées', () => {
    assert.match(page, /class="enterprise-module-strip"/);
    assert.match(page, /class="enterprise-create-actions"/);
    assert.match(page, /class="enterprise-dashboard-grid"/);
    assert.match(page, /renderDashboardCard\('Chiffre d’affaires facturé'/);
    assert.match(page, /renderDashboardCard\('Encaissements'/);
    assert.match(page, /renderDashboardCard\('Dépenses enregistrées'/);
    assert.match(page, /renderDashboardCard\('Factures impayées &amp; retards|renderDashboardCard\('Factures impayées & retards/);
    assert.match(page, /renderDashboardCard\('Évolution des ventes'/);
    assert.match(page, /renderDashboardCard\('Stocks & trésorerie'/);
  });

  test('maintient une navigation latérale dédiée au centre de pilotage Entreprise', () => {
    const sidebarScript = fs.readFileSync(
      path.join(__dirname, '..', '..', 'public', 'js', 'sidebar.js'),
      'utf8'
    );
    assert.match(sidebarScript, /enterprise-console-shell/);
    assert.match(sidebarScript, /enterprise-console-topbar/);
    assert.match(sidebarScript, /enterprise-console-menu-toggle/);
    assert.match(sidebarScript, /enterpriseToggle\.setAttribute\('aria-expanded'/);
  });

  test('conserve les commandes de pagination accessibles des sociétés', () => {
    assert.match(page, /aria-label="Pagination des sociétés"/);
    assert.match(page, /id="group-company-prev"/);
    assert.match(page, /id="group-company-next"/);
    assert.match(page, /aria-live="polite">Page/);
  });

  test('conserve les limites de consolidation comptable et l’accès séparé aux filiales', () => {
    assert.match(page, /dashboard\?\.note/);
    assert.match(page, /Les comptes, utilisateurs et données restent séparés/);
    assert.match(page, /data-open=/);
  });
});
