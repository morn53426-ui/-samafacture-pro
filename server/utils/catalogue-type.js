const TYPES_CATALOGUE = Object.freeze(['produit', 'service', 'non_classe']);

function normalizeCatalogueType(value, fallback = 'produit') {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return TYPES_CATALOGUE.includes(normalized) ? normalized : null;
}

// Les anciennes fiches non classées restent stockables afin de préserver leur
// comportement historique. Seul le type service est exclu du stock physique.
function isStockManagedType(type) {
  return type === 'produit' || type === 'non_classe';
}

module.exports = {
  TYPES_CATALOGUE,
  normalizeCatalogueType,
  isStockManagedType
};
