/**
 * Helpers utiles à `routes/professionnel.js` — extraits dans ce module de vérité
 * commun (voir refactoring Phase 3). Fonctions pures, réutilisables sans pool.
 */
const crypto = require('crypto');

/** Renormalise un nom de méthode de paiement pour la reconnaissance dans {wave, orange money, ...}. */
function paymentTreasuryAccount(method) {
  const normalized = String(method || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const bankMethods = new Set([
    'wave', 'orange money', 'paydunya', 'virement bancaire', 'virement',
    'cheque', 'carte bancaire', 'carte'
  ]);
  if (bankMethods.has(normalized)) return '521';
  if (['especes', 'cash'].includes(normalized)) return '571';
  return null;
}

/** `undefined/null` → null, sinon texte tronqué ; retourne `null` quand vide. */
function optionalText(value, maxLength) {
  if (value === undefined || value === null) return null;
  return String(value).trim().slice(0, maxLength) || null;
}

/** Date ISO stricte (aaaa-mm-jj) ou undefined si invalide. */
function optionalIsoDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const date = new Date(text + 'T00:00:00.000Z');
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? undefined : text;
}

/** Reférence aléatoire `PREFIX-AAAA-<4 hex>`. */
function randomRef(prefix) {
  return prefix + '-' + new Date().getFullYear() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

/** parseJson tolérant : objets passés vérbatim, sinon JSON.parse avec fallback. */
function parseJson(value, fallback) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

/** Pagination normalisée d'une requête (query string) — null si non demandée. */
function parseCompanyGroupPagination(query) {
  const requested = query.page !== undefined || query.limit !== undefined;
  if (!requested) return null;
  const rawPage = query.page === undefined ? '1' : query.page;
  const rawLimit = query.limit === undefined ? '20' : query.limit;
  if (Array.isArray(rawPage) || Array.isArray(rawLimit) ||
      !/^\d+$/.test(String(rawPage)) || !/^\d+$/.test(String(rawLimit))) {
    return { error: 'Paramètres de pagination invalides.' };
  }
  const page = Number(rawPage);
  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    return { error: 'La page doit être positive et la limite comprise entre 1 et 50.' };
  }
  return { page, limit, offset: (page - 1) * limit };
}

/** Métas de pagination pour les réponses paginées. */
function companyGroupPaginationMeta(total, pagination) {
  if (!pagination) return undefined;
  const totalPages = Math.ceil(total / pagination.limit);
  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages,
    from: total ? pagination.offset + 1 : 0,
    to: Math.min(pagination.offset + pagination.limit, total),
    hasPrevious: pagination.page > 1 && totalPages > 0,
    hasNext: pagination.page < totalPages
  };
}

/** Valide un identifiant numérique positif (chaîne de chiffres > 0). */
function idOk(value) {
  return /^\d+$/.test(String(value || '')) && Number(value) > 0;
}

/** Arrondit un montant au centime près, sans dérive flottante. */
function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999) return null;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Échappe une valeur pour une insertion sûre dans du HTML (texte brut). */
function htmlEscape(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

module.exports = {
  paymentTreasuryAccount,
  optionalText,
  optionalIsoDate,
  randomRef,
  parseJson,
  parseCompanyGroupPagination,
  companyGroupPaginationMeta,
  htmlEscape,
  idOk,
  money
};
