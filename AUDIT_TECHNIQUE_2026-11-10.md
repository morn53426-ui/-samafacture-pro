# Rapport d'audit technique — SamaFacture Pro
**Date :** 10 novembre 2026  
**Dépôt de référence :** `morn53426-ui/-samafacture-pro`  
**Base auditée :** `main` au commit `4bfce7f82af42537ba68c64f529eda67cf2eba96`  
**Correctifs proposés :** PR #3 — `audit/fix-backup-and-runtime-20261110`

## 1. Périmètre et limites de l'audit

La revue a porté sur le code serveur Node.js/Express, MySQL, les schémas et migrations, l'authentification, les permissions multi-entreprises, les factures/devis, les paiements, les pièces jointes, les webhooks, les sauvegardes, la génération PDF, les fichiers frontend utilisés pour l'authentification, Docker, CI et la documentation.

**Nature de la revue :** audit de code et vérification automatisée du dépôt GitHub. Ce rapport ne constitue pas un pentest externe, une certification de sécurité, une vérification juridique ou une recette complète sur un serveur de production. Les identifiants marchands, SMTP, le domaine final, les données réelles et les téléphones iOS/Android n'ont pas été testés.

## 2. État initial constaté

- Le workflow GitHub Actions de `main` au commit ci-dessus a réussi : **182 tests réussis, 0 échec, 0 test ignoré**. La construction Docker, la validation Compose, l'installation npm et les tests Node/MySQL étaient verts.
- L'application utilise Node.js/Express, MySQL, Redis optionnel, un frontend HTML/CSS/JavaScript et un wrapper mobile Capacitor.
- Le code contient 15 thèmes de factures/devis et plusieurs modules professionnels (équipe, permissions, commandes, bons de livraison, avoirs, acomptes, caisses, documents, API et webhooks).
- Le code des paiements Wave/PayDunya concerne les abonnements. Les règlements des factures classiques restent enregistrés manuellement tant qu'une passerelle spécifique n'est pas intégrée.
- Le module de signature de documents constitue une signature interne simple, et non une signature électronique qualifiée/certifiée.

## 3. Défauts corrigés dans la PR #3

### Critique — gestion des sessions

**Avant :** la déconnexion supprimait le cookie, mais ne révoquait pas un JWT Bearer déjà copié ou volé. La réinitialisation du mot de passe ne rendait pas non plus les anciens JWT invalides. Un lien de réinitialisation pouvait être présenté simultanément à deux requêtes.

**Correction apportée sur la branche de la PR #3 :**
- ajout de `users.token_version` (migration v6) ;
- vérification de cette version à chaque authentification ;
- incrément de la version lors de la déconnexion et de la réinitialisation ;
- consommation atomique du lien de réinitialisation ;
- transmission du jeton avant l'effacement local, tout en conservant une déconnexion locale immédiate ;
- effacement du cookie même lorsqu'un ancien jeton est invalide.

La déconnexion révoque les sessions actives du compte, pas uniquement la session de l'appareil courant. Les appareils devront se reconnecter.

### Haute — jetons de réinitialisation dans les journaux

**Avant :** sans SMTP configuré, le service email affichait le contenu complet du message sur la sortie standard, y compris le lien de réinitialisation et son jeton. Ce mode est utile en développement, mais un journal de production ne doit pas devenir un canal de récupération de comptes.

**Correction apportée sur la branche de la PR #3 :**
- le fallback qui affiche le contenu des messages est réservé au développement ;
- en production, un SMTP absent provoque une erreur sans journaliser le contenu ;
- le parcours « mot de passe oublié » conserve une réponse générique même si l'envoi échoue ;
- un test confirme qu'aucun jeton n'est écrit dans les logs de production.

### Haute — quota mensuel de factures

**Avant :** l'API publique comptait les factures avec la date d'émission fournie par le client. Une date ancienne permettait de ne pas être comptabilisée dans le quota du mois courant. Le contrôle de quota du parcours principal était effectué avant sa transaction et pouvait être dépassé par plusieurs créations simultanées.

**Correction apportée sur la branche de la PR #3 :**
- registre durable `facture_usage_mensuelle`, une ligne par compte et par mois ;
- initialisation rétrocompatible depuis les factures existantes du mois lors de la première réservation ;
- fonction commune `reserveMonthlyInvoiceQuota()` avec verrouillage du compte et réservation dans la même transaction que l'opération ;
- contrôle appliqué à la création standard, à l'API publique, à la duplication d'une facture, à la conversion d'un devis et à la génération d'une facture récurrente ;
- verrouillage du compte avant le verrou du modèle récurrent, afin de conserver un ordre cohérent entre les transactions de création ;
- une suppression de facture ne libère plus une unité déjà consommée ;
- le compteur suit aussi les factures créées sous une formule payante : revenir au plan Gratuit au milieu du mois ne redonne pas un quota neuf ;
- migration de schéma v7 et tests de régression couvrant création, API publique, duplication, conversion de devis, récurrence, suppression et changement de formule.

### Critique — changement manuel de formule sans paiement

**Avant :** la route authentifiée `PUT /api/auth/plan` permettait à tout utilisateur connecté d'attribuer directement à son compte le plan `starter`, `pro` ou `entreprise`. Le contrôle des fonctionnalités basé sur le plan pouvait donc être contourné sans paiement confirmé.

**Correction apportée sur la branche de la PR #3 :**
- la route autorise le changement manuel uniquement lorsque `NODE_ENV` vaut explicitement `development` ou `test` ; tout environnement absent/inconnu ou de production reçoit HTTP 403 (`PLAN_MANUAL_DISABLED`) ;
- le serveur expose un indicateur `manual_plan_selection` et l'interface masque le sélecteur de test en production ;
- un test de régression vérifie qu'un compte Gratuit ne peut pas s'attribuer le plan Entreprise ;
- les plans payants doivent être activés par le traitement d'un paiement d'abonnement confirmé.

### Haute — confirmation des paiements d'abonnement

**Avant :** le paiement pouvait passer à `payee` dans une première écriture, puis la mise à jour du plan échouer dans une seconde écriture. Un webhook répété ne réparait alors pas le compte, car le paiement était déjà marqué comme traité. Un ancien callback pouvait également remplacer une formule plus récente.

**Correction apportée sur la branche de la PR #3 :**
- verrouillage du paiement et du compte avec `SELECT ... FOR UPDATE` ;
- mise à jour du statut du paiement et du plan dans une seule transaction MySQL ; en cas d'échec, les deux écritures sont annulées et le webhook peut être rejoué ;
- un callback ancien ne rétrograde pas une formule activée par un paiement plus récent ;
- délais de 15 secondes sur les appels de création et de confirmation Wave/PayDunya, et encodage des références fournisseur dans les URL ;
- tests d'idempotence, de rollback/rejeu et d'arrivée tardive des callbacks.

Les comptes marchands Wave/PayDunya n'ont toutefois pas été testés en conditions réelles dans cet audit. Une recette sandbox reste obligatoire avant toute activation commerciale.

### Haute — sauvegardes MySQL

**Avant :** la date de sauvegarde quotidienne était enregistrée avant de confirmer le succès de `mysqldump`. Un échec pouvait empêcher une nouvelle tentative le même jour. La commande manuelle pouvait terminer avec un code de succès alors que le dump avait échoué.

**Correction apportée sur la branche de la PR #3 :**
- attendre la fermeture du processus et vérifier son code de sortie ;
- pipeline de compression surveillé, fichiers temporaires et renommage uniquement après réussite ;
- libération du verrou quotidien et nouvelle tentative après échec ;
- code de sortie non nul pour `npm run backup` en cas d'échec ;
- tests unitaires du dump compressé et du code de sortie.

### Fiabilité de la construction et de la documentation

- image Docker passée à Node 24 et build rendu reproductible avec `npm ci` et le lockfile obligatoire ;
- workflow CI aligné sur Node 24 et les actions GitHub v7 ;
- version de schéma et description des 15 modèles corrigées ;
- sélecteur manuel de formule désactivé en production ;
- registre de quota mensuel persistant partagé par les différents parcours de création de facture ;
- feuille de route mise à jour pour ne pas présenter les rôles d'équipe, le wrapper mobile Capacitor ou la signature interne comme des fonctionnalités inexistantes ;
- paiements d'abonnement et règlements de factures explicitement distingués.

### Haute — cohérence des montants comptables

**Avant :** les frais de livraison négatifs pouvaient être calculés comme zéro, mais enregistrés comme une valeur négative dans certaines routes. Les paiements acceptaient aussi plus de deux décimales avant leur insertion dans les colonnes MySQL `DECIMAL(14,2)`, ce qui pouvait produire des arrondis différents entre saisie, transaction et affichage. Certaines références pouvaient dépasser la taille de la colonne MySQL.

**Correction apportée sur la branche de la PR #3 :**
- `computeTotals()` renvoie maintenant les frais de livraison normalisés, utilisés par la création standard, l'API publique et les factures récurrentes ;
- les frais de livraison des factures dupliquées sont revalidés ;
- quantités, prix unitaires et taux de TVA sont normalisés à deux décimales avant calcul, comme dans les colonnes MySQL ;
- le sous-total est arrondi avant remise et total TTC ;
- les paiements sont arrondis au centime avant comparaison et écriture, les montants nuls après arrondi sont refusés ;
- méthodes et références de paiement sont nettoyées et limitées à la taille des colonnes ;
- tests de régression sur frais négatifs, arrondis et références.

### Haute — remise à zéro incomplète des données professionnelles

**Avant :** la route `DELETE /api/auth/donnees` supprimait les factures et les clients sans supprimer les avoirs, acomptes, demandes de remboursement, commandes et autres ressources des modules professionnels. Les clés étrangères `RESTRICT` sur les commandes, avoirs, acomptes et remboursements pouvaient faire échouer la transaction entière. Les anciennes livraisons et événements webhook pouvaient aussi rester en attente.

**Correction apportée sur la branche de la PR #3 :**
- supprimer les enregistrements enfants dans l'ordre des dépendances avant factures et clients ;
- effacer les données commerciales, les pièces jointes, caisses, documents, modèles récurrents, compteurs et files webhook ;
- conserver le compte, l'identité de l'entreprise, le plan, l'équipe, les rôles et les intégrations configurées ;
- tester le scénario avec commandes, avoirs, acomptes, remboursements, documents, caisses et webhooks actifs.

## 4. Points à améliorer avant commercialisation

| Priorité | Sujet | Situation constatée / travail restant |
|---|---|---|
| Haute | Recette des paiements d'abonnement | Connecteurs Wave et PayDunya présents dans le code ; exécuter des paiements de test avec comptes marchands sandbox, vérifier les signatures de webhooks, montants, doublons, expiration et retours utilisateurs. Ne pas activer le mode réel avant validation complète. |
| Haute | Paiement des factures | Les modes de règlement de facture sont enregistrés manuellement. Développer et tester séparément le véritable encaissement automatisé si cette fonction est commercialement promise. |
| Haute | Sauvegarde hors serveur | Les archives locales ne protègent pas contre la perte du VPS/disque. Ajouter une copie chiffrée hors site, des alertes d'échec, une politique de rétention et un exercice de restauration périodique dans une base distincte. |
| Haute | Sécurité frontend | Le JWT web est encore stocké dans `localStorage` et la CSP autorise `'unsafe-inline'`. Migrer progressivement le navigateur vers le cookie HttpOnly, conserver l'authentification Bearer pour les clients mobiles, réduire les scripts inline et tester la CSP en mode report-only avant durcissement. |
| Haute | Antivirus des documents | Les types et signatures binaires sont contrôlés, mais aucune analyse antivirus des fichiers déposés n'est intégrée. Ajouter un scan (ex. ClamAV ou service dédié), une limite de taille et un stockage isolé avant mise à disposition. |
| Haute | Protection des données | Faire vérifier les mentions légales, contrats, durées de conservation, consentements, droits d'accès/suppression, hébergement et formalités applicables auprès de la CDP au Sénégal. Ce point n'est pas une certification juridique. |
| Moyenne | Limitation des tentatives de connexion | Les limiteurs de connexion, d'inscription et de réinitialisation utilisent maintenant des espaces de clés Redis distincts lorsque `REDIS_URL` est configuré ; en mode local sans Redis, le stockage reste en mémoire. Vérifier les comportements multi-worker, les seuils et la reprise en cas de panne Redis en préproduction. |
| Moyenne | Précision comptable | Le pilote MySQL convertit les DECIMAL en nombres JavaScript. Pour des calculs financiers complexes, préférer des entiers en unités monétaires minimales ou une bibliothèque décimale, avec tests d'arrondis et de TVA. |
| Moyenne | Performance de révocation | La vérification de `token_version` ajoute une lecture MySQL à chaque requête authentifiée. Mesurer son impact sous charge ; à grande échelle, étudier un cache Redis avec invalidation fiable ou des sessions persistées. |
| Moyenne | Mobile | Le wrapper Capacitor existe, mais `mobile/capacitor.config.json` contient encore `https://votredomaine.com`. Remplacer cette valeur par le domaine HTTPS réellement déployé, générer les projets natifs, configurer les icônes, tester les flux et préparer les fiches stores. |
| Moyenne | Signature | La signature interne et l'image de signature ne doivent pas être présentées comme une signature qualifiée/certifiée. Un prestataire de confiance et un parcours de preuve/horodatage seront nécessaires si ce niveau juridique est attendu. |
| Moyenne | Expérience utilisateur | Réaliser une recette visuelle sur petits écrans, Safari iOS et Chrome Android, y compris tableaux, création de facture, PDF, notifications, navigation et clavier mobile. |
| Moyenne | Observabilité | Configurer Sentry, la surveillance MySQL/Redis, les alertes sauvegardes, les métriques de génération PDF et des journaux sans secrets ni données personnelles inutiles. |

## 5. Recette obligatoire avant fusion et déploiement

1. Attendre le succès du workflow CI sur le dernier commit de la PR #3.
2. Déployer la branche sur un environnement staging isolé, avec une base de test séparée et des secrets propres à staging.
3. Vérifier la migration v5 → v7 sur une copie de base, notamment l'ajout de `token_version` et de `facture_usage_mensuelle`, sans suppression de données.
4. Tester la déconnexion sur plusieurs appareils, la réinitialisation de mot de passe, l'expiration/réutilisation des liens et l'isolation entre entreprises.
5. Créer des factures/devis, appliquer remises et TVA, enregistrer paiements partiels, annuler/dupliquer/transformer et tester les quotas concurrents, y compris la génération récurrente et la suppression d'une facture déjà comptabilisée.
6. Tester génération et restauration PDF, emails SMTP de test, webhooks HTTPS publics contrôlés et paiements fournisseurs en mode test.
7. Effectuer une sauvegarde, vérifier l'archive, puis la restaurer dans une base temporaire distincte.
8. Faire une recette responsive et une vérification sécurité ciblée ; ne pas utiliser de données personnelles réelles en staging.

## 6. Conclusion

Le dépôt présente déjà une base fonctionnelle conséquente et une suite de tests utile. La PR #3 corrige des défauts précis de sécurité, de quota, de sauvegarde et de documentation sans toucher directement à `main`.

**Statut recommandé :** ne pas fusionner et ne pas commercialiser comme totalement prêt tant que la CI du dernier commit de la PR #3, la recette de préproduction, les paiements sandbox selon le périmètre vendu, la restauration de sauvegarde hors serveur et les vérifications de protection des données n'ont pas été validés.
