# Rapport d'exécution audit SamaFacture Pro — run 1 (22 novembre 2026)

## Portée et sécurité
- Dépôt public: `morn53426-ui/-samafacture-pro`.
- Branche de base: `main`.
- SHA main observé: `b43a94fc2937b0108077501a0260358c8569e11f`.
- Commit vérifié: `docs(backup): sécuriser le transfert hors serveur rclone`; parent `e6a2caf04f0648d30419042c97cb63b6a14a05f8`.
- Le commit exact de main affiche `pending`, 0 statut; aucune CI post-commit confirmée.
- Aucune fusion, aucun push sur main, aucun force push, aucune opération destructive, aucun paiement/déploiement.
- Protections/rulesets: lecture non confirmée via l'accès disponible; ne pas considérer main protégée.
- Tests non exécutables dans cet environnement; aucune validation locale prétendue.

## Inventaire initial
- Branches: 152 observées (pages 1–6: 30+30+30+30+30+22; page 7 vide). Branches préservées.
- PRs: pages 1–2 retournent 60 entrées; page 3 vide. L'extraction détaillée/tri de tous les états merged/closed reste à faire.
- Workflows: `.github/workflows/test.yml`, `lint.yml`, `package-source-zip.yml`.
- Migrations: `server/database/migrations/003` à `012` (10 fichiers), et `server/database/schema.sql`. Aucune migration exécutée ou modifiée.
- CI tests configure Node 26, MySQL 8 et Redis 7, Docker Compose/nginx, tests et recette visuelle. Lint est ciblé par paths; vérifier l'ajout des fichiers/tests nouveaux.
- Règles/protections GitHub non confirmées via endpoint disponible.

## PRs en attente — tri initial
| PR | Sujet | Priorité | État observé | Décision |
|---|---|---|---|---|
| #159 | Retirer verification_code de la liste paginée des factures | P0 sécurité | open; status pending/0; CI actuelle non confirmée sur SHA head | Revue diff + CI exacte + revue humaine |
| #164 | Tests de non-divulgation reset-token hashes | P0 sécurité/test | open; status pending/0; description rapporte résultats d'un autre SHA (76438df), head observé a10bc748… | Exiger CI exacte head et revue indépendante; ne pas fusionner |
| #157 | Menu mobile Échap + focus | P2 accessibilité | open; pending/0 | CI exacte + revue |
| #156 | Skip-link dashboard | P2 accessibilité | open; pending/0 | CI exacte + revue |
| #149/#147/#146/#145/#144/#143/#142 | OHADA, essai gratuit, schema v21/v22, rétention événements comptables | P0/P1 données/compta | ouverts; bases d'intégration différentes | Stop: audit migrations/ordre/rollback et validation humaine avant fusion |
| #136/#135/#137/#138 | protections dépenses/factures/clients/stock | P0/P1 intégrité | open | Revue invariants/tests; validation humaine si historique comptable touché |

## Constats et risques
1. Plusieurs PRs comptables/intégrations schema v21/v22 en parallèle, certaines basées sur branches d'intégration: risque de dépendance, divergence et migration conflictuelle.
2. Aucun check status enregistré sur les SHAs vérifiés (status API pending, total_count 0). Les résultats CI dans descriptions PR ne prouvent pas la réussite du head SHA actuel.
3. Main: status b43a94fc… pending/0; post-fusion non vérifiable car aucune fusion effectuée.
4. Protections non confirmées; le champ `protected=false` des branches n'est pas preuve que rulesets/protections sont absents ou présents.
5. Inventaire branches paginé complet: 152. PRs: 60 entrées; extraction exhaustive et graphe de dépendances restent à faire.
6. Migrations 003–012; l'absence 001/002 doit être expliquée via historique/schema, pas corrigée sans preuve.

## Plan priorisé
- P0 immédiat: PR #159 (secret verification facture) et #164 (test reset-token redaction); audit auth/factures, CI exacte et revue avant fusion.
- P0 bloqué validation humaine: schema v21/v22, mapping OHADA, rétention/contrepassation comptable. Examiner SQL, ordre, idempotence, backup/restore, rollback et données; obtenir validation humaine explicite.
- P1: protections suppression/modification factures, dépenses, clients, produits avec historique/stock; vérifier ledger et non-régression.
- P1: sauvegarde/restauration, privilèges minimaux, secrets Docker/CI, rétention, tests restauration et volumes.
- P2: accessibilité clavier/focus/contraste, workspace mobile, responsive, navigation.
- P3: branding, vidéo landing, polish UI, documentation/roadmap; après stabilité.

## Suivi prochain run
- Confirmer protections/rulesets via accès GitHub autorisé.
- Extraire toutes PRs/commits, états, bases/head SHA, diffs et graphe dépendances.
- Vérifier Actions/check-runs par SHA exact et main.
- Revue indépendante PRs P0 #159/#164 et exécuter tests sur commit exact dans environnement contrôlé.
- Lots indépendants sûrs seulement; stopper les merges si main instable.
