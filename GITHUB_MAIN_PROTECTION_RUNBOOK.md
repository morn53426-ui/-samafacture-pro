# Protection de la branche main — action administrateur requise

**État vérifié le 16 novembre 2026 : la branche `main` n'est pas protégée.** La lecture GitHub de `GET /repos/morn53426-ui/-samafacture-pro/branches/main` retourne `protected: false`, `protection.enabled: false` et `required_status_checks.enforcement_level: off` avec une liste de contrôles vide. La lecture `GET /repos/morn53426-ui/-samafacture-pro/rulesets?includes_parents=true` retourne une liste vide. La lecture directe du détail `.../branches/main/protection` renvoie HTTP 403 à l'intégration utilisée, et aucune action disponible ne permet de créer ou modifier ces règles. L'indicateur de branche confirme que les protections ne sont actuellement pas actives ; seul un administrateur du dépôt peut les configurer.

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
