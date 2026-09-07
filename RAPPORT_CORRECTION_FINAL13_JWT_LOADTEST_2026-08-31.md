# Rapport de correction — FINAL13 — Load Test JWT

Date : 2026-08-31

## Problème constaté

Le script `load/prepare-test-users.js` introduisait `require('dotenv')`. Or le script est exécuté depuis `load/` et les dépendances npm sont isolées dans `server/`. Sur Windows, Node ne trouvait donc pas `dotenv` et arrêtait le test avant la préparation des utilisateurs.

Erreur observée :

`Error: Cannot find module 'dotenv'`

## Correction appliquée

Seul `load/prepare-test-users.js` a été modifié.

- Suppression de la dépendance directe à `dotenv` dans le script de charge.
- Lecture locale de `server/.env` avec les modules natifs Node (`fs` / `path`).
- Les variables déjà présentes dans l'environnement restent prioritaires.
- `JWT_SECRET` est récupéré depuis le même `server/.env` que le serveur.
- Les dépendances `bcryptjs` et `jsonwebtoken` continuent d'être résolues depuis `server/package.json` via `createRequire`.
- Aucun code métier du serveur, aucune route, aucun schéma SQL et aucun test existant n'a été supprimé ou réécrit.

## Vérifications

- Syntaxe Node de `load/prepare-test-users.js` : OK (`node --check`).
- Aucune occurrence de `require('dotenv')` restante dans ce script.
- Le script continue de refuser `NODE_ENV=production`.
- Le secret JWT n'est pas remplacé lorsqu'il est déjà fourni par l'environnement.

## Procédure de test Windows

Depuis la racine du projet :

```bash
cd server
npm install
cd ..
bash test-scalabilite.sh
```

Il ne faut pas installer `dotenv` dans `load/`.

## Limite de validation

Le ZIP d'audit ne contient volontairement pas le fichier `server/.env` réel. La validation complète de la création des 1000 utilisateurs nécessite donc l'environnement local avec MySQL démarré et le `server/.env` utilisé par l'instance en cours.
