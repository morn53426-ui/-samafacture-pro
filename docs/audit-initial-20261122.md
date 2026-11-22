# Audit initial SamaFacture Pro — 22 novembre 2026 (actualisation 02:41 UTC)

## 1. Périmètre et méthode
- Dépôt : `morn53426-ui/-samafacture-pro`
- Branche de référence : `main`
- HEAD observé : `8453ee6d8e633f151523236eecff1bc0e0cf877b` (merge PR #123, 21 novembre 2026 19:20 UTC).
- Inventaire branches distantes : 138 noms retournés, pagination terminée (100 + 38).
- PR ouvertes visibles dans la recherche : 15. La recherche des PR « all states » via ce connecteur a retourné un résultat vide non exploitable; cet audit confirme les PR ouvertes, pas un historique exhaustif des PR fermées/fusionnées.
- Permissions GitHub disponibles : admin/maintain/push sur le dépôt. Aucun changement sur main.
- Aucun clone local ni environnement d'exécution de tests n'est disponible via le connecteur utilisé; tests locaux non exécutés dans cette session.

## 2. État de main et CI
- SHA main : `8453ee6d8e633f151523236eecff1bc0e0cf877b`.
- Commits récents observés : merge #123 (test facture courte A4), #121 (cachet mobile), #116 (pagination PDF long), #124 (table facture mobile); les commits listés sont datés du 21 novembre.
- Status checks combinés sur main : liste vide.
- Runs Actions associés au SHA main : aucun retourné par l'endpoint consulté. Cela ne signifie pas que les workflows n'existent pas ni que les tests sont réussis; visibilité/endpoint CI limitée.
- README main décrit Node.js, Express, MySQL, frontend vanilla, Docker Compose avec app, PDF worker, MySQL, Redis et proxy Nginx; tests backend et recette visuelle sont prévus, mais leur exécution locale n'a pas été possible ici.
- `package.json` à la racine n'a pas été trouvé; README et fichiers backend indiquent que les commandes de tests se lancent dans `server/`. À revalider avec un clone.

## 3. Branches
138 branches distantes recensées; aucun branch delete ni réécriture de ref effectuée. Les branches comprennent de nombreux lots historiques `audit/`, `fix/`, `feat/`, `test/`, `docs/`, `security/`, `integration/` et `rebase/`. L'inventaire complet est consultable dans l'onglet Branches GitHub; cette session n'a supprimé ni renommé ni fusionné aucune branche.

## 4. PR ouvertes prioritaires et statut CI observé
- #132 — audit initial/plan, draft, head `audit/initial-review-20261122`, SHA `8ac30297c21add6f75d731202cab18fe52208795`: Tests automatisés success, Package source ZIP success.
- #128 — essai 15 jours + workspace + accès plan OHADA, draft, SHA `e3b91dc4ae459fc4fdd65b63dd440f632ccd4217`: Tests success, ESLint success, Package ZIP success.
- #117 — contrepassation annulation/réactivation facture, ouverte non-draft, SHA `ba756d09888474477a19c182b42c1298ef092dd8`: Tests success, ESLint success, Package ZIP success.
- #115 — intégrité comptabilisation dépenses et isolation tenant, ouverte non-draft, SHA `3873c1d1dbaa114af2aec991b1f49e48702f82a1`: Tests success, Package ZIP success.
- #125 — pagination facture longue, ouverte non-draft, SHA `7d9617d00c2bbe94199f497ddf851f0afbf1315c`: Tests success, ESLint success, Package ZIP success.
- #127 — pagination devis Executive, draft: endpoint status/runs n'a pas fourni de résultat exploitable (ref not found).
- #130 — accessibilité contrastes/clavier, draft, SHA `c607f397c4db35ff12e356ec15ed0919553b748e`: ESLint success, Package ZIP success, Tests automatisés in progress au moment du contrôle.
- #129 — navigation professionnelle/paramètres, draft: vérifications structurelles annoncées dans la description; tests CI à confirmer.
- #126 — vidéo Sunupilot, draft: description signale le master MP4 absent de la branche et fallback animé; tests ciblés antérieurs déclarés, CI courante à revalider.
- #131 — feuille de route actualisée, draft.
- #114, #118, #99, #102, #110 — PR historiques visibles encore ouvertes; leur pertinence, base/head, doublons et CI doivent être vérifiés avant toute décision.
- #127 et #125 sont liés par un cas de pagination devis Executive identifié dans la description de #127.

Les statuts ci-dessus sont un échantillon vérifié par SHA de PR; ils ne représentent pas un résultat de tests local et les statuts « success » ne valent que pour les runs GitHub retournés.

## 5. Constats / risques / hypothèses
### P0 — intégrité et sécurité
1. Vérifier isolation multi-tenant sur toutes les routes, groupes/sociétés, invitations, rôles et références croisées; les PR #115/#117 portent des tests/correctifs ciblés, mais une revue complète du code reste nécessaire.
2. Valider transactions/idempotence sur factures, remboursements, dépenses, contrepassations, stocks et clôtures; vérifier qu'une transition ne produit ni double écriture ni déséquilibre.
3. Vérifier révocation des sessions/JWT, CSRF, secrets dans logs, configuration Docker et contexte de build, SSRF/webhooks, sauvegardes chiffrées/atomiques et restauration isolée.
4. CI et protections main: status checks visibles non concluants pour main; vérifier configuration de protection/règles requises avant toute fusion.

### P1 — comptabilité OHADA et documents
1. Revue indépendante du plan de comptes, journaux, débit/crédit, TVA, lettrage/rapprochement, écritures de correction, annulation/réactivation et multi-sociétés. Le socle SYSCOHADA doit être validé par un expert-comptable local; aucune certification réglementaire ne peut être déduite des PR.
2. Recette PDF facture/devis courts et longs, modèles, A4, logos/QR/signature/cachet, polices, bandeaux, pied de page et pagination; #125/#127 portent des cas identifiés.
3. Vérifier worker PDF, queue Redis, retries/ack/reprise, readiness et erreurs de génération/impression.

### P1 — essai gratuit / SaaS
1. Revue #128 des 15 jours depuis première inscription pour Standard/Pro/Entreprise, UTC, migrations additive/idempotentes, expirations, invitations, changement de plan sans reset, entitlements et conservation des données.
2. Confirmer que checkout, mandat, prélèvement et paiement réel restent désactivés; l'essai ne doit pas activer de débit ni supprimer les données à expiration.

### P2 — UX, responsive, Docker et CI/CD
1. Recette mobile/tablette/desktop, zoom 200%, thèmes clair/sombre, clavier, labels, focus et VoiceOver/NVDA.
2. Navigation par domaines, paramètres à accès rapide, réduction de scroll, icônes et cohérence visuelle.
3. Docker local: démarrage, healthchecks, secrets, migration, volumes persistants, backups/restores; ne pas supprimer volumes.
4. CI/CD: tests unitaires/integration MySQL, lint, audit dépendances, visuel/PDF, build/package, smoke staging non destructif, puis contrôles de sécurité.
5. Landing vidéo: livrable MP4 absent signalé dans #126; ne pas considérer le fallback comme livraison vidéo finale.

## 6. Planning technique priorisé
### Lot 0 — inventaire/revue (maintenant)
- Synchroniser les preuves GitHub et l'état des PR/branches; confirmer main HEAD.
- Lire le code des PR ciblées et comparer avec main; détecter doublons, conflits et branches obsolètes.
- Produire une matrice risques/tests/acceptation.

### Lot 1 — sécurité, données et isolation (P0)
- Multi-tenant, permissions, invitation, révocation sessions, secrets/logs, webhook SSRF.
- Backup atomique/chiffré, rétention non destructive, restauration dans base isolée.
- Tests adversariaux et migrations idempotentes.

### Lot 2 — comptabilité OHADA (P0)
- Dépenses, paiements, remboursements, facture annulée/réactivée, contre-écritures, idempotence, balance, tenant isolation.
- Vérifier chaque journal équilibré et les liens/audit trail; test concurrentiel et transactions.

### Lot 3 — factures/devis/PDF/impression (P1)
- Cas court 1 page, long 28+ lignes, tous les modèles, pagination, fonts, logos, QR, cachet, signature, tableaux mobile.
- Génération PDF réelle, inspection visuelle, navigateur et worker; tests de reprise/erreur.

### Lot 4 — essai 15 jours et workspace (P1)
- Inscription Standard/Pro/Entreprise; démarrage UTC; durée fixe 15 jours; expiration; invitation; changements plan; entitlements.
- Vérifier conservation des données, aucun paiement réel et aucun renouvellement/mandat.

### Lot 5 — responsive/accessibilité/UX (P2)
- Campagne pages métier 320–1920 px, zoom 200%, deux thèmes, Tab/Maj+Tab, focus/contraste, lecteurs d'écran.
- Workspace/Paramètres, navigation compactée, iconographie cohérente, réduction des scrolls.

### Lot 6 — Docker/CI/CD (P2)
- Docker build, secrets/context, non-root, healthchecks, MySQL/Redis, PDF worker, proxy.
- Pipeline PR: lint, tests, security/dependency scan, visual/PDF, build, smoke staging; règles main et approbation humaine.

### Lot 7 — release readiness (P2/P3)
- Recette staging, sauvegarde/restauration, monitoring, rollback documenté, release notes et risques acceptés.
- Aucune mise en production ou activation paiement sans autorisation explicite.

## 7. Protocole permanent par lot
- Analyse approfondie basée sur le HEAD actuel, pas sur les rapports anciens.
- Formuler problème, preuves, cause racine, dépendances, options, risques et choix.
- Branch dédiée créée depuis main à jour; changements minimaux, aucun push direct sur main.
- Tests ciblés + non-régression réellement exécutés; vérifier indépendamment diff, logs et statut CI.
- PR descriptive; draft si validations incomplètes. Aucun merge/close sans autorisation.
- Aucun delete de branche, volume, donnée, backup; aucun paiement réel.

## 8. Résultats de cette exécution
- Inventaire GitHub read-only: terminé (main SHA et 138 branches; PR ouvertes visibles).
- CI: échantillon PR vérifié; main status/runs non visibles par endpoints interrogés.
- Code review approfondie du dépôt: non effectuée, car accès source/clone et exécution locale ne sont pas disponibles dans cette session.
- Tests locaux: 0 exécuté; aucun résultat de test local revendiqué.
- Modifications produit: aucune.
- Mise à jour du rapport d'audit sur la branche dédiée `audit/initial-review-20261122` uniquement.
- Main, PR (merge/close), branches, volumes, données et sauvegardes: non modifiés/supprimés.
- Paiement réel: non activé.
