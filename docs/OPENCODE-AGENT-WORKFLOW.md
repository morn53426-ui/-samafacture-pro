# Équipe d'agents OpenCode — SUNUPILOT

## Installation et principes
La configuration du dépôt utilise le format OpenCode actuel :
- `opencode.jsonc` configure l'agent principal par défaut et les permissions ;
- `.opencode/agents/*.md` contient les profils spécialisés ;
- aucun modèle fournisseur n'est imposé : les sous-agents héritent du modèle de la session lorsqu'aucun modèle n'est fixé.

La configuration doit être testée avec la version OpenCode installée localement avant adoption générale.

## Profils
| Agent | Mode | Rôle | Accès |
|---|---|---|---|
| `plan` | Principal par défaut | Analyse et orchestration | Pas d'édition ; shell soumis à approbation |
| `sunupilot-architect` | Sous-agent | Architecture et plan technique | Lecture seule |
| `sunupilot-implementer` | Sous-agent | Correction ciblée | Édition contrôlée ; shell soumis à approbation ; opérations Git/Docker sensibles bloquées |
| `sunupilot-code-reviewer` | Sous-agent | Revue indépendante | Lecture seule |
| `sunupilot-ohada-reviewer` | Sous-agent | Cohérence comptable et OHADA | Lecture seule |
| `sunupilot-pdf-reviewer` | Sous-agent | PDF, factures et impression | Lecture seule |
| `sunupilot-test-engineer` | Sous-agent | Stratégie et exécution des tests | Pas d'édition ; chaque commande demande approbation |

## Workflow recommandé
1. Ouvrir le dépôt sur une branche de travail dédiée ; vérifier `git status` et ne jamais travailler sur `main`.
2. Utiliser `plan` pour analyser la demande et produire le plan, sans modification.
3. Faire examiner le périmètre par `sunupilot-architect` et, selon le risque, par `sunupilot-ohada-reviewer` ou `sunupilot-pdf-reviewer`.
4. Après validation humaine du plan, faire intervenir `sunupilot-implementer` sur un diff limité.
5. Faire examiner le diff complet par `sunupilot-code-reviewer`, puis établir la matrice de tests avec `sunupilot-test-engineer`.
6. Lancer les tests pertinents après approbation des commandes ; conserver les logs et artefacts.
7. Préparer une PR en Draft avec résumé, captures/PDF utiles, tests réellement exécutés, risques et limites.
8. Laisser un mainteneur rendre la PR prête et décider si elle peut recevoir le label `ai-automerge-safe`.

## Garde-fous
- Pas de modification directe de `main`, pas de merge ou fermeture de PR par l'agent.
- Aucune suppression de branche, volume, sauvegarde, base ou donnée.
- Pas de push automatique depuis les profils locaux ; toute publication doit passer par la revue et l'autorisation explicite.
- Pas de paiement réel, pas de secret dans les prompts, fichiers de log ou artefacts.
- Facturation, calculs, OHADA, paiements, abonnements, sécurité, migrations, Docker, CI, déploiement, PDF réglementaires et configuration des agents requièrent une revue humaine.
- Les permissions OpenCode ajoutent des garde-fous locaux ; elles ne remplacent pas les protections de branche GitHub ni les contrôles d'accès côté serveur.
- L'IA doit distinguer constat, hypothèse et point non vérifié. Elle n'annonce pas de succès sans preuve.

## Activation GitHub (étape distincte)
L'exécution d'OpenCode depuis un commentaire GitHub nécessite l'installation et la configuration de l'application OpenCode GitHub, ainsi qu'un secret de fournisseur de modèle. Cette installation n'est pas activée par ces fichiers.

Avant d'ajouter un workflow GitHub :
- installer l'application officielle sur le dépôt avec les permissions minimales ;
- privilégier l'échange OIDC de l'application plutôt qu'un Personal Access Token ;
- stocker uniquement la clé du fournisseur de modèle dans les secrets Actions ;
- définir explicitement les permissions de workflow, restreindre les événements déclencheurs et vérifier l'origine des commentaires ;
- conserver la PR comme sortie de l'agent, sans auto-merge des changements sensibles.

Aucun PAT communiqué dans une conversation ne doit être utilisé, enregistré ou réutilisé.
