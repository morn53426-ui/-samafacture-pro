'use strict';
// Révocation des sessions : chaque JWT embarque la version de jeton (`tv`) de l'utilisateur
// au moment de sa signature. La base reste la source de vérité afin qu'une déconnexion,
// une réinitialisation du mot de passe ou une révocation soit effective immédiatement
// sur tous les workers du cluster, et non après expiration d'un cache mémoire local.
const { pool } = require('../config/db');

async function getTokenVersion(userId) {
  const id = Number(userId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  const [rows] = await pool.query(
    'SELECT token_version FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  if (!rows.length) return null; // compte supprimé
  return Number(rows[0].token_version || 0);
}

// true si le jeton correspond encore à la version courante du compte.
// Chaque vérification relit la base : aucune copie locale ne peut survivre à une révocation
// effectuée par un autre worker ou une autre instance.
async function jetonEstValide(payload) {
  const courante = await getTokenVersion(payload && payload.id);
  if (courante === null) return false;
  return Number(payload.tv || 0) === courante;
}

// Conservée pour compatibilité avec les appels existants après les UPDATE atomiques.
// Il n'existe plus de cache local à invalider.
function invaliderCacheVersion() {}

async function incrementerTokenVersion(conn, userId) {
  await (conn || pool).query(
    'UPDATE users SET token_version = token_version + 1 WHERE id = ?',
    [userId]
  );
  invaliderCacheVersion(userId);
}

module.exports = { getTokenVersion, jetonEstValide, invaliderCacheVersion, incrementerTokenVersion };
