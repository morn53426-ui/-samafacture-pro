# Audit approfondi — sécurité multi-sociétés et état des PR
Date : 16 novembre 2026
Branche d'audit : `audit/security-multisocietes-review-20261116-run3`
Base vérifiée : `main` — `70750be430c83c4bf3ff369ad453c7b1fd1af511`

## Décision
Aucun correctif applicatif n'est appliqué dans cette exécution. Une anomalie d'identité affectant l'acceptation des invitations multi-sociétés exige une décision d'architecture et une validation humaine : la corriger proprement nécessite une preuve de contrôle de l'adresse email et un parcours de vérification, pas un simple changement de condition. Les autres changements proposés dans les PR existantes ne sont pas fusionnés.

## Constat P1 — l'adresse email de l'invité n'est pas vérifiée avant rattachement
**Fichiers concernés :** `server/routes/auth.js`, `server/routes/professionnel.js`, `server/database/schema.sql`, migration `006_company_groups.sql`.

- `POST /auth/register` crée immédiatement un compte et émet un JWT à partir de l'adresse fournie ; le flux consulté ne comporte pas de vérification préalable de la possession de cette adresse.
- L'acceptation d'une invitation compare le jeton avec le hash stocké, puis compare `req.user.email` à `invited_email`. Elle ne vérifie pas que cette adresse a été confirmée par un canal indépendant.
- Le schéma utilisateur consulté ne contient pas de marqueur de vérification email.
- En conséquence, une personne pouvant créer un compte avec l'adresse d'un destinataire peut satisfaire la comparaison d'email et accepter une invitation destinée à ce destinataire, sans démontrer qu'elle contrôle réellement sa boîte mail.

**Impact :** risque d'usurpation d'identité et d'accès administrateur à une société invitée. Le contrôle par jeton aléatoire ne suffit pas à compenser l'absence de preuve de propriété de l'adresse.

**Correction requise avant commercialisation :**
1. Définir une preuve de contrôle de l'adresse (vérification email avec jeton à usage unique, expiration et consommation atomique, ou identité OIDC dont l'adresse est explicitement vérifiée).
2. Interdire l'acceptation tant que l'adresse du compte n'est pas vérifiée et correspond exactement à l'adresse invitée.
3. Ajouter les migrations rétrocompatibles, les parcours de renvoi/expiration, les protections anti-abus et les tests d'intégration couvrant inscription non vérifiée, vérification, changement d'adresse, rejeu, concurrence et rattachement.
4. Faire valider le parcours de récupération de compte et les conséquences sur les comptes historiques avant déploiement.

**Aucun changement n'a été apporté à l'authentification ou au flux d'invitation dans cette branche.**

## P2 — clé de chiffrement de l'outbox email
`server/utils/email-outbox-crypto.js` utilise `DATA_ENCRYPTION_KEY` ou, à défaut, `JWT_SECRET` pour dériver la clé AES-256-GCM. Une rotation du secret de repli pendant que des emails chiffrés sont en attente peut rendre les payloads irrécupérables. La PR #60 le documente déjà.

Action : rendre `DATA_ENCRYPTION_KEY` obligatoire en environnement de production, documenter la sauvegarde/rotation, prévoir une migration de clé avec versionnement et re-chiffrement transactionnel. Ne pas changer la clé sur une instance avec des messages en attente sans procédure validée.

## P2 — garantie de livraison email
L'outbox revendique une livraison au moins une fois. Si SMTP accepte un message puis que le processus s'arrête avant l'acquittement SQL, un doublon est possible. Ce comportement est explicitement documenté ; ne pas le présenter comme une livraison exactement une fois.

## P2 — sauvegardes hors site
La PR #56 ajoute un runbook, mais la présence du document ne prouve ni la configuration d'une destination distante ni une restauration réelle. Exiger une sauvegarde chiffrée distante et une preuve de restauration avant mise en production.

## P2 — compatibilité navigateur et accessibilité
La recette actuelle couvre Chromium et une baseline sémantique ; elle ne constitue ni une certification WCAG ni une validation Firefox/Safari. Prévoir une recette manuelle multi-navigateurs et une revue d'accessibilité avant commercialisation.

## Vérification du dépôt et des Pull Requests

### Références comparées à main
- `main` : `70750be430c83c4bf3ff369ad453c7b1fd1af511`.
- `feat/enterprise-multi-company-foundation-20261116` : 86 commits en avance, 0 en retard.
- `fix/pdf-stream-ack-payment-disclosures-20261116` : 141 commits en avance, 0 en retard.
- `fix/a11y-settings-labels-20261116` : 2 commits en avance, 1 en retard.
- `docs/fix-staging-compose-runbook-20261116` : 3 commits en avance, 1 en retard.
- `audit/fix-realtime-company-groups-20261116-run1` : 3 commits en avance, 1 en retard.

### CI observée sur les têtes consultées
- PR #56, commit `0eed0836766b6a5751ebb48df7dd542c47eec0d8` : workflow Tests automatisés #735 réussi ; archive source #489 réussie. Les étapes visibles couvrent Docker Compose, build image sans secrets locaux, npm audit, Redis Streams, tests, smoke cluster MySQL/Redis et recette responsive Chromium.
- PR #60, commit `df9c229ad0a2e19a4d4e0d43207aab9bdb4b6ee5` : Tests automatisés #737 réussi ; archive source #491 réussie.
- PR #63, commit `e5c3d8020b40079021aa678db9dbcb4969831e92` : Tests automatisés #700 réussi ; archive source #455 réussie, mais branche en retard d'un commit sur main.
- PR #57, commit `f76be939f383aa0c3063449a4a87cba4866b31b7` : Tests automatisés #651 réussi ; archive #406 réussie, mais branche en retard d'un commit sur main.
- PR #59, commit `1b3c00c5080de60cc340cc2cc818bc1d0d8c2924` : Tests automatisés #658 réussi ; archive #413 réussie, mais branche en retard d'un commit sur main.

Les résultats ci-dessus sont ceux des commits indiqués ; ils ne certifient pas automatiquement des têtes futures après mise à jour.

## Protection de main
Le ruleset GitHub `protect main` (#27410527) a été lu et est actif sur `refs/heads/main`. Il exige une PR, une approbation, la résolution des conversations et deux contrôles obligatoires : `Tests Node.js et MySQL` et `Build complete source archive`. Il bloque la suppression et les mises à jour non fast-forward. Aucun acteur de contournement n'est configuré ; le compte courant ne peut pas contourner le ruleset. L'endpoint classique de protection de branche a renvoyé 403 ; le ruleset constitue la preuve accessible ici.

## Décisions de fusion
- Aucune PR n'a été fusionnée.
- PR #56 et #60 ont des checks verts sur leurs têtes consultées, mais aucune approbation indépendante n'est enregistrée dans les revues consultées ; #60 reste brouillon.
- PR #57, #59 et #63 ont des checks verts sur leurs têtes consultées mais sont en retard d'un commit sur `main` ; leur mise à jour et une nouvelle CI sont requises.
- PR #63 dépend de la migration multi-sociétés de #60 : respecter l'ordre d'intégration documenté.

## Modifications effectuées pendant cette exécution
- Création de cette branche dédiée à partir de `main`.
- Ajout de ce rapport d'audit.
- Aucun code métier, aucune donnée, aucun paramètre, aucune migration SQL et aucun test existant n'ont été modifiés ou supprimés.
- Aucun test local n'a été exécuté depuis cette interface ; les résultats CI indiqués sont ceux renvoyés par GitHub Actions pour les commits cités.
