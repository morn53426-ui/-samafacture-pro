# Test de charge 10 000 utilisateurs simultanés

Ce test ne doit pas être présenté comme une preuve de capacité tant qu'il n'a pas été exécuté sur une infrastructure représentative de la production.

## Démarrage multi-instance

```bash
docker compose --env-file server/.env up -d --build
docker compose --env-file server/.env up -d --scale app=3
```

L'API publique passe par Nginx sur `HTTP_PORT` (4000 par défaut). Redis est utilisé pour les événements Socket.IO et le rate-limit partagé.

## Test avec k6

Installer k6 sur la machine de charge, puis :

```bash
k6 run -e BASE_URL=http://localhost:4000 load/k6-10000.js
```

Pour un test réaliste, renseigner `TEST_EMAIL` et `TEST_PASSWORD` d'un compte de charge dédié ou utiliser un mécanisme de préparation de données. Ne jamais lancer ce test avec un compte client réel.

## Objectifs indicatifs

- erreurs HTTP < 1 % ;
- p95 API standard < 500 ms ;
- p99 API standard < 1 s ;
- aucune collision de numéro de facture ;
- aucune fuite inter-utilisateur ;
- MySQL sans saturation persistante du pool ;
- mémoire stable sur les instances Node ;
- file PDF maîtrisée.

Les objectifs doivent être recalibrés selon les CPU/RAM/IOPS réels du serveur.
