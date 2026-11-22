# Audit initial SamaFacture Pro — 22 novembre 2026

## Périmètre et méthode
- Dépôt: `morn53426-ui/-samafacture-pro`
- Branche de référence: `main`
- HEAD observé: `8453ee6d8e633f151523236eecff1bc0e0cf877b`
- HEAD commit: merge PR #123 (test facture courte A4), le dernier commit consulté.
- Inventaire GitHub: 137 branches distantes retournées sur 2 pages (100 + 37), puis pagination terminée.
- PR ouvertes observées: 14 (#130, #125, #126, #131, #118, #99, #114, #117, #102, #110, #129, #127, #115, #128).
- PR non fusionnées/non fermées: aucune action entreprise; aucune PR modifiée.
- Statuts CI: endpoint de statut combiné a retourné une liste vide; endpoint de runs lié au commit n'a retourné aucun run. Cela ne prouve pas l'absence de workflows ou de tests; la visibilité CI via le connecteur est limitée.
- Package backend consulté: `server/package.json`; moteur Node déclaré >=22.13.0, scripts test, test:visual, smoke:staging, backup et restore présents.
- Docker Compose consulté: MySQL, Redis, app, pdf-worker, Nginx; volumes nommés mysql_data, app_backups, redis_data, pdf_jobs. Aucun volume, donnée ou sauvegarde touché.

## État de main
- Dernier SHA observé: `8453ee6d8e633f151523236eecff1bc0e0cf877b`.
- Derniers merges observés incluent #123 (facture courte A4), #121 (cachet mobile), #116 (pagination longue), #124 (colonnes mobiles).
- Aucun changement effectué directement sur main.

## PR ouvertes à examiner en priorité
- #128 — essai gratuit 15 jours + organisation professionnelle.
- #117 — contre-écritures lors d'annulation/réactivation de facture.
- #115 — écritures dépenses et isolation multi-tenant.
- #119 / #120 — moyens de paiement dépenses et contre-écritures remboursements (branches/PR à confirmer état).
- #125 — équilibre pagination PDF dernière page, modèles longs.
- #127 — pagination devis Executive A4.
- #130 — contraste WCAG AA et parcours clavier.
- #129 — navigation par domaines et paramètres structurés.
- #126 — vidéo landing: master MP4 toujours signalé manquant dans le dépôt et fallback.
- #131 — feuille de route actualisée.

## Plan priorisé
### P0 — sécurité, intégrité et non-régression
1. Vérifier isolation tenant/permissions et invitations multi-sociétés.
2. Vérifier révocation session, redaction des secrets, Docker context/secrets, backups atomiques et restauration.
3. Vérifier CI/npm audit, tests de migration, statuts de PR et éventuels conflits.
4. Comptabilité: écritures idempotentes, annulations/réactivations, remboursements, caisse/banque, rapprochement, isolation entreprise.

### P1 — facturation et documents
1. Recette des factures/devis courts et longs, 31 modèles, pagination A4, logos/bandeaux/cachets/QR, polices incorporées.
2. Vérifier PDF headless, worker, health/readiness, retry et reprise des tâches.
3. Impressions navigateur: marges, bandeaux pleine largeur, titres non coupés, formats, pied de page.

### P1 — abonnements et espace professionnel
1. Valider PR #128: essai de 15 jours à partir de l'inscription pour Starter/Pro/Entreprise, règles de fin d'essai et entitlements.
2. Confirmer que les paiements réels restent désactivés et aucun checkout/mandat/débit n'est activé.
3. Revoir navigation par domaines, paramètres, densité, pagination et accessibilité.

### P2 — responsive, UX et infrastructure
1. Recette mobile/tablette/desktop, zoom 200%, thèmes clair/sombre, clavier/VoiceOver.
2. Docker: démarrage local, healthchecks, configuration secrets, migrations et volumes conservés.
3. CI/CD: tests unitaires, intégration MySQL, visual/PDF, audit dépendances, build et smoke staging.
4. Video/landing: MP4 manquant et tests de fallback, sans bloquer les fonctions métier.

## Protocole des lots
- Chaque lot doit être isolé dans une branche dédiée issue du main actuel.
- Avant modification: lire le code, établir la cause, définir tests ciblés.
- Après modification: tests réellement exécutés, revue diff, vérification statut CI.
- PR descriptive et brouillon tant que les critères de sortie ne sont pas satisfaits.
- Aucun merge/close sans autorisation explicite.
- Aucune suppression de branche, volume, donnée ou backup; aucun paiement réel.

## Limites
- Le connecteur GitHub ne fournit pas de clone local ni d'exécution de commandes/test dans cette session.
- Les checks CI du commit main sont non visibles via les endpoints interrogés (réponses vides).
- L'inventaire PR est limité à la page de recherche retournée (100 résultats maximum); les 14 PR ouvertes actuelles sont visibles.
- Les tests ne sont pas déclarés réussis: aucun test local n'a été exécuté dans cette session.
