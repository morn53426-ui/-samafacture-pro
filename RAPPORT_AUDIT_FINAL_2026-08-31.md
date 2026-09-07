# SamaFacturePro — Rapport d'audit final et corrections

Date : 31 août 2026  
Version : FINAL_AUDIT_2026-08-31  
Périmètre : backend Node/Express, MySQL, dashboard, authentification, personnalisation entreprise, tests de régression et benchmark de charge.

## 1. Résumé exécutif

La version auditée était globalement avancée, mais deux défauts importants expliquaient les derniers résultats :

1. le benchmark dashboard utilisait un seul JWT pour plusieurs connexions et déclenchait donc le rate-limit `429` ; ce résultat ne mesurait pas la capacité multi-utilisateurs ;
2. `/api/health` exécutait `SELECT 1` contre MySQL à chaque sonde et pouvait produire des `503` sous forte concurrence ;
3. les anciennes bases pouvaient ne pas posséder la colonne `users.facture_personnalisation`, alors que `PUT /api/auth/entreprise` l'utilisait, ce qui pouvait provoquer le `500` observé dans Paramètres ;
4. la dernière génération de tests avait également rencontré un problème de cycle de vie avec `after is not defined`. Le runner livré ici n'enregistre plus de teardown global implicite dans `setup.js` : chaque fichier de test possède son propre hook Node Test.

## 2. Corrections appliquées

### 2.1 Dashboard

- remplacement de la destructuration SQL fragile `const [[summary]]` par une lecture sûre de `summaryRows?.[0]` ;
- maintien du cache court par utilisateur ;
- maintien de la déduplication des requêtes concurrentes par utilisateur ;
- résultats de listes protégés par `|| []` ;
- comportement optimisé pour un compte sans facture ;
- ajout d'une fonction d'invalidation du cache pour permettre une intégration future avec les routes mutantes sans casser l'API.

### 2.2 Santé et readiness

`GET /api/health` est maintenant une vraie **liveness probe** : aucune requête SQL n'est effectuée.

`GET /api/ready` reste la **readiness probe** et vérifie MySQL, ainsi que Redis lorsqu'il est configuré.

Cette séparation évite qu'une saturation de MySQL transforme une simple sonde de processus en générateur de charge supplémentaire.

### 2.3 Personnalisation entreprise

La migration automatique de `server/config/db.js` garantit désormais l'existence de :

`users.facture_personnalisation TEXT`

Cela protège les installations existantes qui ont été créées avant l'introduction de la personnalisation, et corrige la cause structurelle possible du `500` sur `/api/auth/entreprise`.

Les validations existantes du logo, de la signature, des couleurs, des polices, des tailles et des modèles premium sont conservées.

### 2.4 Tests

Le script `npm test` reste strictement ciblé sur les fichiers :

`node --test "tests/*.test.js"`

Des tests de régression supplémentaires couvrent désormais :

- l'absence de requête SQL dans `/api/health` ;
- la présence de la migration `facture_personnalisation` ;
- la robustesse du dashboard.

## 3. Benchmark de charge — problème identifié

Le dernier benchmark utilisateur affichait :

- santé publique : `503` à 250/500/1000 connexions ;
- dashboard : quasiment uniquement `429` à partir de 10 connexions.

Le `429` était dû au fait que le benchmark réutilisait **un seul compte/token**. Le rate-limit général est de 300 requêtes/minute par utilisateur authentifié. Ce test mesurait donc principalement la protection anti-abus, pas la capacité de 10, 50, 100, 250, 500 ou 1000 utilisateurs.

La nouvelle procédure prépare des comptes de charge distincts directement dans la base de test afin de ne pas épuiser le rate-limit public de `/auth/register`, puis génère un JWT différent pour chaque compte.

Le runner limite également le rythme par utilisateur afin que le benchmark de capacité ne soit pas confondu avec un test de dépassement volontaire du quota.

## 4. Résultats de tests disponibles dans l'environnement d'audit

Les tests ne nécessitant pas une installation complète des dépendances ont été exécutés après corrections :

**64 tests PASS / 64 tests exécutés / 0 échec.**

Couverture vérifiée :

- dashboard : 7/7 ;
- contrat Paramètres : 4/4 ;
- personnalisation des modèles : 7/7 ;
- modèles de facture : 32/32 ;
- signatures Wave / PayDunya : 8/8 ;
- runtime config : 2/2 ;
- XSS client email : 4/4.

Un lancement complet de `npm test` n'a pas pu être certifié dans l'environnement d'audit isolé car l'installation npm locale a été interrompue et `node_modules` était incomplet (`supertest`, `express`, `dotenv` manquants). Cette limitation concerne l'environnement d'exécution de l'audit, pas les fichiers du projet livrés.

## 5. Analyse du code mort / régressions

Une recherche statique des marqueurs `TODO`, `FIXME`, `XXX` et `HACK` dans `server`, `public`, `load` et `scripts` n'a révélé aucun marqueur applicatif pertinent ; l'unique occurrence trouvée appartient à une chaîne d'intégrité dans `package-lock.json`.

Les tests de source existants couvrent déjà plusieurs zones sensibles : authentification, dashboard, personnalisation, templates, sécurité XSS, signatures de paiement, runtime et contrats frontend.

Aucune suppression agressive de fichier métier n'a été faite : les composants existants ont été conservés pour éviter une régression fonctionnelle.

## 6. Architecture de benchmark livrée

Nouveaux outils :

- `load/prepare-test-users.js` : prépare les comptes de charge de manière contrôlée ;
- `load/dashboard-load.js` : moteur HTTP Node natif, sans dépendance à `autocannon`, avec statistiques moyenne/p95/p99 et codes HTTP ;
- `test-scalabilite.sh` : exécute les paliers 10/50/100/250/500/1000 ;
- `GET /api/health` est testé comme liveness ;
- `/api/dashboard` est testé avec des JWT distincts.

Les résultats JSON sont conservés dans `resultats-charge/` lorsqu'un benchmark est lancé.

## 7. Critères de validation recommandés

Avant production, exécuter sur la machine cible :

```bash
cd server
npm install
npm test
```

Puis depuis la racine :

```bash
bash test-scalabilite.sh
```

Le résultat attendu pour le benchmark de référence est :

- aucune réponse `500` ;
- aucune réponse `503` sur `/api/health` ;
- aucune réponse `429` due au partage artificiel d'un seul utilisateur ;
- erreurs réseau et timeouts à zéro ;
- suivi du p95/p99 à chaque palier.

Un éventuel `429` après cette correction devra être interprété comme un problème réel de quota ou de comportement du scénario, et non comme une conséquence mécanique du partage d'un JWT.

## 8. Point de vigilance production

Le benchmark local ne permet pas, à lui seul, de garantir « 1000 utilisateurs humains » en production. La capacité réelle dépend notamment de MySQL, du CPU/RAM, du pool de connexions, du stockage, du reverse proxy, de Redis, du réseau et du trafic réel.

La version livrée sépare désormais correctement les problèmes de sécurité, de disponibilité et de capacité afin que les prochains benchmarks produisent un diagnostic exploitable.

## 9. Verdict

**Code livré : prêt pour nouvelle campagne de tests locale/staging.**

**Production commerciale : ne pas déclarer la capacité 1000 utilisateurs comme garantie tant que `npm test` complet et le benchmark multi-utilisateurs n'ont pas été exécutés avec succès sur l'environnement cible.**

### Fichiers principaux modifiés

- `server/routes/dashboard.js`
- `server/app.js`
- `server/config/db.js`
- `server/tests/dashboard-regression.test.js`
- `server/tests/health-rate-limit.test.js`
- `load/prepare-test-users.js`
- `load/dashboard-load.js`
- `test-scalabilite.sh`

