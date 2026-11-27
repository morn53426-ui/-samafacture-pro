'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(repoRoot, 'public');
const reportPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
const textExtensions = new Set(['.html', '.js', '.mjs', '.cjs', '.json', '.css', '.webmanifest']);

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(absolute));
    else if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) result.push(absolute);
  }
  return result;
}

function inside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function resolveLocalScript(src, htmlFile) {
  const clean = src.split(/[?#]/, 1)[0].trim();
  if (!clean || /^(?:https?:|data:|blob:|\/\/)/i.test(clean)) return null;
  const candidate = clean.startsWith('/')
    ? path.resolve(publicRoot, '.' + clean)
    : path.resolve(path.dirname(htmlFile), clean);
  return inside(publicRoot, candidate) ? candidate : null;
}

function markdownList(items, emptyMessage) {
  return items.length ? items.map(item => '- ' + item).join('\n') : '- ' + emptyMessage;
}

const publicFiles = listFiles(publicRoot);
const htmlFiles = publicFiles.filter(file => path.extname(file).toLowerCase() === '.html');
const sourceFiles = publicFiles.filter(file => textExtensions.has(path.extname(file).toLowerCase()));
const scriptFiles = publicFiles.filter(file =>
  path.extname(file).toLowerCase() === '.js' && inside(path.join(publicRoot, 'js'), file)
);

const htmlReferences = new Map();
const missingLocalScripts = [];
for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const scriptTag = /<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi;
  for (const match of html.matchAll(scriptTag)) {
    const resolved = resolveLocalScript(match[2], htmlFile);
    if (!resolved || !/\.(?:m?js)$/i.test(resolved)) continue;
    if (!fs.existsSync(resolved)) {
      missingLocalScripts.push(path.relative(repoRoot, resolved) + ' (référencé par ' + path.relative(repoRoot, htmlFile) + ')');
      continue;
    }
    const refs = htmlReferences.get(resolved) || new Set();
    refs.add(path.relative(repoRoot, htmlFile));
    htmlReferences.set(resolved, refs);
  }
}

const rows = [];
for (const scriptFile of scriptFiles) {
  const relative = path.relative(repoRoot, scriptFile);
  const basename = path.basename(scriptFile);
  const htmlRefs = [...(htmlReferences.get(scriptFile) || [])];
  const literalRefs = [];
  for (const sourceFile of sourceFiles) {
    if (sourceFile === scriptFile) continue;
    const source = fs.readFileSync(sourceFile, 'utf8');
    if (source.includes(basename)) literalRefs.push(path.relative(repoRoot, sourceFile));
  }
  let status;
  if (htmlRefs.length) status = 'chargé par balise script HTML';
  else if (literalRefs.length) status = 'référence littérale trouvée (à examiner)';
  else status = 'candidat non référencé statiquement — NE PAS supprimer sans revue dynamique';
  rows.push({ relative, status, htmlRefs, literalRefs });
}

const candidates = rows.filter(row => row.htmlRefs.length === 0 && row.literalRefs.length === 0);
const lines = [
  '# Audit des références des scripts frontend',
  '',
  'Généré par scripts/audit-public-script-references.js.',
  '',
  '- Pages HTML analysées : ' + htmlFiles.length,
  '- Fichiers texte frontend analysés : ' + sourceFiles.length,
  '- Scripts dans public/js : ' + scriptFiles.length,
  '- Scripts chargés directement par HTML : ' + rows.filter(row => row.htmlRefs.length).length,
  '- Candidats sans référence statique : ' + candidates.length,
  '- Balises script locales cassées : ' + missingLocalScripts.length,
  '',
  '> Un candidat n’est pas une preuve de code mort. Ce contrôle ne peut pas résoudre les chemins calculés à l’exécution, les scripts servis par le backend, ni les appels globaux depuis du code généré. Aucune suppression automatique n’est effectuée.',
  '',
  '## Résultats par script',
  '',
  ...rows.map(row => {
    const detail = row.htmlRefs.length
      ? ' — HTML : ' + row.htmlRefs.join(', ')
      : row.literalRefs.length
        ? ' — Références : ' + row.literalRefs.join(', ')
        : '';
    return '- **' + row.relative + '** : ' + row.status + detail;
  }),
  '',
  '## Balises script locales cassées',
  '',
  markdownList(missingLocalScripts, 'Aucune référence locale .js/.mjs manquante détectée.'),
  '',
  '## Candidats à une revue manuelle',
  '',
  markdownList(candidates.map(row => row.relative), 'Aucun candidat sans référence statique.')
];
const report = lines.join('\n') + '\n';
if (reportPath) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report);
} else {
  process.stdout.write(report);
}
if (missingLocalScripts.length) process.exitCode = 1;
