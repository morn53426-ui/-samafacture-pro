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

**Correction proposée :**
- ajout de `users.token_version` (migration de schéma v6) ;
- vérification de cette version à chaque authentification ;
- incrément de la version lors de la déconnexion et de la réinitialisation ;
- consommation atomique du lien de réinitialisation ;
- transmission du jeton avant l'effacement local, tout en conservant une déconnexion locale immédiate ;
- effacement du cookie même lorsqu'un ancien jeton est invalide.

La déconnexion révoque les sessions actives du compte, pas uniquement la session de l'appareil courant. Les appareils devront se reconnecter.

### Haute — quota mensuel de factures

**Avant :** l'API publique comptait les factures avec la date d'émission fournie par le client. Une date ancienne permettait de ne pas être comptabilisée dans le quota du mois courant. Le contrôle de quota du parcours principal était effectué avant sa transaction et pouvait être dépassé par plusieurs créations simultanées.

**Correction proposée :**
- calcul sur `created_at`, indépendant de la date d'émission saisie ;
- verrouillage de la ligne du compte pendant le contrôle et la création ;
- application du même contrôle transactionnel à l'interface et à l'API publique ;
- index `(user_id, type, created_at)` pour accélérer le décompte ;
- tests de dates anciennes et de requêtes concurrentes.

### Haute — sauvegardes MySQL

**Avant :** la date de sauvegarde quotidienne était enregistrée avant de confirmer le succès de `mysqldump`. Un échec pouvait empêcher une nouvelle tentative le même jour. La commande manuelle pouvait terminer avec un code de succès alors que le dump avait échoué.

**Correction proposée :**
- attendre la fermeture du processus et vérifier son code de sortie ;
- pipeline de compression surveillé, fichiers temporaires et renommage uniquement après réussite ;
- libération du verrou quotidien et nouvelle tentative après échec ;
- code de sortie non nul pour `npm run backup` en cas d'échec ;
- tests unitaires du dump compressé et du code de sortie.

### Fiabilité de la construction et de la documentation

- image Docker passée à Node 24 et build rendu reproductible avec `npm ci` et le lockfile obligatoire ;
- workflow CI aligné sur Node 24 et les actions GitHub v7 ;
- version de schéma et description des 15 modèles corrigées ;
- feuille de route mise à jour pour ne pas présenter les rôles d'équipe, le wrapper mobile Capacitor ou la signature interne comme des fonctionnalités inexistantes ;
- paiements d'abonnement et règlements de factures explicitement distingués.

### Haute — cohérence des montants comptables

**Avant :** les frais de livraison négatifs pouvaient être calculés comme zéro, mais enregistrés comme une valeur négative dans certaines routes. Les paiements acceptaient aussi plus de deux décimales avant leur insertion dans les colonnes MySQL `DECIMAL(14,2)`, ce qui pouvait produire des arrondis différents entre saisie, transaction et affichage. Certaines références pouvaient dépasser la taille de la colonne MySQL.

**Correction proposée :**
- `computeTotals()` renvoie maintenant les frais de livraison normalisés, utilisés par la création standard, l'API publique et les factures récurrentes ;
- les frais de livraison des factures dupliquées sont revalidés ;
- quantités, prix unitaires et taux de TVA sont normalisés à deux décimales avant calcul, comme dans les colonnes MySQL ;
- le sous-total est arrondi avant remise et total TTC ;
- les paiements sont arrondis au centime avant comparaison et écriture, les montants nuls après arrondi sont refusés ;
- méthodes et références de paiement sont nettoyées et limitées à la taille des colonnes ;
- tests de régression sur frais négatifs, arrondis et références.

## 4. Points à améliorer avant commercialisation

| Priorité | Sujet | Situation constatée / travail restant |
|---|---|---|
| Haute | Recette des paiements d'abonnement | Connecteurs Wave et PayDunya présents dans le code ; exécuter des paiements de test avec comptes marchands sandbox, vérifier les signatures de webhooks, montants, doublons, expiration et retours utilisateurs. Ne pas activer le mode réel avant validation complète. |
| Haute | Paiement des factures | Les modes de règlement de facture sont enregistrés manuellement. Développer et tester séparément le véritable encaissement automatisé si cette fonction est commercialement promise. |
| Haute | Sauvegarde hors serveur | Les archives locales ne protègent pas contre la perte du VPS/disque. Ajouter une copie chiffrée hors site, des alertes d'échec, une politique de rétention et un exercice de restauration périodique dans une base distincte. |
| Haute | Sécurité frontend | Le JWT web est encore stocké dans `localStorage` et la CSP autorise `'unsafe-inline'`. Migrer progressivement le navigateur vers le cookie HttpOnly, conserver l'authentification Bearer pour les clients mobiles, réduire les scripts inline et tester la CSP en mode report-only avant durcissement. |
| Haute | Antivirus des documents | Les types et signatures binaires sont contrôlés, mais aucune analyse antivirus des fichiers déposés n'est intégrée. Ajouter un scan (ex. ClamAV ou service dédié), une limite de taille et un stockage isolé avant mise à disposition. |
| Haute | Protection des données | Faire vérifier les mentions légales, contrats, durées de conservation, consentements, droits d'accès/suppression, hébergement et formalités applicables auprès de la CDP au Sénégal. Ce point n'est pas une certification juridique. |
| Moyenne | Limitation des tentatives de connexion | Les limiteurs de connexion/réinitialisation doivent être partagés entre workers et instances via Redis ou un stockage commun. Vérifier également les alertes et les seuils à partir des journaux réels. |
| Moyenne | Précision comptable | Le pilote MySQL convertit les DECIMAL en nombres JavaScript. Pour des calculs financiers complexes, préférer des entiers en unités monétaires minimales ou une bibliothèque décimale, avec tests d'arrondis et de TVA. |
| Moyenne | Performance de révocation | La vérification de `token_version` ajoute une lecture MySQL à chaque requête authentifiée. Mesurer son impact sous charge ; à grande échelle, étudier un cache Redis avec invalidation fiable ou des sessions persistées. |
| Moyenne | Mobile | Le wrapper Capacitor existe, mais `mobile/capacitor.config.json` contient encore `https://votredomaine.com`. Remplacer cette valeur par le domaine HTTPS réellement déployé, générer les projets natifs, configurer les icônes, tester les flux et préparer les fiches stores. |
| Moyenne | Signature | La signature interne et l'image de signature ne doivent pas être présentées comme une signature qualifiée/certifiée. Un prestataire de confiance et un parcours de preuve/horodatage seront nécessaires si ce niveau juridique est attendu. |
| Moyenne | Expérience utilisateur | Réaliser une recette visuelle sur petits écrans, Safari iOS et Chrome Android, y compris tableaux, création de facture, PDF, notifications, navigation et clavier mobile. |
| Moyenne | Observabilité | Configurer Sentry, la surveillance MySQL/Redis, les alertes sauvegardes, les métriques de génération PDF et des journaux sans secrets ni données personnelles inutiles. |

## 5. Recette obligatoire avant fusion et déploiement

1. Attendre le succès du workflow CI sur le dernier commit de la PR #3.
2. Déployer la branche sur un environnement staging isolé, avec une base de test séparée et des secrets propres à staging.
3. Vérifier les migrations v5 → v6 sur une copie de base, sans suppression de données.
4. Tester la déconnexion sur plusieurs appareils, la réinitialisation de mot de passe, l'expiration/réutilisation des liens et l'isolation entre entreprises.
5. Créer des factures/devis, appliquer remises et TVA, enregistrer paiements partiels, annuler/dupliquer/transformer et tester les quotas concurrents.
6. Tester génération et restauration PDF, emails SMTP de test, webhooks HTTPS publics contrôlés et paiements fournisseurs en mode test.
7. Effectuer une sauvegarde, vérifier l'archive, puis la restaurer dans une base temporaire distincte.
8. Faire une recette responsive et une vérification sécurité ciblée ; ne pas utiliser de données personnelles réelles en staging.

## 6. Conclusion

Le dépôt présente déjà une base fonctionnelle conséquente et une suite de tests utile. La PR #3 corrige des défauts précis de sécurité, de quota, de sauvegarde et de documentation sans toucher directement à `main`.

**Statut recommandé :** ne pas fusionner et ne pas commercialiser comme totalement prêt tant que la CI de la dernière version, la recette de préproduction, les paiements réels/sandbox selon le périmètre vendu, la restauration de sauvegarde et les vérifications de protection des données n'ont pas été validés.
