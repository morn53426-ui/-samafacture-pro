-- Migration : index manquant sur users.reset_token_hash (voir AMELIORATIONS_SCALABILITE.md)
-- server/routes/auth.js interroge cette colonne par correspondance exacte
-- (SELECT ... WHERE reset_token_hash = ? AND reset_token_expires > NOW()) à chaque clic sur un
-- lien de réinitialisation de mot de passe, sans index dessus jusqu'ici — balayage complet de la
-- table users à chaque appel. Déjà ajoutée dans server/database/schema.sql pour les nouvelles
-- installations ; ce fichier est à exécuter une fois sur les bases déjà en place.

ALTER TABLE users
  ADD KEY idx_users_reset_token_hash (reset_token_hash);
