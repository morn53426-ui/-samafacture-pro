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

## Consultation et exports

- `GET /api/pro/audit-events` accepte les filtres `from`, `to`, `category`, `severity`, `event_type`, `actor_user_id`, `q`, ainsi que `page` et `limit`.
- `GET /api/pro/audit-events/export.csv` réutilise les filtres, produit un CSV UTF-8 avec BOM et protège les cellules susceptibles d'être interprétées comme des formules par les tableurs. La limite est de 10 000 lignes ; l'en-tête `X-Export-Truncated` signale un export tronqué.
- `GET /api/pro/audit-events/export.pdf` produit un rapport PDF A4 paysage, limité à 1 000 lignes. Chromium n'est pas autorisé à contacter des hôtes réseau externes pendant le rendu.
- Chaque export réussi ajoute `audit.events.exported` au registre après la lecture des lignes. L'événement conserve le format, le nombre de lignes, l'indication de troncature et les filtres, sans enregistrer la valeur de la recherche.
- La permission `audit.read` autorise la consultation ; la permission distincte `audit.export` est exigée pour exporter. Dans ce premier lot, seuls les rôles disposant de tous les droits (propriétaire/administrateur) détiennent `audit.export`. Les rôles Manager et Comptable peuvent consulter si leur rôle possède `audit.read`, mais pas exporter.

## Comptes SQL et migrations

En production, le serveur utilise deux identités MySQL distinctes :

- `DB_USER` / `DB_PASSWORD` : compte runtime de l'API, du worker et des tâches applicatives. Il reçoit uniquement `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `EXECUTE`, `CREATE TEMPORARY TABLES`, `LOCK TABLES` et `SHOW VIEW` sur la base de l'application. Il ne reçoit ni `CREATE`, `ALTER`, `DROP`, `INDEX`, ni `TRIGGER`.
- `DB_MIGRATION_USER` / `DB_MIGRATION_PASSWORD` : compte distinct réservé à l'initialisation et aux migrations, avec les privilèges DDL sur cette seule base. Le serveur ferme son pool de migration à la fin de l'initialisation.
- `DB_ROOT_PASSWORD` : secret administratif utilisé uniquement par le service éphémère `db-provision` de Docker Compose pour créer/actualiser ces comptes. Il n'est pas injecté dans le conteneur applicatif.

Configurer les deux comptes avec des mots de passe forts et différents. En `NODE_ENV=production`, le démarrage de l'API refuse les identifiants de migration absents ou identiques au compte runtime. Le compte de migration ne doit pas être accordé au worker PDF.

Avec Docker Compose, le service `db-provision` attend que MySQL soit sain, applique les privilèges, puis l'API démarre seulement si le provisionnement réussit. Le script `deploy/provision-db-users.sh` est idempotent et s'exécute aussi sur un volume MySQL existant : il ne recrée ni ne supprime le volume, les tables métier, les événements ou les sauvegardes. Pour un déploiement non Docker, précréer la base, les deux comptes et leurs privilèges équivalents avant de lancer l'API.

La migration nécessite un compte distinct car elle crée les tables et triggers du registre. Ne réutilisez pas le compte runtime pour appliquer manuellement une migration.

## Modèle d'intégrité

Chaque tenant possède une séquence indépendante. Les écritures concurrentes se sérialisent via la ligne verrouillée de `pro_audit_chain_heads`. Chaque événement porte le hash HMAC de son contenu normalisé, de sa séquence, de l'horodatage, de la version de clé et du hash précédent. Des triggers MySQL refusent UPDATE et DELETE sur les événements.

Les événements ne possèdent volontairement aucune clé étrangère vers `users` : une suppression de compte ne doit pas effacer ces traces. L'identifiant du tenant et celui de l'acteur sont conservés comme références historiques ; il faut traiter les demandes d'anonymisation/rétention selon les obligations applicables et une procédure validée.

La chaîne HMAC et les triggers augmentent la résistance à l'altération, mais ne constituent pas une preuve inviolable contre un administrateur de base de données ou une personne disposant de privilèges DDL élevés. En particulier, `TRUNCATE TABLE`, `DROP TABLE`, la suppression/désactivation des triggers ou la modification des objets par un compte privilégié peuvent contourner les protections ligne par ligne. En production, il faut donc :
- utiliser des identifiants SQL avec les privilèges minimaux nécessaires et séparer le compte d'exécution applicatif du compte de migration ;
- interdire au compte d'exécution les privilèges `DROP`, `ALTER`, `TRIGGER` et les opérations de maintenance non nécessaires sur le registre ;
- exporter périodiquement les têtes de chaîne et des checkpoints signés vers un stockage séparé et non modifiable par le serveur applicatif ;
- conserver les sauvegardes chiffrées et les clés hors du même domaine d'administration ;
- surveiller les accès administrateur MySQL et système hôte.

## Rollback

Le script `server/database/rollbacks/014_audit_ledger.down.sql` retire uniquement les triggers d'immuabilité après arrêt des versions applicatives qui écrivent dans le registre. Il conserve les tables, les événements et les têtes de chaîne. Il n'existe volontairement aucune instruction de suppression des preuves dans ce rollback.

## Couverture fonctionnelle du premier lot

Le premier lot journalise actuellement :
- inscription et événements d'authentification (succès/échec de connexion par mot de passe, connexion Google, déconnexion et réinitialisation du mot de passe) ;
- création de facture/devis, conversion devis-facture, duplication, changement de statut, suppression de devis et paiement manuel ;
- création, modification et suppression de clients ;
- consultations du registre et vérifications d'intégrité.

Les événements de facture, paiement et cycle de vie client sont ajoutés dans la transaction métier correspondante. Les métadonnées utilisent une liste de champs modifiés et des valeurs non sensibles ; elles ne sérialisent pas les corps de requête.

L'espace professionnel possède désormais une interface de consultation avec filtres, recherche, pagination et vérification d'intégrité. Les exports PDF/CSV, l'attribution d'alertes, les dossiers d'investigation, le traitement des événements de factures récurrentes, d'abonnements et des paiements fournisseurs/webhooks restent à compléter.

Aucun moteur de détection de fraude, aucun module AML/KYC ni aucun tableau de bord central conformité n'est encore livré. Ce premier lot ne doit pas être présenté comme une solution complète ou une certification de conformité.
