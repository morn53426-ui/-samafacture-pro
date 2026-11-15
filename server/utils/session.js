'use strict';
// Révocation des sessions : chaque JWT embarque la version de jeton (`tv`) de l'utilisateur au
// moment de sa signature. Incrémenter users.token_version (changement/réinitialisation de mot
// de passe, liaison Google) invalide aussitôt tous les jetons déjà émis.
// Un jeton ancien sans `tv` est lu comme version 0 : les sessions existantes restent valides
// tant que la version n'a pas été incrémentée (aucune déconnexion de masse au déploiement).
const { pool } = require('../config/db');

const CACHE_TTL_MS = 15 * 1000; // limite la charge SQL ; autres workers : au plus 15 s de retard
const cache = new Map();

async function getTokenVersion(userId) {
  const id = Number(userId);
  const hit = cache.get(id);
  if (hit && hit.exp > Date.now()) return hit.tv;
  const [rows] = await pool.query('SELECT token_version FROM users WHERE id = ? LIMIT 1', [id]);
  if (!rows.length) { cache.delete(id); return null; } // compte supprimé
  const tv = Number(rows[0].token_version || 0);
  if (cache.size > 5000) cache.clear();
  cache.set(id, { tv, exp: Date.now() + CACHE_TTL_MS });
  return tv;
}

// true si le jeton correspond encore à la version courante du compte.
async function jetonEstValide(payload) {
  const courante = await getTokenVersion(payload && payload.id);
  if (courante === null) return false;
  return Number(payload.tv || 0) === courante;
}

// À appeler après avoir incrémenté token_version en base (même processus).
function invaliderCacheVersion(userId) {
  cache.delete(Number(userId));
}

async function incrementerTokenVersion(conn, userId) {
  await (conn || pool).query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [userId]);
  invaliderCacheVersion(userId);
}

module.exports = { getTokenVersion, jetonEstValide, invaliderCacheVersion, incrementerTokenVersion };
