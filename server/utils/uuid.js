'use strict';

// Identifiants générés par crypto.randomUUID() et utilisés comme noms de fichiers PDF.
// Le format strict évite qu'une valeur issue d'une tâche Redis puisse sortir du répertoire dédié.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

module.exports = { isUuid };
