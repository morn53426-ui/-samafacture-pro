/**
 * Lecture du code source d'un domaine de routes pour les tests de structure.
 *
 * Plusieurs tests historiques lisaient `routes/factures.js` ou
 * `routes/professionnel.js` comme un fichier texte unique et vérifiaient la
 * présence de motifs SQL/JS précis. Depuis les refactorings (Phases 1 à 3),
 * ces routes sont réparties entre :
 *   - routes/<domaine>/*.js          (découpage des routeurs)
 *   - services/<domaine>.js          (accès BDD extraits)
 *   - utils/<domaine>.js             (helpers purs extraits)
 *
 * Ce helper concatène ces sources dans un ordre stable. Les tests continuent
 * donc de protéger les mêmes comportements, sans dépendre de l'emplacement
 * physique du code.
 */
const fs = require('node:fs');
const path = require('node:path');

const SERVER_DIR = path.join(__dirname, '..', '..');

function readDirectorySources(directory) {
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.js'))
    .sort()
    .map((name) => fs.readFileSync(path.join(directory, name), 'utf8'))
    .join('\n');
}

/**
 * @param {'factures'|'professionnel'} domain
 * @returns {string} code source concaténé du domaine
 */
function readDomainSource(domain) {
  const parts = [];

  for (const layer of ['utils', 'services']) {
    const file = path.join(SERVER_DIR, layer, `${domain}.js`);
    if (fs.existsSync(file)) parts.push(fs.readFileSync(file, 'utf8'));
  }

  const routesDirectory = path.join(SERVER_DIR, 'routes', domain);
  if (fs.existsSync(routesDirectory) && fs.statSync(routesDirectory).isDirectory()) {
    parts.push(readDirectorySources(routesDirectory));
  }

  const routeFile = path.join(SERVER_DIR, 'routes', `${domain}.js`);
  // Le shim de ré-export (routes/professionnel.js) n'ajoute aucun motif utile :
  // on ne le lit que si le dossier découpé n'existe pas (ancienne arborescence).
  if (!fs.existsSync(routesDirectory) && fs.existsSync(routeFile)) {
    parts.push(fs.readFileSync(routeFile, 'utf8'));
  }

  if (parts.length === 0) {
    throw new Error(`Aucune source trouvée pour le domaine de routes "${domain}".`);
  }
  return parts.join('\n');
}

module.exports = { readDomainSource };
