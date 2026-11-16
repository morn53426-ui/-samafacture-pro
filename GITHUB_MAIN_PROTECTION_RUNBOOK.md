# Protection de la branche main — action administrateur requise

**État constaté lors de l'audit du 16 novembre 2026 :** les vérifications GitHub disponibles à l'audit précédent indiquaient `protected=false` pour `main` et aucun ruleset retourné. L'intégration GitHub utilisée pour cet audit ne fournit pas d'action permettant de créer/modifier les protections de branche. Ce document ne signifie donc pas que la protection a été activée.

## Réglages à appliquer par un administrateur du dépôt

Dans GitHub, ouvrir **Settings → Rules → Rulesets** (ou les paramètres de protection de branche) et créer une règle ciblant la branche `main` :

- [ ] Exiger une Pull Request avant fusion.
- [ ] Exiger au moins une approbation indépendante, selon la taille de l'équipe.
- [ ] Exiger la résolution des conversations de revue.
- [ ] Exiger les contrôles de statut avant fusion, notamment le job CI `Tests Node.js et MySQL` du workflow `.github/workflows/test.yml`.
- [ ] Exiger que la branche soit à jour avec `main` avant fusion.
- [ ] Interdire les force-push et la suppression de `main`.
- [ ] Restreindre les bypass aux identités explicitement autorisées et documenter chaque exception.
- [ ] Vérifier après enregistrement que l'API GitHub indique `protected=true` et que le ruleset cible bien `main`.

Les noms de contrôles requis doivent être sélectionnés dans l'interface GitHub après qu'une exécution du workflow a publié le contrôle correspondant. Ne pas inventer un nom de check ni exiger un check qui n'existe pas.

## Critère de sortie

La protection n'est considérée comme effective qu'après confirmation par l'administrateur et nouvelle lecture de l'état GitHub. Tant que `main` n'est pas protégée, aucune automatisation de cet audit ne doit fusionner une PR dans la branche principale, même lorsque la CI est verte.
