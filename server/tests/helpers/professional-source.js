const fs = require('node:fs');
const path = require('node:path');

// Source complet de /api/pro : point d'entrée + modules du dossier routes/professionnel/.
// Les tests de garde par regex lisent ce texte, quel que soit le module qui porte le code.
const routesDir = path.join(__dirname, '..', '..', 'routes');
const moduleDir = path.join(routesDir, 'professionnel');
const ORDER = ['shared', 'sales-team', 'company-group', 'operations', 'accounting-crm'];

function readProfessionalSource() {
  const files = [path.join(routesDir, 'professionnel.js'), ...ORDER.map((name) => path.join(moduleDir, `${name}.js`))];
  const known = new Set(fs.readdirSync(moduleDir).map((f) => f.replace(/\.js$/, '')));
  for (const name of known) {
    if (!ORDER.includes(name)) throw new Error(`Module routes/professionnel/${name}.js absent de ORDER dans professional-source.js`);
  }
  return files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
}

module.exports = { readProfessionalSource };
