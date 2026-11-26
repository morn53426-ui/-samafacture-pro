# Registre d'audit signé — exploitation et limites du premier lot

## Configuration de la clé

En production, définir avant d'utiliser `/api/pro/audit-events` :

```dotenv
AUDIT_LOG_HMAC_KEY=<clé aléatoire persistante d'au moins 32 octets>
AUDIT_LOG_HMAC_KEY_VERSION=1
```

Générer une clé avec un gestionnaire de secrets ou `openssl rand -hex 32`. Ne jamais commiter la valeur, l'envoyer dans un ticket, l'écrire dans un journal applicatif ou la régénérer sur une base contenant déjà des événements. La clé doit être sauvegardée dans le coffre de secrets de l'exploitation et dans une procédure de récupération séparée du dump SQL.

Sans clé HMAC valide en production, l'API répond HTTP 503 avec `AUDIT_LEDGER_KEY_NOT_CONFIGURED`. Le service ne génère jamais silencieusement une clé en production.

## Rotation

Le service lit un trousseau JSON indexé par version. Pour une rotation vers la version 2, conserver l'ancienne clé et la nouvelle dans `AUDIT_LOG_HMAC_KEYRING`, puis changer la version active :

```dotenv
AUDIT_LOG_HMAC_KEY_VERSION=2
AUDIT_LOG_HMAC_KEYRING={"1":"<ancienne-cle>","2":"<nouvelle-cle>"}
```

Déployer d'abord la nouvelle configuration à l'ensemble des workers, puis reprendre les écritures avec la nouvelle version. Ne retirer une clé historique qu'après preuve qu'aucun événement ne dépend de cette version et après approbation de la procédure de conservation. Les valeurs d'exemple ci-dessus sont des placeholders, pas des secrets utilisables. Le trousseau stocke les matériaux source pour chaque version ; le service applique la même dérivation HKDF lors de la vérification.

## API disponible

- `GET /api/pro/audit-events?page=1&limit=25`
- filtres optionnels : `from=YYYY-MM-DD`, `to=YYYY-MM-DD` (UTC), `category`, `severity`, `event_type`, `actor_user_id`, `q`.
- `GET /api/pro/audit-events/integrity` vérifie la chaîne du tenant actif.

L'accès est protégé par l'authentification existante, la résolution du tenant et la permission `audit.read`. Chaque lecture et chaque vérification est elle-même enregistrée dans le registre. Les réponses ne sont pas mises en cache.

## Modèle d'intégrité

Chaque tenant possède une séquence indépendante. Les écritures concurrentes se sérialisent via la ligne verrouillée de `pro_audit_chain_heads`. Chaque événement porte le hash HMAC de son contenu normalisé, de sa séquence, de l'horodatage, de la version de clé et du hash précédent. Des triggers MySQL refusent UPDATE et DELETE sur les événements.

Les événements ne possèdent volontairement aucune clé étrangère vers `users` : une suppression de compte ne doit pas effacer ces traces. L'identifiant du tenant et celui de l'acteur sont conservés comme références historiques ; il faut traiter les demandes d'anonymisation/rétention selon les obligations applicables et une procédure validée.

La chaîne HMAC et les triggers augmentent la résistance à l'altération, mais ne remplacent pas :
- des identifiants SQL de production à privilèges minimaux ;
- la sauvegarde chiffrée et la restauration contrôlée ;
- la conservation hors site des clés et des preuves ;
- la surveillance des accès administrateur MySQL et du système hôte.

## Rollback

Le script `server/database/rollbacks/014_audit_ledger.down.sql` retire uniquement les triggers d'immuabilité après arrêt des versions applicatives qui écrivent dans le registre. Il conserve les tables, les événements et les têtes de chaîne. Il n'existe volontairement aucune instruction de suppression des preuves dans ce rollback.

## Limites fonctionnelles de ce lot

Ce lot établit le registre, l'API de consultation et le contrôle de chaîne. Il ne journalise pas encore automatiquement toutes les mutations de connexion, factures, clients, paiements et abonnements. Il ne fournit pas encore l'interface frontend dédiée, les exports, les alertes, AML ou KYC. Ces intégrations seront réalisées par étapes avec des tests transactionnels sur chaque route métier.
