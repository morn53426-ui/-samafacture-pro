# Rapport de correction — FINAL15 — Fermeture du navigateur Puppeteer

Date : 2026-08-31

## Problème constaté

Aucun appel à `browser.close()` n'existait nulle part dans le projet. Le navigateur
Chromium partagé (singleton `browserPromise` dans `server/utils/pdf.js`, utilisé pour la
génération de PDF via `genererPdfFacture`) restait donc ouvert indéfiniment :
- en production/staging, à l'arrêt du serveur (`SIGTERM`/`SIGINT`) et du worker PDF ;
- en test, à la fin de la suite `node --test`.

Conséquence observée à l'exécution de `npm test` :
- `'Promise resolution is still pending but the event loop has already resolved'` sur
  `envoyer-facture.test.js` et `facture-pdf.test.js` ;
- annulation en cascade de 22 fichiers de test suivants (`cancelled`), le process ne
  pouvant jamais se terminer proprement tant que le handle Chromium restait ouvert.

## Correction appliquée

- Ajout d'une fonction `closeBrowser()` exportée par `server/utils/pdf.js` : ferme le
  navigateur partagé s'il a été lancé, sans erreur s'il est déjà fermé/déconnecté.
- Appel de `closeBrowser()` dans `teardownTestEnvironment()` (`server/tests/setup.js`),
  exécuté après chaque fichier de test.
- Appel de `closeBrowser()` dans l'arrêt propre du serveur (`server/app.js`, fonction
  `shutdown()`), aux côtés de la fermeture de Socket.IO, Redis et du pool MySQL.
- Appel de `closeBrowser()` dans l'arrêt propre du worker PDF asynchrone
  (`server/workers/pdf-worker.js`, fonction `shutdown()`).
- Aucune route, aucun schéma SQL, aucun test existant n'a été supprimé ou réécrit.

## Ce que ce correctif ne résout pas

Le 502 observé sur `télécharge un vrai PDF pour une facture existante` et sur le test
« devis » (`facture-pdf.test.js`) est probablement lié à l'environnement Windows du
testeur (Chromium headless qui n'arrive pas à joindre `127.0.0.1:<port éphémère>` dans
les 15-20 s configurées — pare-feu/antivirus, ou téléchargement Chromium incomplet lors
du `npm install`). Ce correctif garantit en revanche que ces échecs restent isolés à
`facture-pdf.test.js` et `envoyer-facture.test.js` au lieu de faire annuler les 22 autres
fichiers de test.

## Vérifications

- Syntaxe Node de `utils/pdf.js`, `tests/setup.js`, `app.js`, `workers/pdf-worker.js` : OK
  (`node --check`).
