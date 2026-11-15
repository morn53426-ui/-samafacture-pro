-- Révocation des sessions (voir server/utils/session.js).
-- Appliquée automatiquement au démarrage par server/config/db.js ; ce script sert aux bases gérées à la main.
-- À exécuter une seule fois (erreur « Duplicate column » = déjà appliqué).
ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0;
