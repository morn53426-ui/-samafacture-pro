# AMELIORATIONS_SCALABILITE.md — Scalabilité et réactivité (responsive)

**Date :** 21 août 2026. **Méthode :** lecture du code + scripts d'analyse, comme les audits
précédents. Beaucoup de ce qui suit part d'une vérification qui a d'abord *infirmé* mon hypothèse
initiale — le projet est déjà nettement plus mature sur ces deux sujets que ce à quoi je
m'attendais. Le détail ci-dessous distingue ce qui était déjà bien fait de ce qui a réellement été
changé.

---

## 1. Scalabilité — ce qui était déjà bien fait (vérifié, pas juste supposé)

- **Cluster multi-cœurs déjà en place et déjà branché en production** : `server/cluster.js`
  fork un worker par cœur CPU, avec `@socket.io/sticky` + `@socket.io/cluster-adapter` pour que
  les notifications temps réel (Socket.IO) fonctionnent correctement entre plusieurs workers —
  y compris la gestion de la race condition sur `JWT_SECRET` au tout premier démarrage. Et surtout
  : `Dockerfile` (ligne 72, `CMD ["node", "cluster.js"]`) l'utilise déjà par défaut, pas juste
  disponible en option oubliée.
- **Pool de connexions MySQL déjà configuré pour la charge** : taille réglable
  (`DB_POOL_SIZE`), `queueLimit` pour échouer vite plutôt que de bloquer indéfiniment sous forte
  charge, gestion d'erreur non fatale sur coupure passagère.
- **Index déjà présents sur toutes les clés étrangères**, plus des index composites ciblés pour
  les requêtes fréquentes (`idx_factures_user_type_statut`, `idx_factures_user_type_date`...).
- **Cache HTTP déjà configuré** sur les fichiers statiques (`maxAge: 1 jour` en production, etag
  activé).

## 2. Scalabilité — ce qui a été trouvé et corrigé

### 2.1 ✅ Insertion des lignes de facture : une requête par ligne → une seule requête groupée
`server/routes/factures.js` (création, Phase POST), `server/routes/factures-recurrentes.js`
(génération automatique) et `server/routes/factures.js` (duplication) faisaient chacun une
boucle `for` avec un `INSERT` séparé par ligne de facture. Sur une facture de 20 lignes, c'était
20 allers-retours MySQL au lieu d'1 — à volume élevé (beaucoup de créations en parallèle), ça
multiplie d'autant la latence perçue et le temps de connexion tenue sur le pool.
→ **Corrigé :** nouvelle fonction partagée `insererLignesFacture()` (un seul `INSERT ... VALUES
(...), (...), (...)` multi-lignes), exportée depuis `factures.js` et réutilisée dans les 3
endroits. Testée dans `server/tests/insertion-groupee-lignes.test.js` (mock de la connexion, pas
besoin de MySQL — mais nécessite `node_modules`, absent ici, comme signalé depuis le début ; la
logique a été relue pas à pas contre chaque cas de test).

*Non touché volontairement* : les boucles qui ajustent le stock produit après coup (`UPDATE
produits SET stock = stock ± ? WHERE id = ?`, une par produit distinct de la facture) restent en
boucle — les batcher correctement demanderait un `CASE WHEN` par produit, plus complexe et plus
risqué à écrire sans pouvoir le tester sur une vraie base, pour un nombre de lignes typiquement
faible (quelques produits par facture, pas des milliers). Le rapport qualité/risque n'était pas
favorable pour cette itération.

### 2.2 ✅ Index manquant sur `users.reset_token_hash`
`server/routes/auth.js` interroge cette colonne par correspondance exacte (`WHERE
reset_token_hash = ? AND reset_token_expires > NOW()`) à chaque clic sur un lien de
réinitialisation de mot de passe — sans index dessus, c'était un balayage complet de la table
`users` à chaque appel. Négligeable à quelques centaines de comptes, ça se voit dès que la base
grossit.
→ **Corrigé :** index ajouté dans `server/database/schema.sql` (nouvelles installations) et
`migration_index_reset_token.sql` (bases déjà en place, à exécuter une fois).

---

## 3. Réactivité (responsive) — ce qui était déjà bien fait

- Couverture déjà large de points de rupture (`@media`, 10 seuils différents de 400px à
  1100px), y compris `prefers-reduced-motion` et `prefers-color-scheme`.
- Tableaux déjà protégés contre le débordement horizontal sur petit écran
  (`.card { overflow-x: auto }` + `min-width` sur les tableaux).
- Toutes les 27 pages ont bien la balise `viewport`.
- Le panneau image du formulaire de connexion (`.auth-form-side`, 460px fixes) a bien un repli
  déjà prévu en dessous de 900px (`width: 100%`) — vérifié avant de le signaler à tort comme bug.
- Grand écran : la page d'accueil (`.lp-*`) est déjà bornée à `max-width: 1280px` centré — ne
  s'étire pas de façon disproportionnée sur un écran ultra-large.

## 4. Réactivité — ce qui a été corrigé

### 4.1 ✅ Zones tactiles trop petites sur mobile (< 44px)
Norme communément admise (WCAG 2.5.5, Apple HIG, Material Design) : 44px minimum pour un élément
tactile. Deux boutons en dessous :
- **Le bouton de bascule de thème** (`.theme-toggle-btn`, ajouté lors du chantier mode
  clair/sombre) : environ 34px de hauteur avec son padding d'origine. → **Corrigé** :
  `min-height: 44px` ajouté (garde le même padding/largeur, juste plus haut).
- **Le bouton hamburger mobile** (`.mobile-toggle`, préexistant) : 36×36px. → **Corrigé** :
  porté à 44×44px, changement isolé sans effet sur le reste de la mise en page (juste 8px de plus
  dans la barre du haut sur mobile).

## 5. Réactivité — noté, pas corrigé

### 5.1 🔵 Pas de largeur maximale sur `.main-content` (pages de l'application, grand écran)
Contrairement à la page d'accueil (déjà bornée à 1280px), les pages internes (tableau de bord,
factures...) n'ont pas de largeur maximale — sur un très grand écran (ultra-wide, 4K), le contenu
s'étire sur toute la largeur disponible. Pas corrigé ici : choisir la bonne valeur de
`max-width` est un jugement esthétique (pas juste un chiffre "correct" en soi), et je ne peux pas
voir le rendu réel dans cet environnement pour valider que ça reste bien équilibré plutôt que de
laisser des zones vides disgracieuses sur les côtés. À trancher visuellement de votre côté avant
d'appliquer un correctif — je peux le faire si vous me donnez une valeur cible ou si vous validez
un essai.

---

## 7. Trouvé grâce à un vrai test de charge (exécuté par l'utilisateur, pas par moi)

`test-scalabilite.sh` a été lancé pour de vrai en Git Bash — première vérification de
scalabilité de toute cette série d'audits qui ne soit pas qu'une lecture statique du code.
Résultat : à 10 connexions simultanées déjà, environ 95 % des requêtes vers `/api/health`
recevaient un code non-2xx (429 — trop de requêtes).

### 7.1 ✅ CORRIGÉ — `/api/health` était soumis au même quota que les routes métier
`server/app.js` : le `skip: (req) => req.path === '/api/health'` que j'avais repéré dans un audit
précédent appartenait en fait au **journal des requêtes** (morgan), pas au limiteur de débit
(`apiLimiter`) — confusion de ma part à corriger ici. `/api/health` n'avait donc aucune exemption
et partageait le même quota de 300 requêtes/minute par IP que toutes les routes métier. Risque
réel en production : Docker interroge cet endpoint pour son propre `healthcheck` (voir
`Dockerfile`) — sous forte charge légitime, ce même quota aurait pu se remplir avant que Docker
n'ait pu vérifier la santé du conteneur, qui aurait alors semblé "en panne" et aurait été
redémarré, alors que le serveur fonctionnait très bien.
→ **Corrigé :** `/api/health` explicitement exclu de `apiLimiter` (`skip`).

### 7.2 ✅ CORRIGÉ — quota de 300/min partagé par adresse IP plutôt que par utilisateur
Le test simule 100 connexions depuis une seule machine (une seule IP) — pas directement
représentatif de 100 vrais utilisateurs, qui ont généralement chacun leur propre IP. Mais un cas
réaliste reste concerné : plusieurs employés d'une même petite entreprise, derrière le même
routeur/la même IP publique (NAT partagé) — exactement le profil d'utilisation visé par
SamaFacture Pro. Avec un comptage par IP, toute l'équipe se partageait un seul quota de 300
requêtes/minute à eux tous.
→ **Corrigé, sur demande explicite** (option choisie parmi plusieurs proposées) : `apiLimiter`
compte maintenant par utilisateur authentifié (identifiant extrait du jeton, **vérifié** — pas
juste décodé, pour qu'un jeton forgé ne puisse pas épuiser le quota de quelqu'un d'autre) plutôt
que par IP. Repli sur l'IP inchangé pour tout visiteur sans jeton valide (connexion, inscription,
consultation publique d'une facture...).

**Pour retester après ce correctif** (`bash test-scalabilite.sh`) : `/api/health` ne devrait plus
jamais renvoyer de 429, à aucun palier. `/api/dashboard`, lui, continuera très probablement à
montrer des 429 à 50-100 connexions — et c'est maintenant **le comportement voulu** : le script
simule UN SEUL utilisateur (un seul jeton) envoyant des centaines de requêtes par seconde, très
au-delà d'un usage réel — le limiter doit le freiner. Ce qui compte, c'est que **plusieurs
utilisateurs différents** ne se gênent plus entre eux, pas qu'un seul utilisateur isolé puisse
tout consommer sans limite.

Testé dans `server/tests/rate-limit-par-utilisateur.test.js` (4/4 scénarios relus : deux
utilisateurs différents obtiennent des quotas séparés, un jeton forgé ne vole pas le quota d'un
autre, repli sur l'IP si pas de jeton/jeton expiré) — non exécutable ici (`jsonwebtoken` absent
de cet environnement), logique relue pas à pas.


## 8. Vérifications faites ici

```
node --check   (tous les .js, y compris les 27 scripts inline HTML)  → 0 erreur
node --test server/tests/templates.test.js server/tests/personnalisation.test.js server/tests/xss-client-email.test.js → 43/43
```
`server/tests/insertion-groupee-lignes.test.js` et `server/tests/rate-limit-par-utilisateur.test.js`
(nouveaux) : logique relue pas à pas, non exécutés (nécessitent `node_modules`, absent ici).

## Phase 12 — architecture multi-instance (10 000 utilisateurs simultanés)

La version actuelle ajoute une base de déploiement horizontal :

- Redis partagé pour Socket.IO inter-conteneurs et le rate-limit global lorsqu'il est configuré ;
- Nginx comme reverse proxy devant plusieurs réplicas `app` ;
- `WEB_CONCURRENCY` configurable et détection CPU via `os.availableParallelism()` ;
- verrous MySQL distribués pour empêcher plusieurs conteneurs de lancer simultanément les tâches planifiées ;
- dashboard sans `UPDATE` à chaque consultation, réduisant la contention MySQL ;
- script k6 progressif jusqu'à 10 000 VU ;
- healthcheck et arrêt propre conservés.

### Limite importante

L'architecture est préparée pour une montée en charge horizontale, mais **10 000 utilisateurs simultanés ne sont pas une capacité garantie sans test de charge sur l'infrastructure cible**. Le test doit être exécuté avec plusieurs instances Node, MySQL dimensionné, Redis et une machine de charge séparée.

Pour la génération PDF, la limite de concurrence reste volontairement bornée par processus. À grande échelle, les PDF doivent idéalement être déplacés vers des workers dédiés/une file de jobs afin qu'un pic de PDF ne bloque pas l'API transactionnelle.
