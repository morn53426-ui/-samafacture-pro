# Dimensionnement production — cible 10 000 VU

## Profil de départ recommandé

Sur une seule machine de staging/production moyenne :

- Nginx : 1 instance
- API : 3 conteneurs
- `WEB_CONCURRENCY=2` par conteneur
- `DB_POOL_SIZE=10` par worker
- PDF worker : 2 conteneurs au départ
- Redis : 1 instance dédiée, persistance activée
- MySQL : 1 instance dédiée avec sauvegardes et surveillance

Cela représente théoriquement jusqu'à `3 × 2 × 10 = 60` connexions MySQL côté API. Les workers PDF ont leur propre pool et doivent être inclus dans le calcul. Ne pas augmenter `DB_POOL_SIZE` sans mesurer l'utilisation de `max_connections`.

## Règle de calcul

```text
connexions API max = conteneurs API × workers par conteneur × DB_POOL_SIZE
```

Puis ajouter les pools des workers et une marge pour les opérations d'administration.

Exemple :

```text
3 × 2 × 10 = 60 API
2 PDF workers × 5 = 10 PDF
≈ 70 connexions potentielles
```

La valeur réelle doit rester sous `max_connections` avec une marge de sécurité.

## Montée en charge

Ne passez pas directement à 10 000 VU. Validez :

1. 100 VU
2. 500 VU
3. 1 000 VU
4. 5 000 VU
5. 10 000 VU

À chaque palier, relever : p50, p95, p99, RPS, erreurs, CPU, RAM, connexions MySQL, temps SQL, Redis et longueur de queue PDF.

## PDF

Les routes PDF asynchrones utilisent Redis + workers séparés. La route synchrone reste disponible pour compatibilité.

Pour plusieurs machines physiques, le volume Docker `pdf_jobs` ne suffit pas : utiliser un stockage objet partagé (S3/MinIO compatible) pour les fichiers PDF terminés.

## Redis

Le compose utilise `volatile-lru` : les clés avec expiration peuvent être évincées en cas de pression mémoire, mais la liste de queue PDF ne doit pas être évincée. Surveillez la mémoire et dimensionnez Redis avant une charge importante.

## Certification

Cette configuration est une base de montée en charge, pas une garantie de 10 000 utilisateurs. La capacité finale doit être déterminée par un test k6 exécuté sur l'infrastructure cible.

## Build reproductible

Le Dockerfile accepte encore l'absence de lockfile pour le développement. En CI/production, construire avec :

```bash
docker build --build-arg REQUIRE_LOCKFILE=true -t samafacture-pro .
```

Après génération du vrai `server/package-lock.json`, ce build doit devenir le chemin normal de production.
