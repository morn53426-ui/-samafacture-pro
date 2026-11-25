# Politique de merge automatique OpenCode (SUNUPILOT)

## Principe
L'automatisation ne merge jamais sur la seule base d'une confiance déclarée par l'IA. Elle s'appuie sur des contrôles GitHub vérifiables et une étiquette de décision explicite.

## Label d'autorisation
- Label requis : `ai-automerge-safe`
- Ce label doit être ajouté manuellement par un mainteneur après revue du diff.
- L'agent ne doit pas pouvoir s'auto-attribuer ce label via ses permissions de workflow.
- Une PR sans ce label reste ouverte et non mergée.

## Conditions supplémentaires
- PR ouverte vers `main`.
- Tous les contrôles CI requis par les règles de protection de `main` doivent réussir.
- Merge natif GitHub Auto-merge activé; méthode Squash.
- La PR ne doit toucher que les chemins de faible risque autorisés par le workflow.
- Si un fichier non autorisé est modifié, le workflow refuse l'auto-merge et laisse la PR ouverte.
- Aucun merge direct, aucune suppression de branche, aucun force-push, aucune modification de volume, sauvegarde ou données.
- Aucun paiement réel ni changement de configuration de paiement.
- Les PR qui touchent facturation, comptabilité OHADA, paiements, abonnements, authentification, autorisations, sécurité, migrations, Docker, CI/workflows, secrets, infrastructure ou configuration restent soumises à une approbation humaine.

## Chemins autorisés (liste conservative)
- `docs/**`
- `*.md` à la racine
- `server/tests/**`
- `public/css/**`

Les autres chemins sont refusés par défaut. Cette liste peut être élargie uniquement par revue humaine dédiée.

## Contrôles
Le workflow `.github/workflows/guarded-automerge.yml` ne fait qu'activer l'Auto-merge GitHub (Squash) après validation des critères; il ne fusionne pas immédiatement. GitHub attend les checks et les règles de protection configurés sur `main`.

## Limites
Le workflow n'exécute pas de code provenant de la PR et n'utilise pas `pull_request_target`. L'étiquette constitue une décision humaine, pas une preuve technique de sûreté. Le dépôt doit avoir des règles de protection de `main` avec les checks pertinents exigés.
