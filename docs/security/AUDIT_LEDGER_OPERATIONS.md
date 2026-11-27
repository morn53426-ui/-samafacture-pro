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

En production, trois identités MySQL séparées sont utilisées :

- `DB_USER` / `DB_PASSWORD` : compte runtime de l'API, du worker PDF et des tâches applicatives. Il reçoit uniquement `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `EXECUTE`, `CREATE TEMPORARY TABLES` et `SHOW VIEW` sur la base applicative. Il ne reçoit ni privilège DDL, ni `TRIGGER`, ni `LOCK TABLES`.
- `DB_MIGRATION_USER` / `DB_MIGRATION_PASSWORD` : compte DDL distinct, transmis uniquement au service one-shot `db-migrate` (migrations initiales, évolutions et opérations de restauration). Le processus ferme son pool à la fin de la migration ; l'API reçoit des identifiants vides et vérifie uniquement que `_samafacture_schema_meta.version` est à jour.
- `DB_BACKUP_USER` / `DB_BACKUP_PASSWORD` : compte utilisé exclusivement par `backup-worker` pour `mysqldump`. Il dispose de `SELECT`, `SHOW VIEW`, `TRIGGER`, `EVENT` et `LOCK TABLES` sur cette base. MySQL exige `TRIGGER` pour exporter les triggers ; ce droit n'est donc pas un compte purement lecture seule et peut aussi modifier des triggers. Le secret reste néanmoins hors du processus HTTP et du worker PDF.
- `DB_ROOT_PASSWORD` : secret administratif utilisé uniquement par le service éphémère `db-provision` pour créer/actualiser ces comptes. Il n'est jamais injecté dans les conteneurs applicatifs.

Les trois comptes runtime, migration et sauvegarde doivent avoir des noms et mots de passe distincts en production. Le provisionnement refuse les identifiants partagés. La restauration manuelle utilise le compte DDL `DB_MIGRATION_USER`, jamais le compte runtime. Avec Docker Compose, lancer :
```bash
docker compose run --rm db-migrate node restore-backup.js /app/server/backups/NOM_ARCHIVE.sql.gz.enc
```
Le service `db-migrate` monte le volume d'archives en lecture seule et reçoit `BACKUP_ENCRYPTION_KEY` pour authentifier/déchiffrer l'archive ; la clé et le compte DDL ne sont pas transmis à l'API, au worker PDF ni au worker de sauvegarde. Dans Docker Compose, le service `db-migrate` reçoit le volume de sauvegardes en lecture seule afin que le même environnement DDL puisse vérifier et importer une archive sans donner ce droit à l'API ou au worker PDF.

Pour une restauration en production, arrêter d'abord les services applicatifs et workers (sans arrêter ni supprimer le volume MySQL), puis exécuter le script depuis le service DDL :

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml stop app backup-worker pdf-worker nginx
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml run --rm --entrypoint node db-migrate restore-backup.js /app/server/backups/NOM_ARCHIVE.sql.gz.enc
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml run --rm db-migrate
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml up -d app backup-worker pdf-worker nginx
```

Le fichier `.env` racine fournit les comptes SQL et `BACKUP_ENCRYPTION_KEY` à Docker Compose ; ne jamais transmettre la clé à une commande en argument ou l'inscrire dans des journaux. Vérifier l'archive et la base cible avant restauration. La vérification par défaut refuse une base non vide ; ne pas contourner cette protection sans approbation explicite et sauvegarde préalable.

Avec Docker Compose, `db-provision` attend MySQL sain, partage son espace réseau et se connecte à `127.0.0.1` avec le compte root local ; il n'exige donc pas que root soit accessible depuis les autres conteneurs, y compris sur un volume MySQL déjà initialisé. Il applique ensuite les privilèges ; `db-migrate` exécute ensuite les migrations, puis l'API, le worker PDF et `backup-worker` démarrent. L'API n'obtient ni compte migration, ni compte backup, ni mot de passe root. Le scheduler intégré au processus HTTP est désactivé dans ce mode ; seule l'instance `backup-worker` produit les sauvegardes. Ce worker utilise `restart: on-failure` : une désactivation volontaire (`BACKUP_ENABLED=false`) ne déclenche pas de boucle de redémarrage, tandis qu'une défaillance non nulle est relancée par Docker.

### Binlog MySQL et création des triggers

MySQL 8 active le binary log par défaut. Quand le binlog est actif et que `log_bin_trust_function_creators=OFF`, MySQL peut exiger `SUPER` lors de `CREATE TRIGGER`, même si le compte possède `TRIGGER` sur la table. Ne jamais accorder `SUPER` au compte `DB_MIGRATION_USER` pour contourner ce contrôle.

Le service Compose `mysql` démarre avec `--log-bin-trust-function-creators=ON`, ce qui permet au migrateur limité au schéma de créer les triggers nécessaires. Pour une base MySQL externe à Compose, le DBA doit activer le paramètre global avant d'exécuter les migrations et le rendre persistant dans la configuration du serveur ou du service managé :

```sql
SET GLOBAL log_bin_trust_function_creators = ON;
```

**Attention :** MySQL indique ce paramètre comme déprécié dans la documentation 8.0 ; il assouplit les vérifications de sûreté du binlog pour les fonctions et les triggers. Le compte de migration doit donc rester dédié aux migrations, et le compte de sauvegarde qui détient aussi le privilège `TRIGGER` doit rester isolé dans `backup-worker`. Réévaluer cette configuration avant toute montée vers une version MySQL où ce paramètre ne serait plus disponible. Référence : [Binary Logging Options and Variables](https://dev.mysql.com/doc/refman/8.0/en/replication-options-binary-log.html) et [Stored Program Binary Logging](https://dev.mysql.com/doc/refman/8.0/en/stored-programs-logging.html).

Le script `deploy/provision-db-users.sh` est idempotent et peut mettre à jour les privilèges sur un volume MySQL existant : il ne supprime ni ne recrée le volume, les tables métier, les événements ou les sauvegardes. Pour un déploiement hors Docker, précréer la base et les trois comptes avec des privilèges équivalents, puis exécuter le runner `node server/scripts/run-migrations.js` avec l'identité migration. Après validation du schéma, démarrer le serveur HTTP avec `DB_SKIP_MIGRATIONS=true` et `BACKUP_SCHEDULER_DISABLED=true` ; démarrer le processus séparé `node server/workers/backup-worker.js` avec le compte runtime et les variables `DB_BACKUP_USER` / `DB_BACKUP_PASSWORD`. Ne jamais injecter les secrets migration ou backup dans le service HTTP.

Sauvegarde manuelle dans Docker : `docker compose exec backup-worker node backup-now.js`.

## Modèle d'intégrité

Chaque tenant possède une séquence indépendante. Les écritures concurrentes se sérialisent via la ligne verrouillée de `pro_audit_chain_heads`. Chaque événement porte le hash HMAC de son contenu normalisé, de sa séquence, de l'horodatage, de la version de clé et du hash précédent. Des triggers MySQL refusent UPDATE et DELETE sur les événements.

Les événements ne possèdent volontairement aucune clé étrangère vers `users` : une suppression de compte ne doit pas effacer ces traces. L'identifiant du tenant et celui de l'acteur sont conservés comme références historiques ; il faut traiter les demandes d'anonymisation/rétention selon les obligations applicables et une procédure validée.

La chaîne HMAC et les triggers augmentent la résistance à l'altération, mais ne constituent pas une preuve inviolable contre un administrateur de base de données ou une personne disposant de privilèges DDL élevés. En particulier, `TRUNCATE TABLE`, `DROP TABLE`, la suppression/désactivation des triggers ou la modification des objets par un compte privilégié peuvent contourner les protections ligne par ligne. En production, il faut donc :
- utiliser les trois identités SQL séparées, le moindre privilège et des checkpoints signés hors du serveur applicatif ;
- interdire au compte runtime les privilèges `CREATE`, `ALTER`, `DROP`, `TRIGGER` et les opérations de maintenance sur le registre ; ne transmettre le privilège `TRIGGER` qu'au worker de sauvegarde isolé et au runner de migration ;
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
