# Plans de correction UI — Sama Facture Pro

Plans sélectionnés après l'audit responsive et animations du 17 novembre 2026.

| N° | Plan | Sévérité | Statut |
| --- | --- | --- | --- |
| 001 | Supprimer les transitions de layout de la barre latérale | MEDIUM | TODO |
| 002 | Conditionner les états de survol Entreprise au pointeur fin | MEDIUM | TODO |
| 003 | Appliquer 16 px au champ de rappel CRM sur écran tactile | MEDIUM | TODO |

## Ordre d'exécution recommandé

1. **001** — retirer les deux transitions de layout dans `public/css/style.css`.
2. **002** — conditionner les dix blocs de survol dans `public/css/enterprise-workspace.css`.
3. **003** — ajouter le sélecteur `input[type=datetime-local]` à la media query tactile dans `public/css/style.css`.

Les plans 001 et 003 touchent le même fichier ; les exécuter successivement pour éviter les conflits de modifications. Le plan 002 est indépendant, mais l'exécution séquentielle simplifie la revue finale.

## Dépendances

- Cette série est basée sur le commit `a00f172`, branche `chore/emil-design-skills-20261117`.
- La PR de skills #82 doit être intégrée avant de fusionner la PR d'exécution des corrections.
- Les essais tactiles sur iPhone et Android physiques sont requis avant de déclarer les points mobiles validés.
- Aucun fichier source n'est modifié par ces plans. Ils doivent être exécutés par l'agent d'implémentation dans un worktree isolé, conformément au skill `improve-animations`.
