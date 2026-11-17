'use strict';

/**
 * Retourne la date civile d'un instant dans le fuseau IANA du compte.
 * Les dates sont assemblées depuis formatToParts pour éviter toute dépendance
 * à l'ordre d'affichage ou à la locale du système hôte.
 */
function localDateString(timeZone = 'Africa/Dakar', now = new Date()) {
  const instant = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(instant.getTime())) {
    throw new TypeError('Instant invalide pour le calcul de la date locale.');
  }

  const zone = typeof timeZone === 'string' && timeZone.trim()
    ? timeZone.trim()
    : 'Africa/Dakar';

  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (_) {
    // Une ancienne valeur de fuseau invalide ne doit pas arrêter le planificateur.
    // UTC est un repli déterministe ; les valeurs nouvelles sont validées à l'API.
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  const parts = Object.fromEntries(
    formatter.formatToParts(instant)
      .filter(part => ['year', 'month', 'day'].includes(part.type))
      .map(part => [part.type, part.value])
  );

  if (!parts.year || !parts.month || !parts.day) {
    throw new Error('Impossible de déterminer la date locale du compte.');
  }
  return parts.year + '-' + parts.month + '-' + parts.day;
}

module.exports = { localDateString };
