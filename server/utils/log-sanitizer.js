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

const MASQUE = '[masqué]';

/** Retire du message MySQL les valeurs de colonnes (email, jeton, hash…) citées entre apostrophes. */
function masquerValeursSql(texte) {
  return String(texte)
    .replace(/(Duplicate entry )'[^']*'/g, `$1'${MASQUE}'`)
    .replace(/(value: )'[^']*'/gi, `$1'${MASQUE}'`);
}

/**
 * Prépare une erreur pour console.error. Une erreur mysql2 porte `sql` : la requête avec ses
 * valeurs réelles déjà substituées (hash de mot de passe, email, jetons), que console.error
 * imprimerait telle quelle. On renvoie alors une copie qui ne garde que le nom, le message
 * masqué, la pile et les codes de diagnostic (code, errno, sqlState). Toute autre erreur est
 * renvoyée inchangée.
 */
function sanitizeErrorForLog(err) {
  if (!err || typeof err !== 'object') return err;
  const estSql = typeof err.sql === 'string' || typeof err.sqlMessage === 'string' || typeof err.sqlState === 'string';
  if (!estSql) return err;

  const message = masquerValeursSql(err.message);
  const sure = new Error(message);
  sure.name = err.name;
  if (typeof err.stack === 'string') {
    sure.stack = err.message ? err.stack.split(err.message).join(message) : err.stack;
  }
  for (const cle of ['code', 'errno', 'sqlState']) {
    if (err[cle] !== undefined) sure[cle] = err[cle];
  }
  return sure;
}

module.exports = { sanitizeRequestTargetForLog, sanitizeReferrerForLog, sanitizeErrorForLog };
