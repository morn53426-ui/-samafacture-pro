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

Redémarrer le serveur après configuration. Une liste vide bloque tous les comptes.

## Définitions

- Pages consultées : chargements de pages ; un rechargement est une nouvelle vue.
- Sessions estimées : empreintes HMAC distinctes issues d'un identifiant aléatoire en sessionStorage, par onglet. Ce n'est pas un décompte de personnes physiques.
- Comptes avec formule payante : utilisateurs dont le plan vaut Starter, Pro ou Entreprise ; un essai avec formule choisie n'est pas une preuve de paiement.
- Abonnements actifs : entrées `saas_subscriptions` avec une période courante valide.
- Revenus d'abonnement : lignes `abonnement_paiements` au statut `payee`, regroupées par devise. Les paiements des factures émises par les utilisateurs sont exclus.
- MRR/ARR ne sont pas calculés tant que les prix approuvés et les cycles de renouvellement actifs ne fournissent pas une base fiable.

Les périodes sont interprétées en UTC. Les devises sont toujours affichées séparément.

## Données analytiques

La migration 013 crée `sunupilot_analytics_pageviews`. Seuls des chemins appartenant à une liste blanche sont acceptés ; les paramètres URL et chemins contenant des codes/identifiants ne sont pas conservés. L'identifiant de session n'est pas écrit en clair : le serveur enregistre une empreinte HMAC, sans IP ni user-agent dans cette table. La page admin ne s'enregistre pas elle-même.

La politique de confidentialité est complétée, mais la collecte et sa durée de conservation doivent être validées avant le déploiement au regard des obligations applicables, notamment au Sénégal. Définir une durée de conservation et un processus de réponse aux demandes d'exercice de droits.

## Migration et paiements

La migration est additive et appliquée automatiquement au démarrage lorsque la version du schéma passe à 24. Elle ne modifie ni ne supprime les données métier.

Aucun paiement réel, mandat, catalogue de prix public ou renouvellement SaaS n'est activé par cet espace. Les routes de paiement existantes restent inchangées.
