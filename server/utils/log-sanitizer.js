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

module.exports = { sanitizeRequestTargetForLog, sanitizeReferrerForLog };
