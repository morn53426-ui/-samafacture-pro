# Protection de la branche main — état vérifié

**État vérifié le 16 novembre 2026 à 21:33 UTC : la branche `main` est protégée.** Le ruleset GitHub `protect main` (ID `27410527`) est actif et cible explicitement `refs/heads/main`. La lecture de la branche retourne également `protected: true`.

## Règles actuellement actives

Le ruleset impose les contrôles suivants avant une fusion :

- **Pull Request obligatoire** avant toute fusion dans `main`.
- **Au moins une approbation** requise (`required_approving_review_count: 1`). Cette approbation doit venir d'une personne indépendante de l'auteur de la PR.
- **Conversations de revue résolues** obligatoires.
- **Contrôles CI obligatoires** : `Tests Node.js et MySQL` et `Build complete source archive`.
- **Branche à jour avec la cible** obligatoire avant fusion (politique stricte des contrôles de statut).
- **Suppression de la branche interdite** et **force-push / mises à jour non fast-forward interdits**.
- Aucun acteur de contournement n'est configuré ; le ruleset indique `current_user_can_bypass: never`.

Les méthodes de fusion autorisées sont merge, squash et rebase.

## Vérification effectuée

Les informations ont été relues via les endpoints GitHub de la branche et du ruleset :

- `GET /repos/morn53426-ui/-samafacture-pro/branches/main` : `protected: true`.
- `GET /repos/morn53426-ui/-samafacture-pro/rulesets/27410527` : `enforcement: active`, cible `refs/heads/main`, approbation requise, conversations résolues et deux contrôles de statut requis.
- Le ruleset ne définit aucun acteur de bypass.

Cette vérification confirme la configuration GitHub au moment indiqué. Elle ne constitue pas une approbation de PR et ne remplace pas la vérification des contrôles CI sur le commit exact proposé à la fusion.

## Procédure obligatoire pour chaque Pull Request

Avant toute fusion dans `main`, vérifier sur la tête actuelle de la PR :

1. La PR est ouverte et sa branche est à jour avec `main`.
2. Les deux contrôles obligatoires sont terminés avec le résultat **success**.
3. Une approbation indépendante est enregistrée après examen du contenu à fusionner.
4. Toutes les conversations de revue sont résolues.
5. Aucun nouveau commit ou changement ne rend l'examen ou les contrôles obsolètes.

Ne jamais contourner le ruleset, supprimer des tests, ignorer un contrôle en échec ou fusionner manuellement en dehors des règles. En cas de statut bloqué, de conflit ou de doute sur les données métier, suspendre la fusion et demander une revue humaine.

**Responsabilité :** seul un administrateur GitHub peut modifier ce ruleset. Toute évolution de sa configuration doit être vérifiée à nouveau via l'API GitHub et documentée ici.
