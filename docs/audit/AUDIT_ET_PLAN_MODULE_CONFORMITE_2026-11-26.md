# Audit technique et planning — Module sécurité financière, anti-fraude, AML, KYC et conformité

Date : 2026-11-26 · Base : `main` au commit `e427ce2` · Schéma applicatif : v24 (`CURRENT_SCHEMA_VERSION` dans `server/config/db.js`)
Statut : **Phase 1 (audit) et Phase 2 (planning) uniquement. Aucun code applicatif n'a été modifié.**

Légende : ✅ constaté dans le code lu · ⚠️ constaté mais insuffisant · ❌ absent (recherche effectuée) · ❓ non vérifié à ce stade.

## 1. Ce qui existe déjà

### 1.1 Journal d'audit (`pro_audit_logs`)
- ✅ Table créée par `server/database/migrations/003_professional_modules.sql` : `id, user_id (tenant), acteur_user_id, action, entite, entite_id, details_json, adresse_ip, created_at`, index `(user_id, created_at)` et `(user_id, entite, entite_id)`.
- ⚠️ Clés étrangères `user_id … ON DELETE CASCADE` : le journal disparaît avec le compte. `server/routes/auth.js` (≈ l. 977) le liste aussi parmi les tables vidées lors d'une réinitialisation de compte (test `auth-reset-history-guard.test.js`). **Incompatible avec « append-only » tel que demandé** : décision à prendre (voir §6).
- ⚠️ Aucun mécanisme anti-modification : pas de trigger, pas de chaîne de hachage, pas de séparation des droits SQL. Un `UPDATE`/`DELETE` applicatif ou SQL est possible.
- ⚠️ Pas de colonnes `niveau_risque`, `user_agent`, `categorie`, `resultat`.
- ⚠️ Écriture par la fonction locale `audit(req, …)` de `server/routes/professionnel.js` (≈ 50 actions : commandes, avoirs, acomptes, remboursements, caisses, rôles d'équipe, API keys, webhooks, comptabilité, paiements, achats, stock…) **et** par ≈ 8 `INSERT` en ligne dupliqués dans le même fichier. L'échec d'écriture est avalé (`console.error`) : le journal est *fail-open*.
- ❌ Non journalisés (aucune écriture dans `auth.js`, `factures.js`, `clients.js`, `abonnement.js`, `depenses.js`) : connexions, déconnexions, échecs de connexion, création/modification/suppression de factures et de clients, actions sur les abonnements.

### 1.2 Endpoint `GET /api/pro/audit`
- ✅ Existe (`professionnel.js` ≈ l. 2415). Permission `audit.read` via `permissionForRequest` (`middleware/tenant.js`) : accordée à `proprietaire`/`administrateur` (`*`), `manager`, `comptable`.
- ✅ Isolation par tenant : `WHERE user_id = owner(req)` (le tenant actif résolu par `resolveTenant`, pas un paramètre libre).
- ⚠️ Limite fixe de 300 lignes, **sans filtre, recherche, pagination ni export**. La consultation elle-même n'est pas journalisée.
- ⚠️ Front : `public/professionnel.html` n'affiche que 25 lignes (action · entité · date · IP) dans une sous-section. Aucune page dédiée.

### 1.3 Authentification, rôles, tenants
- ✅ JWT (Bearer prioritaire, cookie `sf_token` en repli + en-tête anti-CSRF `X-Requested-With`), `token_version` invalidé à la déconnexion (`middleware/auth.js`, `routes/auth.js`).
- ✅ `loginLimiter` (limitation par IP des échecs). ⚠️ Les échecs ne sont **pas persistés** : aucune détection de multiplication des échecs par compte possible aujourd'hui.
- ✅ RBAC : `ROLE_PERMISSIONS` + `permissionForRequest` (`middleware/tenant.js`). Les chemins `/pro/*` inconnus retombent sur `admin.only` (refus par défaut — bon comportement à conserver : tout nouveau chemin `compliance` doit être mappé explicitement).
- ✅ Multi-entreprises : en-tête `X-SF-Company-Owner`, membre d'équipe actif ou groupe Entreprise accepté.
- ✅ Administration plateforme : `routes/admin.js`, accès par `SUNUPILOT_ADMIN_USER_IDS` (variable d'environnement, `users.role` n'accorde rien). Journal d'accès = ligne JSON sur stdout, **non persisté** (confirmé par `docs/CENTRE_ADMIN_SUNUPILOT.md`).

### 1.4 Notifications et traitements asynchrones
- ✅ `email_outbox` (payload chiffré, reprise sur crash, `FOR UPDATE SKIP LOCKED`, 8 tentatives, reprises espacées) + `config/mailer.js` + `email-outbox.js` — **réutilisable** pour les e-mails d'alerte.
- ✅ Webhooks sortants (`pro_webhook_deliveries`, `utils/pro-webhooks.js`), Socket.IO par tenant (`realtime.js`), file PDF Redis (`pdf-queue.js`).
- ✅ `config/scheduler.js` : tâches périodiques sous verrou consultatif MySQL (`GET_LOCK`) — **modèle à réutiliser** pour les analyses lourdes (une seule instance exécute).
- ❌ Aucune table ni UI de notifications *dans l'application* (historique, accusé de réception, assignation).

### 1.5 Base de données et migrations
- ✅ Migrations SQL numérotées `003…013` + `runMigrations()` idempotent dans `config/db.js`, version de schéma `_samafacture_schema_meta` (v24), verrou `samafacture_schema_init`.
- ❌ Pas de mécanisme de rollback existant → à créer (scripts `down` dédiés, jamais exécutés automatiquement).
- ❓ À lire en détail au Lot 0 : comment `runMigrations()` charge les fichiers `.sql` et comment `schema.sql` / migrations / bump de version doivent rester synchronisés (tests `schema-v21-upgrade-compatibility`, `subscription-schema`).

### 1.6 Concurrence
- ✅ Verrous consultatifs (`GET_LOCK`), `SKIP LOCKED`, transactions explicites, tests `db-concurrency`, `currency-lock-concurrency`, `register-concurrency`.

### 1.7 Tests, CI, conventions
- ✅ `node --test "tests/*.test.js"` ; base `samafacture_test` ; CI GitHub (MySQL 8 + Redis) dans `.github/workflows/test.yml`, plus ESLint.
- ✅ `AGENTS.md` : lire les skills `.agents/skills/*` avant toute UI ; tester 320 px → desktop, états vides/limites ; ne pas modifier calculs de facturation/soldes/OHADA/contrats API sans demande et tests dédiés ; ne jamais annoncer « validé » sans exécution réelle.
- ✅ Design : variables et composants de `public/css/style.css` (+ `enterprise-workspace.css`, `workspace-polish.css`, `admin.css`) ; `public/admin.html` + `public/js/admin.js` = précédent pour une page d'administration.

### 1.8 Fraude / AML / KYC
- ❌ **Aucun module existant** (recherche `kyc|aml|fraud|blanchiment` sur `server/` et `public/` : seules occurrences incidentes dans un commentaire de `swagger.js` et une phrase des conditions d'utilisation). Tout est à construire.

## 2. Limites de cet audit
- Environnement d'audit sans MySQL ni `node_modules` : **aucun test n'a été exécuté** à ce stade. La suite complète s'exécute en CI (MySQL 8 + Redis). Avant le Lot 1, je tenterai d'installer MySQL localement ; sinon les tests ne seront « réels » qu'une fois exécutés en CI, et je le dirai explicitement.
- `routes/factures.js` (1512 lignes), `routes/clients.js`, `routes/abonnement.js`, la logique de paiement et le détail de `runMigrations()` n'ont pas encore été lus ligne à ligne : ❓ jusqu'au Lot 0.
- Aucune exigence réglementaire n'est affirmée ici (voir §5).

## 3. Architecture cible (résumé)

```
 Événements existants ──► services/audit-service.js ──► pro_audit_logs (append-only, chaîne HMAC)
 (routes pro, auth,            │  (point d'écriture unique, rédaction des secrets)
  factures, abonnements)       ▼
                       compliance-engine (job planifié, verrou GET_LOCK)
                 ┌─────────────┼───────────────┐
                 ▼             ▼               ▼
            règles fraude   règles AML     rappels KYC (expiration)
                 └─────────────┼───────────────┘
                               ▼
                    compliance_alerts (dédoublonnage par empreinte)
                               ▼
        compliance_investigations ◄── décisions humaines motivées (+ historique)
                               ▼
     notifications in-app · e-mail via email_outbox · rapports numérotés (PDF/CSV)
```

Principes : un seul point d'écriture d'audit ; règles et seuils **par entreprise** (profil + historique, pas de seuil global) ; toute alerte est un *signalement à examiner*, jamais une preuve ; aucune décision automatique bloquante sur facturation/paiement ; données KYC chiffrées (clé dérivée de `DATA_ENCRYPTION_KEY`) ; interface fournisseur KYC prévue mais **désactivée** et sans appel réseau.

Tables prévues (migrations v25+, chacune avec script de rollback dans `server/database/rollbacks/`) :
`pro_audit_logs` (colonnes ajoutées), `compliance_rules`, `compliance_alerts`, `compliance_alert_events`, `compliance_investigations`, `compliance_decisions`, `kyc_profiles`, `kyc_documents`, `kyc_document_access_log`, `compliance_notifications`, `compliance_reports`, `compliance_report_exports`.

API prévue (préfixe `/api/pro/compliance/*`, permissions explicites `compliance.read|manage|kyc.review|reports.export`, ajoutées à `ROLE_PERMISSIONS` et à `permissionForRequest`) ; vue plateforme multi-entreprises en lecture seule sous `/api/admin/compliance/*` (réservée à `SUNUPILOT_ADMIN_USER_IDS`).

## 4. Planning priorisé (lots contrôlés — une PR brouillon par lot)

| Lot | Contenu | Pourquoi dans cet ordre |
|---|---|---|
| 0 | Lecture complète des points ❓, MySQL local, base de tests, conventions de migration/rollback | Sécurise tout le reste |
| 1 | **Audit** : service d'écriture unique, journalisation connexions/échecs/factures/abonnements, chaîne d'intégrité, `GET /pro/audit` filtré + paginé + recherche, export CSV/PDF journalisé, page « Journaux d'audit » | Fondation de tout (preuves) ; module le plus demandé en premier |
| 2 | **Alertes + investigations** (noyau) : tables, états (ouverte / traitée / rejetée / vérification supplémentaire), assignation, priorité, échéance, accusé, dédoublonnage, notifications in-app + e-mail via `email_outbox` | Les modules 2, 3, 4 y déposent leurs signalements |
| 3 | **Moteur de fraude** : règles configurables par entreprise, profil historique, score + explication, analyse planifiée | Premier consommateur du noyau |
| 4 | **AML** : fractionnement, fréquence/montants, niveaux faible→critique, dossiers, escalade, faux positifs | Réutilise moteur + dossiers |
| 5 | **KYC** : statuts, justificatifs chiffrés, accès tracé, demandes complémentaires, validation/refus motivé, renouvellements, adaptateur prestataire désactivé | Plus sensible (données personnelles) → après le socle d'audit |
| 6 | **Rapports de conformité** numérotés, PDF/CSV, historique des exports | Dépend des données des lots 1–5 |
| 7 | **Tableau de bord centralisé** (10 sections) — squelette dès le Lot 1, complété à chaque lot | UI responsive, design existant |
| 8 | Tests complets (liste du §12 de la mission), revue sécurité, non-régression facturation/paiements/PDF/OHADA, PR finale | |

Chaque lot : branche dédiée à partir de `main` (`feat/compliance-lotN-…`), commits descriptifs, PR **brouillon**, jamais de fusion sans votre accord.

## 5. Réglementation — position de départ
- Aucun seuil légal n'est inscrit dans le code. Les règles AML/fraude seront livrées avec des **paramètres opérationnels par défaut, étiquetés « non réglementaires »**, modifiables par entreprise, et une mention « à valider par un spécialiste de la juridiction ».
- SamaFacture-Pro est un logiciel de facturation/comptabilité ; savoir si vos clients ou vous-même êtes assujettis à des obligations AML/KYC (Sénégal / UEMOA / autre) relève d'un avis juridique que je ne peux pas rendre. Le module n'affirmera ni conformité ni certification.

## 6. Décisions nécessaires (avec valeur par défaut proposée)
1. **Journal append-only vs suppression du compte / réinitialisation** : par défaut, je propose que la réinitialisation de compte **conserve** le journal d'audit (changement du comportement actuel de `auth.js` ≈ l. 977 et adaptation du test `auth-reset-history-guard`) et que les FK passent de `CASCADE` à une conservation avec anonymisation à l'expiration de la durée de rétention. Alternative : conserver le comportement actuel (journal supprimé avec le compte) — dans ce cas « append-only » ne vaut que pendant la vie du compte.
2. **Qui est « administrateur »** : par défaut, droits `compliance.*` au niveau de l'entreprise (propriétaire/administrateur/manager/comptable selon la permission) + vue multi-entreprises en lecture seule réservée à `SUNUPILOT_ADMIN_USER_IDS`.
3. **Stockage des justificatifs KYC** : par défaut, chiffrés (AES-256-GCM, clé dérivée de `DATA_ENCRYPTION_KEY`) **en base** (taille et types limités), pour éviter de dépendre d'un volume Docker ; alternative : fichiers sur volume dédié.
4. **Durées de conservation** : valeurs par défaut configurables, **aucune suppression automatique activée** (même principe que la purge analytique actuelle) tant que vous ne l'avez pas autorisée.

## 7. Garde-fous respectés pour ce lot
`main` non modifiée · aucune branche, donnée, sauvegarde ou volume supprimé · aucun paiement activé · aucun service externe appelé · seul fichier ajouté : ce document.
