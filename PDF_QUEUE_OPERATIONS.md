# Exploitation de la file PDF

## Transport et garanties

Les nouvelles tâches sont ajoutées au stream Redis `samafacture:pdf:stream` dans le consumer group `samafacture:pdf:workers`. Le hash `samafacture:pdf:job:<id>` conserve le propriétaire et le statut ; un script Lua écrit le hash puis ajoute l'entrée au stream. Si `XADD` échoue, le script supprime le hash provisoire et renvoie l'erreur Redis.

Le worker lit avec `XREADGROUP`. Une entrée reste dans la Pending Entries List (PEL) jusqu'à ce que le rendu soit enregistré dans un état terminal. Le worker écrit `completed` ou `failed`, applique le TTL au hash, puis exécute `XACK` et `XDEL`. Si le processus s'arrête avant l'acquittement, le message reste pending et peut être repris avec `XAUTOCLAIM` par un autre worker.

La livraison est *au moins une fois*, pas exactement une fois. Si un worker s'arrête après avoir écrit le PDF mais avant d'enregistrer l'état terminal, le rendu peut être relancé. Le chemin de sortie est déterministe par identifiant de tâche ; la génération doit rester réexécutable et ne doit pas effectuer d'effet métier externe non idempotent.

## Réessais et délai de visibilité

- Délai de visibilité par défaut : 30 minutes (`PDF_JOB_CLAIM_IDLE_MS=1800000`).
- Rétention du PDF sur disque : 25 heures par défaut (`PDF_FILE_RETENTION_SECONDS=90000`), soit au moins 24 heures de marge au-delà du TTL des métadonnées de tâche (1 heure par défaut). Le worker supprime toutes les 15 minutes uniquement les fichiers réguliers dont le nom est un UUID suivi de `.pdf` et dont l'âge dépasse cette rétention ; les autres fichiers et les liens symboliques sont ignorés.
- Nombre maximal de tentatives : 3 (`PDF_JOB_MAX_ATTEMPTS=3`).
- Une erreur transitoire conserve l'entrée dans la PEL sans `XACK`. Elle est réclamée après le délai d'inactivité.
- Après la dernière tentative, le statut passe à `failed`, le hash conserve le résultat pendant `PDF_JOB_TTL_SECONDS`, puis l'entrée est acquittée et supprimée.
- Une entrée dont le hash est déjà terminal est acquittée sans régénérer le PDF ; cela couvre l'arrêt entre l'écriture de l'état terminal et `XACK`.

Le délai de visibilité doit être supérieur au temps maximal habituel de génération. Pour des PDF pouvant prendre plus de 30 minutes, augmentez `PDF_JOB_CLAIM_IDLE_MS` afin d'éviter qu'un deuxième worker ne réclame le même rendu pendant qu'il est toujours actif.

## Compatibilité de la file historique

Au démarrage, le worker déplace les éléments restants de l'ancienne liste `samafacture:pdf:queue` vers le stream. Le script Lua lit l'élément avec `LINDEX`, effectue `XADD`, puis ne fait `LPOP` qu'après un ajout réussi, le tout dans une seule opération Redis. Les producteurs actuels n'ajoutent plus de nouveaux éléments dans l'ancienne liste.

## Persistance Redis requise

Le Compose du dépôt active AOF (`appendonly yes`) et conserve Redis dans un volume Docker. Cela réduit le risque de perte lors d'un redémarrage du processus. Une perte complète du volume Redis ou une configuration externe sans persistance peut néanmoins supprimer les streams et la PEL. En production, configurez et surveillez la persistance/les sauvegardes Redis selon le RPO/RTO requis.

## Surveillance et recette de staging

Surveillez :
- la longueur du stream et le nombre d'entrées pending ;
- l'âge de la plus ancienne entrée pending ;
- les statuts `queued`, `processing`, `completed` et `failed` ;
- les erreurs Redis, les échecs Puppeteer et les tâches arrivant au nombre maximal de tentatives.

Avant la production, exécutez une recette de crash sur staging : lancer une génération, arrêter brutalement le worker après lecture du message, démarrer un autre worker et vérifier que l'entrée est réclamée, que le PDF est accessible par son propriétaire et que le nombre de factures ou d'autres effets métier n'a pas changé. Ne supprimez pas manuellement le stream ni son consumer group pendant que des entrées sont pending.
