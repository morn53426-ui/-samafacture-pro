# Centre administrateur SUNUPILOT

La page `/admin.html` est une première version de pilotage en lecture seule : fréquentation, sessions estimées par onglet, comptes, essais, comptes ayant une formule payante enregistrée, abonnements SaaS actifs et paiements d'abonnement confirmés.

## Autorisation

L'accès est contrôlé côté serveur par `SUNUPILOT_ADMIN_USER_IDS`, une liste d'ID de comptes séparés par des virgules. Le champ `users.role` est un rôle métier d'entreprise : il ne confère aucun accès à l'administration de la plateforme.

Retrouver l'ID du compte dans la base :

```sql
SELECT id, email FROM users WHERE email = 'adresse-du-compte-admin';
```

Puis définir dans l'environnement du serveur (jamais dans le dépôt) :

```dotenv
SUNUPILOT_ADMIN_USER_IDS=123
SUNUPILOT_ANALYTICS_HASH_SECRET=secret-aleatoire-long-et-stable
```

Redémarrer le serveur après configuration. Une liste vide bloque tous les comptes ; les valeurs non numériques sont ignorées.

## Protections de la zone d'administration

- Limitation de débit dédiée (60 requêtes par minute et par adresse) appliquée avant l'authentification.
- Réponses `Cache-Control: no-store` et `X-Robots-Tag: noindex` : aucune donnée agrégée n'est mise en cache par un navigateur ou un proxy.
- Les agrégats sont lus sur une seule connexion, en transaction lecture seule : chiffres cohérents entre eux et un seul slot du pool de connexions consommé.
- Journal d'audit structuré (une ligne JSON `audit: platform_admin` sur la sortie standard) pour chaque consultation de `/api/admin/overview` et pour chaque refus sur cette route. Il contient l'ID du compte et la période, aucune donnée métier. Les refus sur `/api/admin/access` ne sont pas journalisés, cette route étant interrogée par le tableau de bord de chaque utilisateur.
- La page `admin.html` n'envoie aucun `Referer` (`no-referrer`).

## Définitions

- Pages consultées : chargements de pages ; un rechargement est une nouvelle vue.
- Sessions estimées : empreintes HMAC distinctes issues d'un identifiant aléatoire en sessionStorage, par onglet. Ce n'est pas un décompte de personnes physiques.
- Comptes ayant payé un abonnement : utilisateurs distincts ayant au moins un enregistrement `abonnement_paiements` confirmé (`payee`) dans l'historique ; ce total historique n'est pas une preuve d'abonnement encore actif.
- Comptes avec formule payante : utilisateurs dont le plan vaut Starter, Pro ou Entreprise ; un essai avec formule choisie n'est pas une preuve de paiement.
- Abonnements actifs : entrées `saas_subscriptions` avec une période courante valide.
- Revenus d'abonnement : lignes `abonnement_paiements` au statut `payee`, regroupées par devise. Les paiements des factures émises par les utilisateurs sont exclus.
- MRR/ARR ne sont pas calculés tant que les prix approuvés et les cycles de renouvellement actifs ne fournissent pas une base fiable.

Les périodes sont interprétées en UTC. Les devises sont toujours affichées séparément.

## Données analytiques

La migration 013 crée `sunupilot_analytics_pageviews`. Seuls des chemins appartenant à une liste blanche sont acceptés ; les paramètres URL et chemins contenant des codes/identifiants ne sont pas conservés. L'identifiant de session n'est pas écrit en clair : le serveur enregistre une empreinte HMAC, sans IP ni user-agent dans cette table. La page admin ne s'enregistre pas elle-même.

L'empreinte est calculée avec une clé dérivée du secret par une étiquette de domaine dédiée : la clé de signature des JWT n'est jamais utilisée directement. En production, sans `SUNUPILOT_ANALYTICS_HASH_SECRET` ni `JWT_SECRET`, la collecte répond 503 au lieu d'utiliser un secret par défaut. Le script côté navigateur ne s'exécute pas lorsque Do Not Track ou Global Privacy Control est activé.

### Conservation

Aucune donnée analytique n'est supprimée automatiquement par défaut. La purge planifiée (au démarrage puis toutes les `RECURRING_CHECK_INTERVAL_MIN` minutes, 60 par défaut, sous verrou MySQL) reste inactive tant que `SUNUPILOT_ANALYTICS_PURGE_ENABLED` n'est pas réglé explicitement sur `true`. Après décision documentée sur la durée de conservation, la purge supprime par lots les seules vues analytiques plus anciennes que `SUNUPILOT_ANALYTICS_RETENTION_DAYS` (395 jours par défaut, borné entre 30 et 825). L'activation de cette suppression doit faire l'objet d'une autorisation spécifique et d'une validation juridique.

### Limites connues

- Les identifiants de session sont générés côté navigateur : un client malveillant peut gonfler les « sessions estimées » dans la limite du quota par adresse. Ces chiffres ne sont pas une preuve d'audience.
- Derrière un reverse proxy, définir `TRUST_PROXY` : sans cela toutes les requêtes partagent la même adresse et les quotas sont atteints trop vite.
- Chart.js est chargé depuis des CDN sans contrôle d'intégrité (SRI) et la CSP autorise encore `'unsafe-inline'`, comme le reste de l'application (voir `SECURITY_REPORT.md`).
- Le journal d'audit n'est pas persisté en base ; une table dédiée supposerait une migration de schéma supplémentaire.

La politique de confidentialité est complétée, mais la collecte et sa durée de conservation doivent être validées avant le déploiement au regard des obligations applicables, notamment au Sénégal. Définir une durée de conservation et un processus de réponse aux demandes d'exercice de droits.

## Migration et paiements

La migration est additive et appliquée automatiquement au démarrage lorsque la version du schéma passe à 24. Elle ne modifie ni ne supprime les données métier.

Aucun paiement réel, mandat, catalogue de prix public ou renouvellement SaaS n'est activé par cet espace. Les routes de paiement existantes restent inchangées.
