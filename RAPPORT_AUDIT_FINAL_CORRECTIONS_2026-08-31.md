# Rapport d’audit final — SamaFacturePro

**Version de travail :** `SamaFacturePro_FINAL_AUDIT_CORRIGE_2026-08-31.zip`  
**Date :** 31 août 2026  
**Objectif :** corriger les régressions signalées, sécuriser le dashboard/paiements, supprimer le code mort identifié et produire une archive prête à tester.

## 1. Résultat global

Le projet a été repris à partir de l’archive fournie. Les corrections demandées ont été appliquées sans refonte inutile du code existant.

### Corrections appliquées

1. **Cascade SQL corrigée**
   - `server/database/schema.sql`
   - `fk_factures_client` utilise maintenant `ON DELETE CASCADE`.
   - `fk_factures_recurrentes_client` utilise maintenant `ON DELETE CASCADE`.

2. **Migration des bases existantes ajoutée**
   - `server/config/db.js`
   - Au démarrage, la migration vérifie `information_schema.REFERENTIAL_CONSTRAINTS`.
   - Si une ancienne contrainte existe sans `CASCADE`, elle est remplacée proprement par une contrainte `ON DELETE CASCADE`.
   - Cela évite de corriger uniquement les nouvelles installations tout en laissant les bases déjà déployées dans l’ancien état.

3. **Quota de test des factures corrigé**
   - `server/tests/factures.test.js`
   - Après création de l’utilisateur de test, son plan est positionné sur `pro`.
   - Le scénario peut ainsi créer plus de 10 factures sans être interrompu par `FREE_MONTHLY_INVOICE_LIMIT`.

4. **Erreur du runner de tests corrigée**
   - `server/tests/setup.js`
   - `after` est maintenant importé explicitement depuis `node:test`.
   - Cela supprime le `ReferenceError: after is not defined` qui faisait échouer/canceller pratiquement toute la suite.

5. **Idempotence des paiements auditée en profondeur**
   - `server/routes/factures.js`
   - La protection existante repose sur deux mécanismes complémentaires :
     - index unique `(user_id, idempotency_key)` en base ;
     - verrou `SELECT ... FOR UPDATE` sur la facture avant insertion et recalcul du solde.
   - En cas de course concurrente avec la même clé, la seconde insertion déclenche `ER_DUP_ENTRY`, puis le code recharge le paiement existant et renvoie une réponse idempotente `200`.
   - Cette architecture est adaptée au mode multi-processus/cluster : elle ne dépend pas d’un verrou mémoire local au processus.
   - **Aucune table de verrou mémoire n’a été ajoutée**, afin de ne pas créer une fausse garantie de scalabilité en cluster.

6. **Code mort identifié et supprimé**
   - `server/routes/factures-recurrentes.js` importait `appliquerAjustementsStock` sans l’utiliser.
   - L’import inutilisé a été supprimé.
   - L’export correspondant devenu inutile dans `server/routes/factures.js` a également été supprimé.

7. **Documents WIP obsolètes à la racine supprimés**
   - `WIP_ETAPES_1_A_41_2026-08-31.md`
   - `WIP_ETAPES_1_A_20_2026-08-31.md`
   - Les rapports finaux et documents techniques non préfixés WIP sont conservés.

## 2. Dashboard — audit de régression

Le endpoint `GET /api/dashboard` a été contrôlé sur les points introduits lors des corrections précédentes :

- absence de destructuration fragile des résultats SQL ;
- protection des listes contre `undefined` ;
- déduplication des requêtes concurrentes pour un même utilisateur ;
- cache court et borné ;
- traitement optimisé d’un compte sans facture ;
- maintien de l’isolation par `user_id` ;
- route montée dans `server/app.js` sous `/api/dashboard`.

Le test dédié `dashboard-regression.test.js` a été exécuté dans l’environnement disponible : **7 tests / 7 réussis**.

## 3. Routes — vérification de montage

Les 11 fichiers de routes présents sous `server/routes/` sont montés dans `server/app.js` :

- abonnement
- assistant
- auth
- clients
- dashboard
- depenses
- factures
- factures-recurrentes
- produits
- public
- rapports

**Aucune route orpheline n’a été identifiée lors du contrôle statique.**

## 4. Contrôles statiques

Tous les fichiers JavaScript du serveur, hors dépendances `node_modules`, passent `node --check`.

**Résultat : 0 erreur de syntaxe source.**

Contrôles unitaires/statistiques exécutables sans base MySQL :

| Test | Résultat |
|---|---:|
| `dashboard-regression.test.js` | 7/7 PASS |
| `payments-signature.test.js` | 8/8 PASS |
| `runtime-config.test.js` | 2/2 PASS |
| `templates.test.js` | 32/32 PASS |
| `xss-client-email.test.js` | 4/4 PASS |
| `parametres-save-contract.test.js` | 4/4 PASS |

## 5. Suite d’intégration complète — limite de l’environnement d’audit

La commande demandée est :

```bash
cd server
DB_HOST=127.0.0.1 npm test
```

Elle doit être exécutée avec **MySQL réellement installé et démarré**, car une grande partie des tests créent des utilisateurs, factures, clients, produits, paiements et vérifient les contraintes SQL.

Dans l’environnement d’audit utilisé pour construire l’archive, le service MySQL n’était pas disponible. L’installation automatique des dépendances npm n’a pas pu être menée à terme dans cet environnement non réseau. Par conséquent, il serait incorrect de déclarer la suite d’intégration complète « verte » sur la seule base des tests statiques.

Les erreurs `Cannot find module 'supertest'`, `dotenv`, etc. observées pendant cette tentative proviennent de cet environnement de dépendances incomplet, et non d’un diagnostic fonctionnel du projet.

**Important :** la correction `after is not defined` a néanmoins été appliquée dans le code source et le contrat `npm test` est déjà conforme à `node --test "tests/*.test.js"`.

## 6. Vérification des régressions ciblées à effectuer sur la machine de test

Après installation/démarrage de MySQL :

```bash
cd server
DB_HOST=127.0.0.1 npm install
DB_HOST=127.0.0.1 npm test
```

Pour une installation MySQL conforme à l’environnement demandé :

```bash
apt-get install mysql-server
service mysql start
mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY ''; FLUSH PRIVILEGES;"
```

Puis :

```bash
cd server
DB_HOST=127.0.0.1 npm test
```

Une attention particulière doit être portée aux tests :

- `isolation.test.js`
- `produits-delete.test.js`
- `rapports.test.js`
- `phase4-api-publiques.test.js`
- `stock.test.js`
- `paiements.test.js`
- `factures.test.js`

Ils valident notamment les effets de cascade et les transactions MySQL.

## 7. Charge / scalabilité

Les précédents résultats de charge fournis pendant l’audit montrent deux phénomènes distincts :

- `/api/health` finit par retourner des `503` sous très forte concurrence, notamment aux paliers 250/500/1000 ;
- `/api/dashboard` retourne massivement `429` lorsque le limiteur API est atteint.

Un `429` du dashboard dans ce benchmark ne constitue donc **pas à lui seul une preuve que le SQL du dashboard est défaillant** : il indique d’abord que la politique de rate limiting bloque le trafic du benchmark.

De même, les `503` du endpoint public doivent être analysés séparément comme une limite de capacité du serveur/environnement de charge. Ils ne doivent pas être confondus avec une régression fonctionnelle du dashboard.

## 8. Conclusion de l’audit

### État du code livré

- Correction des deux clés étrangères demandées : **OK**
- Migration des installations existantes : **OK**
- Correction du test soumis au quota Gratuit : **OK**
- Correction du `ReferenceError: after is not defined` : **OK**
- Audit de l’idempotence paiement : **architecture DB robuste conservée et validée statiquement**
- Dashboard : **régression statique dédiée au vert (7/7)**
- Routes orphelines : **aucune détectée**
- Import inutilisé identifié : **supprimé**
- WIP obsolètes à la racine : **supprimés**
- Syntaxe serveur : **OK**

### Statut de livraison

**Archive prête à être testée sur la machine disposant de MySQL et des dépendances npm.**

Elle ne doit pas être qualifiée de « production validée » avant le passage de la suite complète `DB_HOST=127.0.0.1 npm test` dans un environnement MySQL fonctionnel et, idéalement, un nouveau benchmark de charge avec une configuration de rate limiting explicitement adaptée au scénario de test.
