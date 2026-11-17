# Sauvegardes hors serveur — procédure opérateur

**État actuel :** le backend crée des sauvegardes dans le volume Docker local `app_backups`. Cette procédure décrit comment copier les archives vers un stockage indépendant compatible S3 avec un outil installé sur l'hôte. Elle n'active pas à elle seule une réplication distante : l'administrateur doit configurer le stockage, les identifiants, la planification et tester la restauration.

## 1. Préconditions

- [ ] `BACKUP_ENABLED=true`.
- [ ] `BACKUP_ENCRYPTION_KEY` configurée en production avec une clé aléatoire forte (32 octets / 64 caractères hexadécimaux, selon le validateur de l'application).
- [ ] La clé est conservée dans un coffre de secrets séparé du VPS et du bucket. Sa perte rend les archives chiffrées inutilisables.
- [ ] Un bucket distant dans un compte/projet indépendant de l'hébergement de l'application.
- [ ] Versioning / protection contre suppression et politique de rétention du fournisseur configurés côté stockage.
- [ ] Un compte ou une clé d'accès limitée à l'envoi des sauvegardes dans le préfixe dédié, sans droit de supprimer les versions précédentes.
- [ ] Un chemin de configuration rclone protégé sur le serveur, hors du dépôt Git.

Les archives de production doivent porter l'extension `.sql.gz.enc`. Ne téléversez pas de dump non chiffré.

## 2. Identifier le volume local

Depuis le dossier du projet :

```bash
docker compose --env-file server/.env config --volumes
docker volume ls
```

Identifiez le volume Docker monté sur `/app/server/backups` pour le service `app`. Le nom est généralement préfixé par le nom du projet Compose ; vérifiez-le avec `docker volume inspect` et ne choisissez pas un volume uniquement par ressemblance.

## 3. Configurer la destination S3-compatible

Installez rclone sur l'hôte et configurez une destination distante avec `rclone config`. Les identifiants ne doivent pas être enregistrés dans le dépôt. Le fichier de configuration doit être lisible uniquement par l'administrateur (`chmod 600`).

Exemple de variables à adapter dans un shell protégé :

```bash
export BACKUP_VOLUME='nom_exact_du_volume_app_backups'
export RCLONE_CONFIG='/etc/samafacture/rclone.conf'
export BACKUP_REMOTE='sama-backups:nom-du-bucket/samafacture/production'
```

## 4. Copier sans effacer les archives distantes

Exécutez une copie depuis le volume en lecture seule. Remplacez le nom de l'image rclone par une version fixe, validée et approuvée par l'administrateur, plutôt que de garder `latest` dans une automatisation permanente.

```bash
docker run --rm \
  --mount type=volume,src="$BACKUP_VOLUME",dst=/source,readonly \
  --mount type=bind,src="$RCLONE_CONFIG",dst=/config/rclone/rclone.conf,readonly \
  rclone/rclone:latest copy /source "$BACKUP_REMOTE" \
  --include 'samafacture-*.sql.gz.enc' \
  --immutable --checkers 4 --transfers 2
```

Après la copie, vérifiez le contenu du bucket et comparez les archives :

```bash
docker run --rm \
  --mount type=volume,src="$BACKUP_VOLUME",dst=/source,readonly \
  --mount type=bind,src="$RCLONE_CONFIG",dst=/config/rclone/rclone.conf,readonly \
  rclone/rclone:latest check /source "$BACKUP_REMOTE" \
  --include 'samafacture-*.sql.gz.enc'
```

N'utilisez pas `sync` comme première mise en place : il peut supprimer des objets distants absents de la source locale. La copie `copy --immutable` est volontairement non destructive.

## 5. Planification

Après avoir vérifié manuellement une copie et un `check` réussis, programmez le transfert sur l'hôte après l'heure de sauvegarde locale (par exemple 03:00 si les sauvegardes locales sont prévues à 02:00). Enregistrez les logs et envoyez une alerte si le transfert échoue ou si aucune nouvelle archive n'a été copiée dans le délai attendu.

Surveillez également :
- date de la dernière sauvegarde locale réussie ;
- date de la dernière copie distante vérifiée ;
- âge et taille de l'archive la plus récente ;
- espace disponible et rétention du bucket ;
- expiration/rotation des clés d'accès.

La politique de rétention du stockage distant doit être configurée indépendamment. Ne supprimez pas les anciennes versions avant d'avoir validé une restauration depuis une sauvegarde récente et une sauvegarde plus ancienne.

## 6. Tester une restauration réelle

Téléchargez une archive distante dans un répertoire temporaire, puis restaurez-la dans une base de test vide, jamais dans la base de production :

```bash
rclone copy "$BACKUP_REMOTE/samafacture-ARCHIVE.sql.gz.enc" /tmp/samafacture-restore-test/
```

Configurez un fichier d'environnement de test avec une base MySQL dédiée et la même `BACKUP_ENCRYPTION_KEY`, puis depuis `server/` :

```bash
npm run restore -- /tmp/samafacture-restore-test/samafacture-ARCHIVE.sql.gz.enc
```

Vérifiez ensuite les comptes de lignes/tables, les factures, les paiements, les clients et l'accès à l'application de test. Documentez la durée de restauration (RTO) et la perte maximale de données (RPO). N'utilisez pas `RESTORE_ALLOW_NON_EMPTY=true` pour ce test.

## 7. Critère de sortie

La sauvegarde hors serveur n'est considérée active que lorsque :
1. le transfert est planifié et supervisé ;
2. une archive chiffrée est vérifiée dans le bucket indépendant ;
3. une restauration réelle depuis cette archive a réussi dans une base distincte ;
4. la clé de chiffrement est récupérable séparément ;
5. le responsable d'exploitation a accepté le RPO/RTO et la politique de conservation.

**État de l'audit :** intégration distante non configurée par cette PR ; procédure opérateur fournie, exécution et preuve de restauration à réaliser par l'administrateur de l'hébergement.
