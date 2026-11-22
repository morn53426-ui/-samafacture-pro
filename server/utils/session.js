'use strict';
// Révocation des sessions et contexte d'accès : la base reste la source de vérité
// sur tous les workers. Le contexte inclut les dates d'essai pour faire appliquer
// l'expiration côté serveur avant qu'une route ne lise les droits du compte.
const { pool } = require('../config/db');

async function getTokenVersion(userId) {
  const id = Number(userId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  const [rows] = await pool.query(
    'SELECT token_version FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  if (!rows.length) return null;
  return Number(rows[0].token_version || 0);
}

async function getSessionContext(payload) {
  const id = Number(payload && payload.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  const [rows] = await pool.query(
    `SELECT token_version, plan, trial_plan, trial_status, trial_started_at, trial_ends_at,
            CASE
              WHEN trial_status = 'trialing'
               AND (trial_ends_at IS NULL OR trial_ends_at <= UTC_TIMESTAMP())
              THEN 1 ELSE 0
            END AS trial_expired
     FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!rows.length) return null;
  if (Number(payload.tv || 0) !== Number(rows[0].token_version || 0)) return null;
  return rows[0];
}

// Conservée pour les appelants historiques : la réponse reste strictement booléenne.
async function jetonEstValide(payload) {
  return Boolean(await getSessionContext(payload));
}

// Conservée pour compatibilité avec les appels existants après les UPDATE atomiques.
function invaliderCacheVersion() {}

async function incrementerTokenVersion(conn, userId) {
  await (conn || pool).query(
    'UPDATE users SET token_version = token_version + 1 WHERE id = ?',
    [userId]
  );
  invaliderCacheVersion(userId);
}

module.exports = { getTokenVersion, getSessionContext, jetonEstValide, invaliderCacheVersion, incrementerTokenVersion };
