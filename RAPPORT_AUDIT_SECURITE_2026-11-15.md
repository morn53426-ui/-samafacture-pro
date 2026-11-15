# Audit de sécurité — 15 novembre 2026

Branche : `audit/securite-2026-11-15` (base : `main`, commit `f5c5b45`).

## Corrigé dans cette branche

| # | Problème | Correctif |
|---|----------|-----------|
| 1 | Connexion Google : liaison automatique d'un compte existant par email, sans contrôle de `email_verified` (prise de contrôle / pre-hijacking) | `email_verified` exigé ; lors d'une liaison, le mot de passe existant est neutralisé et les sessions sont révoquées (l'utilisateur repasse par « Mot de passe oublié ») |
| 2 | Aucune révocation de session (JWT 7 j, stockés en `localStorage`) | Colonne `users.token_version` ; version embarquée dans le JWT (`tv`), vérifiée par `requireAuth`, Socket.IO et le jeton PDF ; incrémentée à la réinitialisation du mot de passe et à la liaison Google. Cache de 15 s. Les jetons existants (sans `tv`) restent valides tant que la version est 0 |
| 3 | Chromium (`--no-sandbox`) avec un JWT valide 2 min, sans filtrage réseau | Interception des requêtes : application, `data:`, `blob:` et polices Google uniquement (`urlPdfAutorisee`) |
| 4 | `DATA_ENCRYPTION_KEY` facultative (repli sur `JWT_SECRET`) | Obligatoire (64 hex) en production, validée au démarrage |
| 5 | `user.nom` non échappé dans l'email de réinitialisation | Échappement HTML |
| 6 | Build Docker très long (`chown -R /app`) | `COPY --chown`, utilisateur créé avant les `COPY` |
| 7 | `.env.example` trompeur, `BACKUP_ENCRYPTION_KEY` absente ; risque de déployer `docker-compose.yml` seul | Commentaires et variable ajoutés ; avertissement dans le compose |

## Non traité (chantiers plus larges)

- CSP avec `unsafe-inline` : nécessite de retirer les `onclick=`/scripts inline du frontend.
- Jeton de session dans `localStorage` : bascule vers le cookie HttpOnly déjà préparée côté serveur.
- Durée du JWT (7 j) : à réduire avec un refresh token.
- Politique de mot de passe (8 caractères minimum) et coût bcrypt (10).
- Vérification exhaustive de l'échappement des champs affichés dans `facture-detail.html`.

## Notes de déploiement

- La colonne `token_version` est ajoutée automatiquement au démarrage (`config/db.js`) ; script manuel : `migration_2026_11_15_token_version.sql`.
- En production, définir `DATA_ENCRYPTION_KEY`. Attention : si des secrets de webhooks ou identifiants de paiement ont déjà été chiffrés avec `JWT_SECRET`, les ré-enregistrer après le changement de clé.
- Multi-instances : la révocation peut prendre jusqu'à 15 s à se propager entre processus (cache).
