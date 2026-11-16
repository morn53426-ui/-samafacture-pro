'use strict';

/**
 * Attend que MySQL accepte une requête simple sans tenter de créer la base ou de
 * rejouer les migrations. Le schéma est initialisé par le processus primaire de
 * l'application avant que le service pdf-worker soit démarré (depends_on: app healthy).
 */
const DEFAULT_MAX_ATTEMPTS = 30;
const DEFAULT_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForDatabase(pool, {
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  delayMs = DEFAULT_DELAY_MS,
  sleepFn = sleep,
  onRetry = () => {}
} = {}) {
  if (!pool || typeof pool.query !== 'function') {
    throw new TypeError('Un pool MySQL valide est requis.');
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('maxAttempts doit être un entier supérieur ou égal à 1.');
  }
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new RangeError('delayMs doit être un nombre positif ou nul.');
  }

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;
      onRetry(err, attempt, maxAttempts);
      await sleepFn(delayMs);
    }
  }

  throw new Error(
    `MySQL reste indisponible après ${maxAttempts} tentatives : ${lastError?.message || 'erreur inconnue'}`,
    { cause: lastError }
  );
}

module.exports = { waitForDatabase };
