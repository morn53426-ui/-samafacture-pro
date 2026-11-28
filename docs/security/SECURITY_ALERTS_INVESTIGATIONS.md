# Alertes de sécurité et dossiers d’investigation

## Objectif et portée

La version 26 ajoute un centre de traitement interne pour les alertes dérivées du registre d’audit signé. Le dispositif fournit un signal de surveillance et un historique d'investigation ; il ne prouve pas une fraude et ne qualifie pas juridiquement une opération de blanchiment.

Aucun service KYC/AML tiers, registre externe, fournisseur de paiement ou service d'identification n'est appelé par cette fonctionnalité. Elle ne bloque aucun compte, ne suspend aucun paiement et ne déclenche aucun débit ou remboursement.

## Règles de détection initiales

### Échecs de connexion répétés

| Élément | Valeur |
|---|---|
| Événement source | `auth.login.failed` |
| Règle | `auth.login.failed.threshold` |
| Seuil | 5 échecs |
| Fenêtre | 15 minutes glissantes |
| Portée | Un même compte existant dans un tenant |
| Gravité | Élevée |
| Déduplication | Une empreinte stable par tenant et identifiant interne de compte |

Le détecteur ne s'appuie pas sur l'adresse email, le mot de passe ni sur le texte d'une requête. Les tentatives visant des comptes inexistants ne sont pas rattachées à un tenant : elles restent journalisées dans le registre global mais ne produisent pas, dans cette première règle, d'alerte tenant-scoped.

Les tentatives qui suivent la création mettent à jour l'alerte existante. À chaque lecture de l'API, le compteur `attempts_in_window` est recalculé depuis les événements source du registre sur les 15 dernières minutes ; la valeur signée lors de la création reste un instantané historique et n'est pas présentée comme un compteur courant. Une alerte résolue ou écartée est rouverte si une nouvelle série atteint de nouveau le seuil. Le déclenchement est exécuté dans la même transaction que l'événement d'audit source. Si un dossier existant est résolu ou clôturé, il est lui aussi rouvert à l'état `open` ; un événement `case.reopened` est ajouté à son historique append-only, et l'identifiant du dossier est inclus dans l'événement `security.alert.reopened` du registre signé.

### Montant de facture inhabituel

| Élément | Valeur |
|---|---|
| Événement source | `invoice.created` pour un document de type `facture` uniquement |
| Règle | `billing.invoice.amount_outlier` |
| Référence | Médiane des factures de la même entreprise et de la même devise |
| Historique minimal | 20 factures comparables au cours des 90 derniers jours |
| Échantillon | Jusqu'aux 50 factures comparables les plus récentes |
| Seuil | Montant actuel supérieur ou égal à 5 fois la médiane historique |
| Gravité | Modérée |
| Déduplication | Une empreinte stable par tenant et identifiant de facture |

Cette règle exclut les devis, les autres entreprises et les autres devises. Elle ne convertit aucune devise. Tant que l'entreprise ne dispose pas d'au moins 20 factures comparables dans la fenêtre de 90 jours, aucun signal de montant atypique n'est créé. L'événement signé `security.alert.created` conserve le montant observé, la médiane, la devise, la taille de l'échantillon et le multiplicateur utilisés.

Le multiplicateur de cinq est une heuristique initiale de triage, pas une règle comptable ou réglementaire, ni une preuve de fraude. Une facture exceptionnelle peut être légitime ; un responsable doit examiner l'alerte et le contexte commercial avant toute décision. Le seuil est fixe dans ce lot et ne constitue pas encore un paramètre réglable par entreprise.

## Cycle de traitement

Les statuts d'alerte sont `open`, `investigating`, `resolved` et `dismissed`.

Un administrateur ou propriétaire peut ouvrir un dossier une seule fois par alerte encore active (`open` ou `investigating`). Une alerte `resolved` ou `dismissed` ne peut pas être rattachée à un nouveau dossier ; seul un nouveau signal détecté peut la rouvrir automatiquement. Tant qu'un dossier est `open` ou `investigating`, le statut de l'alerte ne peut pas être remis à `open`, résolu ou écarté directement ; les statuts de l'alerte et du dossier sont pilotés ensemble par le cycle d'investigation. Le dossier suit les états `open`, `investigating`, `resolved` et `closed`. Les transitions sont vérifiées côté serveur. La progression et l'acteur sont enregistrés dans `pro_security_case_events`, table append-only protégée par des triggers SQL. Les changements métier et leurs entrées dans le registre d'audit signé sont atomiques.

La première version ne collecte pas de commentaires libres, de justificatifs d'identité ou de documents bancaires. L'investigation est donc une piste de travail interne, volontairement limitée aux faits observables dans l'application.

## API et permissions

- `GET /api/pro/security-alerts` : liste paginée, filtres statut/gravité.
- `PUT /api/pro/security-alerts/:id/status` : changement d'état contrôlé.
- `GET /api/pro/security-cases` : liste paginée des dossiers.
- `POST /api/pro/security-cases` : ouverture idempotente d'un dossier depuis une alerte.
- `PUT /api/pro/security-cases/:id/status` : transition du dossier.
- `GET /api/pro/security-cases/:id/events` : historique du dossier.

Les endpoints sont tenant-scoped et utilisent les permissions `security.read` et `security.manage`. Dans ce lot, les rôles propriétaire/administrateur disposent des permissions via leur wildcard ; aucun accès n'est ajouté aux rôles manager, comptable ou lecture seule. Les réponses portent `Cache-Control: no-store`.

## Stockage et exploitation

La migration v26 ajoute `pro_security_alerts`, `pro_security_cases` et `pro_security_case_events`. Les clés uniques empêchent les alertes dupliquées par empreinte et l'ouverture de plusieurs dossiers pour la même alerte dans un tenant. Les tables d'historique ne possèdent pas de FK vers les utilisateurs ou entre elles, afin de ne pas effacer les preuves par cascade lors d'une suppression de compte.

Le rollback v26 retire seulement les triggers de la table d'événements de dossier. Il conserve les tables, alertes, dossiers et historiques ; il n'est pas conçu comme une suppression de données.

Les triggers empêchent UPDATE/DELETE sur l'historique via les privilèges applicatifs habituels, mais ne protègent pas d'un administrateur MySQL ayant les privilèges DDL nécessaires pour désactiver les triggers, tronquer ou supprimer les tables. Conserver les comptes applicatifs au moindre privilège, séparer les comptes de migration et sauvegarder les preuves hors de portée de l'application.

## Limites connues et suite

- Deux règles de détection sont incluses : échecs répétés de connexion d'un compte connu et montant de facture inhabituel par rapport à la médiane historique de la même devise.
- Les événements d'authentification des comptes inexistants ne sont pas encore agrégés dans un tableau de surveillance globale.
- Pas de détection de transaction atypique, de fraude de facture, de fraude interne, de blanchiment, de sanctions ou de risque client.
- Pas de collecte ou de vérification KYC réelle ; pas de scoring juridique AML ; aucune certification réglementaire n'est revendiquée.
- La configuration des seuils par entreprise, la gestion multi-règles administrable, les preuves externes, les exports d'investigation et le tableau de bord centralisé restent hors de ce lot.

Chaque alerte doit être examinée par un utilisateur autorisé avant toute décision opérationnelle.