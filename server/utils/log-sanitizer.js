'use strict';

/**
 * Ne journalise jamais les valeurs de query string : elles peuvent contenir un jeton
 * de réinitialisation ou un code de consultation. Les codes publics placés dans le
 * chemin de l'API sont également masqués.
 */
function sanitizeRequestTargetForLog(requestTarget) {
  const raw = String(requestTarget || '/');
  if (raw === '-') return '-';

  let pathname;
  try {
    pathname = new URL(raw, 'http://localhost').pathname || '/';
  } catch {
    // Même en cas d'URL malformée, ne jamais conserver la query string.
    pathname = raw.split(/[?#]/, 1)[0] || '/';
  }

  const segments = pathname.split('/');
  const route = String(segments[3] || '').toLowerCase();
  const isPublicApiRoute =
    String(segments[1] || '').toLowerCase() === 'api' &&
    String(segments[2] || '').toLowerCase() === 'public';
  const isPublicCodeRoute = isPublicApiRoute &&
    (route === 'consulter' || route === 'verifier') &&
    Boolean(segments[4]) &&
    Boolean(segments[5]);
  const isPublicPaymentLinkRoute = isPublicApiRoute && route === 'paiement' && Boolean(segments[4]);

  if (isPublicCodeRoute) segments[5] = '[redacted]';
  if (isPublicPaymentLinkRoute) segments[4] = '[redacted]';
  return segments.join('/') || '/';
}

/** Le referrer est limité à son origine : aucun chemin ni paramètre n'est journalisé. */
function sanitizeReferrerForLog(referrer) {
  const raw = String(referrer || '').trim();
  if (!raw || raw === '-') return '-';

  try {
    const parsed = new URL(raw);
    return parsed.origin === 'null' ? '-' : parsed.origin;
  } catch {
    return '-';
  }
}

const MASQUE_SQL = '[masqué]';

function masquerValeursSql(message) {
  return String(message || '')
    .replace(/(Duplicate entry )'[^']*'/gi, `$1'${MASQUE_SQL}'`)
    .replace(/(value: )'[^']*'/gi, `$1'${MASQUE_SQL}'`);
}

/**
 * Copie sûre d'une erreur MySQL pour les logs et les captures manuelles Sentry.
 * mysql2 attache la requête interpolée dans `sql` ainsi que `sqlMessage` :
 * ces propriétés peuvent contenir emails, hashes, jetons ou données métier.
 */
function sanitizeErrorForLog(err) {
  if (!err || typeof err !== 'object') return err;
  const isSqlError =
    typeof err.sql === 'string' ||
    typeof err.sqlMessage === 'string' ||
    typeof err.sqlState === 'string';
  if (!isSqlError) return err;

  const safeMessage = masquerValeursSql(err.message || err.sqlMessage || 'Erreur SQL');
  const safe = new Error(safeMessage);
  safe.name = err.name || 'Error';
  if (typeof err.stack === 'string') {
    safe.stack = err.message ? err.stack.split(err.message).join(safeMessage) : err.stack;
  }
  for (const key of ['code', 'errno', 'sqlState']) {
    if (err[key] !== undefined) safe[key] = err[key];
  }
  return safe;
}

const SENTRY_PRIVATE_KEYS = new Set([
  'authorization', 'cookie', 'cookies', 'headers', 'data', 'body',
  'email', 'username', 'ipaddress',
  'password', 'passwordhash', 'resettoken', 'resettokenhash',
  'token', 'accesstoken', 'refreshtoken', 'secret', 'apikey',
  'sql', 'sqlmessage', 'query', 'querystring', 'statement',
  'params', 'parameters', 'vars'
]);

function normalizedKey(key) {
  return String(key).toLowerCase().replace(/[-_]/g, '');
}

/**
 * Nettoie une copie de l'événement Sentry : propriétés SQL/PII supprimées,
 * messages MySQL connus masqués, variables locales de stack supprimées.
 * Si la copie JSON échoue, on abandonne l'événement au lieu d'envoyer l'objet brut.
 */
function sanitizeSentryEvent(event) {
  if (!event || typeof event !== 'object') return event;

  let copy;
  try {
    copy = JSON.parse(JSON.stringify(event));
  } catch {
    return null;
  }

  function scrub(value, key = '') {
    if (typeof value === 'string') {
      return ['message', 'value'].includes(normalizedKey(key))
        ? masquerValeursSql(value)
        : value;
    }
    if (Array.isArray(value)) return value.map(item => scrub(item));
    if (!value || typeof value !== 'object') return value;

    const result = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const normalized = normalizedKey(childKey);
      if (SENTRY_PRIVATE_KEYS.has(normalized)) continue;
      result[childKey] = scrub(childValue, childKey);
    }
    return result;
  }

  const safe = scrub(copy);
  if (safe.request && typeof safe.request.url === 'string') {
    safe.request.url = sanitizeRequestTargetForLog(safe.request.url);
  }
  if (safe.exception && Array.isArray(safe.exception.values)) {
    for (const exception of safe.exception.values) {
      const frames = exception?.stacktrace?.frames;
      if (Array.isArray(frames)) {
        for (const frame of frames) {
          if (frame && typeof frame === 'object') delete frame.vars;
        }
      }
    }
  }
  return safe;
}

module.exports = {
  sanitizeRequestTargetForLog,
  sanitizeReferrerForLog,
  sanitizeErrorForLog,
  sanitizeSentryEvent
};

