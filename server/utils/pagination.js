// Aide partagée pour paginer les listes (clients, produits, factures) — évite de charger
// des milliers de lignes d'un coup, ce qui deviendrait lent au-delà de quelques centaines
// d'enregistrements.

/** Lit et valide page/limite depuis les paramètres de requête (avec des bornes raisonnables). */
function getPagination(query, { defaultLimite = 25, maxLimite = 100 } = {}) {
  let page = parseInt(query.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;

  let limite = parseInt(query.limite, 10);
  if (!Number.isFinite(limite) || limite < 1) limite = defaultLimite;
  if (limite > maxLimite) limite = maxLimite;

  const offset = (page - 1) * limite;
  return { page, limite, offset };
}

/** Construit l'objet de métadonnées renvoyé au frontend à côté des résultats. */
function buildPaginationMeta(page, limite, total) {
  return { page, limite, total, total_pages: Math.max(1, Math.ceil(total / limite)) };
}

module.exports = { getPagination, buildPaginationMeta };
