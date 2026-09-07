-- Migration : personnalisation des modèles de facture (couleurs / logo / police)
-- Aucun dossier de migrations n'était présent dans le zip fourni : ce fichier est à exécuter
-- manuellement sur la base de données (une seule fois), avant de déployer le code modifié.
--
-- La colonne est nullable et sans valeur par défaut autre que NULL : les comptes existants ne
-- sont pas affectés, et facture-templates.js traite déjà NULL / absent exactement comme avant
-- (voir server/tests/personnalisation.test.js, "sans personnalisation, le HTML est strictement
-- identique à avant").

ALTER TABLE users
  ADD COLUMN facture_personnalisation TEXT NULL
  COMMENT 'JSON : couleur_principale, couleur_secondaire, couleur_texte, police, taille_texte, epaisseur_texte, logo_taille. Voir server/routes/auth.js (validerPersonnalisation) et public/js/facture-templates.js.';
