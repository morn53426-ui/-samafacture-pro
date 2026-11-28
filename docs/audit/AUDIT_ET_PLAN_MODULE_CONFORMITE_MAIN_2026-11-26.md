# Audit technique approfondi et planning — sécurité financière, anti-fraude, AML, KYC et conformité

Date : 26 novembre 2026  
Base vérifiée : `main` — `706601c55d2a13af966b7021989672c8a34a169c`  
Branche de ce rapport : `audit/compliance-lot0-current-main-20261126`  
Périmètre : audit du code et de l’architecture existants, puis définition du plan d’implémentation.  
Statut : **Lots 0, audit et planification ; aucun module métier nouveau n’est encore déclaré opérationnel.**

## 1. Résumé exécutif

Le dépôt dispose déjà de plusieurs fondations réutilisables : une table de journaux professionnels, une route d’accès aux journaux, un RBAC d’entreprise, une résolution de tenant multi-entreprises, un système de notifications email différées et chiffrées, un ordonnanceur avec verrous MySQL, des transactions et des tests d’isolation.

Ces fondations ne constituent toutefois pas encore un système complet de sécurité financière ou de conformité :

- le journal d’audit ne couvre qu’une partie des événements ;
- son écriture est actuellement « fail-open » dans le helper professionnel : une erreur d’écriture est interceptée et n’annule pas l’action métier ;
- il n’existe pas de preuve d’intégrité append-only ou de chaîne cryptographique des événements ;
- l’API d’audit est limitée à 300 lignes, sans filtres, recherche, pagination ni export ;
- une section UI existe déjà, mais n’affiche que 25 lignes ;
- aucun moteur dédié de détection de fraude, aucun module AML et aucun parcours KYC dédié n’ont été identifiés sur `main` ;
- il n’existe pas de centre persistant d’alertes/investigations de conformité ;
- le tableau de bord administrateur Sunupilot existant est un tableau de bord analytique de plateforme, pas un centre de conformité.

La priorité technique est donc de fiabiliser la traçabilité avant de construire les consommateurs de cette traçabilité (fraude, AML et KYC).

## 2. État du dépôt et CI

- Le dépôt est public, non archivé, et sa branche par défaut est `main`.
- Le commit de base courant est `706601c55d2a13af966b7021989672c8a34a169c`.
- Le workflow GitHub Actions `45904545771` associé exactement à ce commit est terminé avec la conclusion **success** le 26 novembre 2026 à 22:30:55 UTC. Il s’agit du contrôle de base, pas d’une exécution des futurs tests de conformité.
- La PR #233 (`refactor/professionnel.js`) est ouverte et GitHub signale `mergeable_state: dirty`. Elle refactorise précisément le fichier `server/routes/professionnel.js`, qui contient le helper d’audit et la route d’audit actuelle. Le lot 1 doit éviter de développer en parallèle une modification concurrente de ce fichier avant clarification de cette PR.
- Une ancienne branche documentaire `docs/compliance-module-audit-plan-20261126` existe déjà. Elle est en divergence par rapport au `main` courant (1 commit en avance et 2 en retard) et son document décrit une base antérieure (`e427ce2`). Elle est laissée intacte ; ce rapport est créé sur une nouvelle branche fondée sur le SHA courant.

Aucune branche, PR, donnée, sauvegarde ou volume n’a été supprimé ou modifié. Aucun déploiement ni paiement réel n’a été déclenché.

## 3. Audit des fonctionnalités existantes

### 3.1 Journaux d’audit

**Table existante :** `pro_audit_logs`, créée dans `server/database/migrations/003_professional_modules.sql`.

Colonnes constatées :
- `id`, `user_id` (tenant), `acteur_user_id`, `action`, `entite`, `entite_id`, `details_json`, `adresse_ip`, `created_at`.
- Index par tenant/date et par tenant/entité/identifiant.
- Clé étrangère `user_id → users(id) ON DELETE CASCADE`.
- Clé étrangère `acteur_user_id → users(id) ON DELETE SET NULL`.

**Écritures déjà présentes :**
- Le helper local `audit(req, ...)` du fichier `server/routes/professionnel.js` est utilisé par environ 45 types d’actions relevés : commandes, avoirs, acomptes, remboursements, caisses, équipe, invitations, clés API, webhooks, paiements, achats, stock, comptabilité, CRM et localisation.
- Huit insertions SQL supplémentaires dans ce fichier écrivent directement dans `pro_audit_logs`, sans passer par ce helper.
- Le helper intercepte les erreurs SQL et écrit un message console sans échouer l’action métier. Cela crée un risque de trou de journalisation.

**Événements non couverts par une écriture identifiée dans les routes examinées :**
- connexions réussies et déconnexions ;
- échecs de connexion persistés par compte ;
- création, modification et suppression de factures ;
- opérations client ;
- changements d’abonnement ;
- actions des administrateurs de plateforme dans un registre persistant.

Cette vérification porte sur les routes `auth.js`, `factures.js`, `clients.js`, `abonnement.js`, `depenses.js` et `admin.js), ainsi que sur `professionnel.js`.

### 3.2 API et interface d’audit

- La route `GET /api/pro/audit` existe dans `server/routes/professionnel.js`.
- Elle applique la permission `audit.read`.
- Elle filtre les lignes avec `WHERE user_id = owner(req)`, où `owner(req)` utilise le tenant établi par le middleware ; le client ne choisit donc pas librement un identifiant de société dans la requête d’audit.
- La route renvoie au maximum 300 lignes, triées par date décroissante.
- Elle ne fournit actuellement ni filtre métier/date, ni recherche, ni pagination, ni export.
- Elle ne journalise pas la consultation de ces données sensibles.

**Interface :** `public/professionnel.html` contient déjà une sous-section « Journal d’audit ». Elle appelle `/pro/audit`, puis affiche au maximum 25 lignes. Elle ne constitue pas encore une page de consultation dédiée et complète.

### 3.3 Authentification, RBAC et isolation des entreprises

- `server/middleware/auth.js` vérifie un JWT Bearer (prioritaire) ou le cookie HttpOnly `sf_token` en repli.
- Pour une authentification uniquement par cookie, les méthodes sensibles requièrent l’en-tête anti-CSRF `X-Requested-With: SamaFacturePro`.
- La version de session est validée via le contexte de session en base.
- La route de connexion utilise un rate limiter (10 échecs par fenêtre de 15 minutes dans le code examiné). Les échecs ne sont pas persistés dans un registre dédié consultable par compte.
- `server/middleware/tenant.js` définit `ROLE_PERMISSIONS`, résout le tenant actif et applique les permissions.
- Les rôles propriétaire et administrateur ont `*`; manager et comptable possèdent actuellement `audit.read`. Les rôles personnalisés acceptent également `audit.read`.
- Les chemins professionnels non explicitement reconnus retombent sur `admin.only`, ce qui refuse par défaut l’accès. Les futures routes compliance devront être ajoutées à une matrice de permissions explicite ; ne pas contourner ce garde-fou.
- Les tests `professional-tenant.test.js` couvrent plusieurs cas d’accès inter-entreprises anormaux et de permissions de membre.

### 3.4 Précision importante sur la réinitialisation du compte et la conservation de l’audit

Une vérification du code courant et de `server/tests/auth-reset-history-guard.test.js` corrige une formulation erronée du premier brouillon du plan :

- `pro_audit_logs` figure dans la liste des historiques protégés examinés par `DELETE /api/auth/donnees`.
- Si un journal existe, la réinitialisation est refusée en HTTP 409 avec `RESET_HISTORIQUE_PROTEGE`.
- La route ne supprime donc pas le journal lors d’une réinitialisation réussie : un compte possédant cet historique est bloqué avant les suppressions.
- En revanche, la clé étrangère `ON DELETE CASCADE` permet toujours la suppression du journal si le compte utilisateur est physiquement supprimé par une autre procédure.

La règle de conservation doit donc être conçue pour traiter le cycle de vie complet du compte, pas seulement l’endpoint de réinitialisation.

### 3.5 Fraude, AML et KYC

Aucun module dédié n’a été identifié sur `main` :
- pas de tables de règles de fraude ou de scores de risque ;
- pas de table d’alertes AML ou de dossiers d’investigation ;
- pas de profils KYC, états de vérification, renouvellements ou journal d’accès aux justificatifs ;
- pas de workflow de validation humaine spécialisé.

Les mentions documentaires isolées ne sont pas une preuve de fonctionnalité opérationnelle.

### 3.6 Documents, notifications et traitements asynchrones

- La table `pro_documents` et les routes de documents professionnels existent. Elles ne constituent pas à elles seules un module KYC : elles n’apportent pas le cycle de vérification d’identité, le consentement, les statuts, les demandes complémentaires, la durée de conservation ni le journal d’accès KYC.
- La migration `007_email_outbox.sql` crée une file email avec payload chiffré, clé d’idempotence, compteur de tentatives et dates de reprise. Elle est réutilisable pour l’email d’alerte après vérification de ses contrats.
- Le service de mail existant peut être réutilisé ; aucune clé ni aucun compte tiers ne sera activé par ce chantier.
- `server/config/scheduler.js` utilise des verrous consultatifs MySQL `GET_LOCK` pour éviter l’exécution concurrente de certaines tâches planifiées.
- Socket.IO et Redis existent pour des événements temps réel par tenant, mais cela ne remplace pas un historique durable d’alertes et d’accusés de réception.
- Aucun registre persistant de notifications in-app, avec attribution, accusé de réception et statut d’investigation, n’a été identifié.

### 3.7 Migrations et tests

- `server/config/db.js` définit `CURRENT_SCHEMA_VERSION = 24`.
- Les migrations sont exécutées sous un verrou MySQL consultatif d’initialisation ; le numéro de version est conservé dans `_samafacture_schema_meta`.
- Les scripts SQL existants sont exécutés par le mécanisme `runMigrations()`, avec une logique d’idempotence pour les objets/colonnes concernés.
- Le dossier `server/database/rollbacks/` n’existe pas sur `main` à la date de l’audit. Il faudra donc introduire des scripts `down` documentés pour les nouvelles migrations, sans jamais les exécuter automatiquement en production.
- Tests existants réutilisables : `professional-tenant.test.js`, `auth-reset-history-guard.test.js`, `log-sanitizer.test.js`, `db-concurrency.test.js`, `currency-lock-concurrency.test.js`, tests d’authentification et tests de génération PDF.
- Les tests de conformité décrits dans la mission ne sont pas encore présents comme couverture d’un module AML/KYC/fraude.

## 4. Architecture cible

Architecture progressive, sans remplacer les routes historiques d’un seul coup :

```
Routes métier (auth, factures, paiements, abonnements, pro, admin)
                         |
                         v
              audit-service centralisé
        validation + redaction + tenant/actor context
                         |
                         v
     pro_audit_logs append-only + chaîne d’intégrité
                         |
                         v
             événements métier fiables
                         |
                         v
               compliance-engine
          règles par tenant / profils / historique
             |             |            |
             v             v            v
          fraude          AML       échéances KYC
             \             |            /
              \            v           /
                compliance_alerts
                         |
                         v
     investigations + décisions humaines motivées
                         |
              +----------+-----------+
              |                      |
              v                      v
       notifications durables    rapports vérifiables
       in-app / email outbox     PDF / CSV / numéros
              |                      |
              +----------+-----------+
                         |
                         v
             espace conformité responsive

Admin plateforme : agrégats multi-entreprises en lecture seule,
réservés aux identifiants explicitement autorisés.
```

### 4.1 Services à séparer

- `audit-service` : seul point d’écriture, contexte acteur/tenant, liste d’autorisation des champs, masquage des secrets, politique de panne, métadonnées et chaîne cryptographique.
- `compliance-rules` : stockage, validation, versionnement et activation des règles par tenant/juridiction.
- `fraud-detector` et `aml-monitor` : analyse explicable, sans décision automatique de fraude ni blocage silencieux des flux métier.
- `investigation-service` : assignation, statut, notes, décisions, justificatifs et historique.
- `kyc-service` : profils, statuts, accès documents, demandes de complément, validation/refus motivé et renouvellement ; adaptateur fournisseur défini mais désactivé.
- `notification-service` : notifications persistantes, dédoublonnage, accusés, assignation, email via outbox existante.
- `compliance-report-service` : génération et registre des rapports/exports à partir de données réellement enregistrées.

### 4.2 Tables cibles à confirmer durant le Lot 0 détaillé

Ensembles de tables prévisionnels, à normaliser après revue des index et cardinalités :
- évolution contrôlée de `pro_audit_logs` ;
- `compliance_rules` ;
- `compliance_alerts` et `compliance_alert_events` ;
- `compliance_investigations` et `compliance_decisions` ;
- `kyc_profiles`, `kyc_documents`, `kyc_document_access_log` ;
- `compliance_notifications` ;
- `compliance_reports` et `compliance_report_exports`.

Les clés de tenant doivent figurer dans les clés uniques, index de recherche et prédicats SQL. Les relations entre alertes, décisions, pièces et rapports doivent préserver l’identité du tenant. Une suppression ou un archivage ne doit jamais permettre un accès croisé.

## 5. Sécurité et décisions d’architecture

1. **Append-only :** ajouter une chaîne HMAC/hash vérifiable, des événements chaînés par tenant, une vérification périodique et une séparation des privilèges d’écriture/lecture. La chaîne seule ne remplace pas une protection des droits SQL ni une sauvegarde hors site.
2. **Panne de journalisation :** décider explicitement quelles actions sensibles échouent de manière fermée si leur journal obligatoire n’est pas inscrit. Pour les opérations financières critiques, l’écriture d’audit doit être atomique avec l’opération métier autant que possible, au moyen de la même transaction.
3. **Données à exclure :** aucun mot de passe, jeton brut, code OTP, secret API, CVV, numéro complet de carte ou payload inutile. Les détails doivent être composés à partir d’une allowlist et non par sérialisation libre de `req.body`.
4. **RBAC :** permissions distinctes telles que `audit.read`, `audit.export`, `compliance.read`, `compliance.manage`, `compliance.kyc.review`, `compliance.documents.read`, `compliance.reports.export`. Le mapping doit rester explicite dans le middleware.
5. **KYC :** chiffrement authentifié AES-GCM avec clé issue de `DATA_ENCRYPTION_KEY`, contrôle d’accès par rôle et tenant, journalisation de chaque consultation/téléchargement, limites de taille/MIME et rétention configurable. Aucun service de vérification externe n’est appelé sans autorisation.
6. **Rétention :** aucune purge automatique ni suppression physique nouvelle ne doit être activée par défaut. Les règles de durée doivent être déterminées par type de données et juridiction après avis compétent. Prévoir anonymisation/archivage lorsque légalement approprié.
7. **Décisions humaines :** les scores et alertes sont des signaux explicables, pas des conclusions juridiques ni des preuves de fraude. Prévoir faux positifs, motifs, revue et escalade.
8. **Juridictions :** aucun seuil réglementaire ne doit être codé comme obligation légale sans source officielle applicable et revue spécialisée. Les seuils initiaux seront clairement étiquetés « paramètres opérationnels non réglementaires » jusqu’à validation.

## 6. Planning priorisé

| Lot | Contenu | Livrable / critère de sortie |
|---|---|---|
| 0 — architecture approfondie | Lecture détaillée de toutes les routes et transactions, conventions de migrations/rollback, données documents, modèle de clés, collecte réglementaire officielle, décisions de rétention | Schéma final, flux, permissions, API, matrices d’accès et migration planifiée |
| 1 — audit fiable | Service d’audit unique, masquage, couverture auth/factures/clients/paiements/abonnements/pro/admin, intégrité, endpoint filtré/paginé, exports CSV/PDF tracés, UI dédiée | Tests d’atomicité, d’intégrité, de rétention, de permissions et d’isolation tenant |
| 2 — alertes et investigations | Tables, workflow, assignation, priorité, échéance, accusé, statut, anti-doublons, historique, notifications in-app et email | Parcours d’alerte complet de la création à la clôture |
| 3 — détection de fraude | Règles configurables par société, profil historique, fréquence, montants, doublons et changements sensibles ; score et explications | Tests de règles, seuils contextualisés, faux positifs et concurrence |
| 4 — AML | Scénarios de fractionnement potentiel, répétition, montants/fréquence, catégories de risque, escalade et dossiers | Validation humaine, paramètres par juridiction et revue spécialisée |
| 5 — KYC | Profil d’identité/entreprise, justificatifs chiffrés, demandes de complément, statuts, décisions et renouvellement | Contrôle d’accès document, chiffrement, accès tracés et tests cycle complet |
| 6 — rapports | Rapports numérotés PDF/CSV, filtres, génération, auteur, historique des exports | Reproductibilité, totaux vérifiables, permissions et tests des fichiers |
| 7 — espace centralisé | Vue tenant et vue plateforme restreinte, 10 sections, indicateurs réels, responsive | Tests de permissions, données vides/volumineuses et responsive |
| 8 — revue finale | Tests intégrés, revue sécurité, non-régression facturation/PDF/paiements/OHADA, documentation et PR finale | CI verte sur le SHA exact, limites et risques documentés |

Chaque lot applicatif sera développé dans une branche dédiée issue du `main` courant, avec commits descriptifs et PR en brouillon pendant l’implémentation. Une PR ne sera jamais fusionnée sans autorisation explicite.

## 7. Garde-fous de livraison

- Ne jamais modifier directement `main`.
- Ne supprimer aucune branche, donnée, sauvegarde ou volume Docker.
- Ne pas activer les paiements réels ou les renouvellements automatiques.
- Ne pas contacter de prestataire KYC/AML et ne transmettre aucune donnée réelle à un tiers.
- Ne pas changer les calculs comptables, les soldes, les règles OHADA, les PDF ou la facturation sans tests spécifiques.
- Ne pas utiliser un score automatique pour bloquer une facture ou confirmer une fraude.
- Ne jamais annoncer un module opérationnel à partir d’une interface ou d’une migration seule.
- Exécuter les tests sur la tête exacte de la branche et reporter les résultats exacts ; différencier tests locaux, CI et vérifications manuelles.
- Pour chaque migration nouvelle : script montant, script de rollback documenté, test d’installation neuve, upgrade depuis v24, idempotence et rollback sur base de test.
- Vérifier l’isolation multi-entreprises sur lectures, écritures, documents, recherches, exports, tâches asynchrones et rapports.

## 8. Limites de cet audit

Cet audit est fondé sur le code GitHub de `main`, les migrations SQL, les tests et les workflows consultables. Il n’a pas été réalisé sur une base de données de production et n’inclut aucun test d’intrusion externe. Aucune revue juridique formelle n’a été menée. Les règles AML/KYC applicables devront être validées auprès de sources officielles sénégalaises/UEMOA pertinentes et d’un spécialiste compétent avant toute activation de seuil ou procédure présentée comme réglementaire.

**Décision de sortie des Lots 0 et audit :** les briques techniques existantes sont identifiées ; l’ordre de réalisation est priorisé. Le premier lot de code à développer est le service d’audit fiable et son API/Interface, mais son intégration à `professionnel.js` doit être coordonnée avec la PR #233 actuellement non mergeable afin d’éviter un conflit de refactorisation.
