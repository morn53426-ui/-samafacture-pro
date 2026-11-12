// Petites fonctions de validation partagées entre les routes, pour garantir que les
// contraintes visibles côté frontend (min="0" etc.) sont aussi appliquées côté serveur —
// un appel direct à l'API ne doit jamais pouvoir enregistrer des valeurs aberrantes.

/** Nombre positif ou nul. Retourne `fallback` si la valeur est absente/invalide/négative. */
function positiveNumber(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/** Pourcentage entre 0 et 100. Retourne `fallback` en dehors de cette plage ou si invalide. */
function percentage(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return fallback;
  return n;
}

/** Entier positif ou nul (ex: stock). */
function positiveInt(value, fallback = 0) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/** Quantité de stock non négative, jusqu'à trois décimales (kg, litres, mètres, etc.). */
function nonNegativeQuantity(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 99999999999.999) return fallback;
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/** Vérifie qu'une chaîne est bien une image encodée en base64 (data URL), pas un contenu arbitraire. */
function isValidImageDataUrl(value) {
  return /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+=*$/.test(value);
}

module.exports = { positiveNumber, percentage, positiveInt, nonNegativeQuantity, isValidImageDataUrl };
