# Politique d'automatisation IA gardée — SUNUPILOT

## Principe
L'IA peut analyser, proposer et préparer des changements. Elle ne décide jamais seule qu'un changement est sûr à fusionner. La décision d'autoriser l'auto-merge appartient à un mainteneur de confiance et reste soumise aux protections GitHub.

## Cycle d'une contribution IA
1. L'agent lit `AGENTS.md`, les skills applicables et l'état Git avant toute modification.
2. Il travaille exclusivement sur une branche dédiée, jamais directement sur `main`.
3. Il produit un diff ciblé, explique les fichiers modifiés, les hypothèses et les risques.
4. Il exécute les tests pertinents et indique les commandes réellement lancées et leurs résultats.
5. Un agent de revue indépendant, en lecture seule, recherche les régressions et les risques.
6. Une PR est ouverte en Draft avec un résumé, les tests, les captures/artefacts utiles et les points restant à vérifier.
7. Un mainteneur examine le diff et les contrôles avant de rendre la PR prête ou d'ajouter le label spécial.

## Label d'autorisation
- Label requis : `ai-automerge-safe`.
- Le label est ajouté manuellement par une personne de confiance après examen du diff.
- L'agent de codage ne doit pas pouvoir s'attribuer ce label.
- Une PR sans ce label ne doit pas activer l'auto-merge.
- Le workflow relit le label, l'état Draft, la branche cible et la liste complète des fichiers à chaque ajout/retrait du label, nouveau commit, réouverture ou passage en revue.
- Si le label disparaît, si la PR repasse en Draft ou si un fichier hors périmètre apparaît, le workflow tente de désactiver tout auto-merge déjà programmé et échoue fermé.

## Changements éventuellement éligibles
Liste volontairement limitée :
- `docs/**`
- `*.md` à la racine uniquement
- `server/tests/**`
- `public/css/**`

Les changements CSS ne sont éligibles que s'ils ne modifient pas le comportement métier, les données, les droits ou les calculs. Tout fichier non listé est refusé par défaut.

## Exclusions : revue et autorisation humaines obligatoires
Aucun auto-merge IA pour :
- facturation, montants, taxes, soldes, remises, avoirs et paiements ;
- comptabilité, journaux et conformité OHADA ;
- abonnements, essais gratuits, quotas, prix et activation de paiement ;
- authentification, sessions, permissions, multi-tenant et sécurité ;
- base de données, migrations, sauvegardes et restauration ;
- génération PDF, impression des factures et documents réglementaires ;
- Docker, CI, GitHub Actions, secrets, déploiement et infrastructure ;
- configuration OpenCode, agents et permissions.

## Contrôles techniques indispensables
- Les tests CI applicables doivent être requis dans les règles de protection de `main`.
- GitHub Auto-merge doit être activé au niveau du dépôt avant usage.
- Le Squash est la seule méthode demandée par ce workflow.
- Le label doit être réservé à un rôle de confiance.
- Les agents doivent fonctionner avec le minimum de permissions et ne jamais recevoir de secrets dans leurs prompts ou leurs logs.
- Aucun paiement réel ne doit être activé par une automatisation.

## Limites
Le workflow ne remplace pas les protections de branche GitHub et ne garantit pas l'absence de bogue. La permission du label, la protection de `main` et les checks requis doivent être contrôlés dans les paramètres du dépôt. Le workflow utilise `pull_request`, jamais `pull_request_target`, et ne checkout ni n'exécute le code de la PR.

L'auto-merge natif de GitHub est seulement demandé après validation du périmètre ; GitHub doit encore attendre tous les contrôles et toutes les approbations exigés.
