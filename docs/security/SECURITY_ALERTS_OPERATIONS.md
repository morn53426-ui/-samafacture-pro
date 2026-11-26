# Exploitation — alertes de sécurité et investigations (schéma v26)

## Périmètre livré

Le lot v26 ajoute trois tables persistantes :

- `pro_security_alerts` : alertes dédupliquées par empreinte de tenant.
- `pro_security_investigations` : dossiers de suivi reliés ou non à une alerte.
- `pro_security_case_activity` : historique append-only des décisions, changements et notes.

Les trois tables ne possèdent volontairement aucune clé étrangère vers `users`, les événements d'audit ou les autres tables de ce module. La suppression d'un compte ou d'une alerte source ne doit donc pas supprimer les éléments de preuve. Les UPDATE et DELETE de l'historique d'activité sont bloqués par des triggers SQL.

## Détection automatique actuellement active

La première règle détecte au moins **5 échecs de connexion par mot de passe sur un compte connu en 15 minutes**.

- L'alerte est créée dans le tenant du compte visé.
- Les tentatives suivantes actualisent la même alerte et augmentent `occurrences`, au lieu de créer un nouvel enregistrement à chaque tentative.
- Une règle qui atteint au moins deux fois le seuil augmente la gravité à `critical`.
- Une alerte clôturée qui reçoit un nouveau signal est réouverte.
- Les tentatives sur une adresse email inconnue ne sont pas rattachées à un tenant et ne créent pas de fausse alerte dans une entreprise.
- La détection est best-effort : une indisponibilité du module de surveillance ne transforme pas le refus d'authentification en erreur serveur.

Ce seuil est un premier garde-fou, pas un moteur antifraude complet. Les règles relatives aux paiements, remboursements, factures, changements de bénéficiaire, appareils et comportements anormaux sont hors de ce lot.

## API de consultation et de triage

Toutes les routes sont sous `/api/pro`, requièrent une session authentifiée et utilisent le tenant actif résolu côté serveur.

| Route | Permission | Fonction |
|---|---|---|
| `GET /security/alerts/summary` | `security.alerts.read` | Compteurs par statut et gravité |
| `GET /security/alerts` | `security.alerts.read` | Liste paginée et filtres par statut/gravité |
| `GET /security/alerts/:id` | `security.alerts.read` | Détail, activité et dossiers liés |
| `POST /security/alerts/:id/acknowledge` | `security.alerts.manage` | Prendre en compte une alerte ouverte |
| `POST /security/alerts/:id/assign` | `security.alerts.manage` | Assigner à un membre actif du même tenant |
| `POST /security/alerts/:id/resolve` | `security.alerts.manage` | Clôturer avec décision motivée |
| `POST /security/alerts/:id/false-positive` | `security.alerts.manage` | Marquer comme faux positif avec justification |
| `GET /security/investigations` | `security.investigations.read` | Liste paginée |
| `GET /security/investigations/:id` | `security.investigations.read` | Détail et historique |
| `POST /security/investigations` | `security.investigations.manage` | Ouvrir un dossier lié à une alerte ou manuel |
| `PATCH /security/investigations/:id` | `security.investigations.manage` | Changer statut, priorité, affectation ou décision |
| `POST /security/investigations/:id/notes` | `security.investigations.manage` | Ajouter une note au fil append-only |

Les assignations sont validées contre les membres actifs du tenant. Un dossier actif unique est autorisé par alerte. La clôture d'une investigation liée fait passer l'alerte associée à l'état résolu. Les résolutions et faux positifs exigent une justification.

## Rôles

- Propriétaire et administrateur : tous les droits.
- Manager : lecture et gestion des alertes et investigations.
- Comptable : lecture seule des alertes et dossiers.
- Rôles personnalisés : droits indépendants `security.alerts.read`, `security.alerts.manage`, `security.investigations.read` et `security.investigations.manage`.

Les permissions de gestion impliquent la permission de lecture correspondante, mais l'inverse n'est pas vrai.

## Données sensibles et journalisation

- Chaque création/actualisation d'alerte, prise en charge, assignation, décision, ouverture de dossier, modification et note ajoute aussi un événement au registre HMAC du Lot 1.
- Les activités et événements sont écrits dans la même transaction que la mutation de statut/affectation.
- Les notes masquent les jetons Bearer, IBAN, emails, et numéros de carte détectés. Les champs de métadonnées passent aussi par le normaliseur du registre d'audit.
- Ne stockez pas de mots de passe, numéros de carte complets, CVV ou secrets dans les notes d'investigation. Les notes restent des éléments de suivi internes, pas un coffre de preuves ou un stockage documentaire chiffré.
- Les réponses API du centre sont marquées `no-store`.

## Limites de ce lot

Aucune notification email/SMS/push n'est envoyée. Aucun prestataire KYC, AML ou sanctions n'est appelé. Aucun signal de paiement réel ou de prestataire de paiement n'est activé. Les alertes de paiements et règles OHADA/AML feront l'objet d'un moteur de détection séparé, avec seuils validés et tests antifraude dédiés.

## Migration et retour arrière

- Migration additive : `015_security_alerts_investigations.sql`, schéma v26.
- Le script de migration est idempotent ; les triggers sont créés uniquement s'ils ne sont pas déjà présents.
- Le rollback `015_security_alerts_investigations.down.sql` retire uniquement les triggers d'immutabilité. Les tables et toutes les activités/alertes/dossiers sont conservés.
