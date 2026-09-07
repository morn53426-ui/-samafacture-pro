'use strict';
const fs = require('fs');
const envPath = require('path').join(__dirname, '..', 'server', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const os = require('os');
const { getRuntimeConfig } = require('../server/config/runtime');

function int(name, fallback) {
  const n = Number(process.env[name] || fallback);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} doit être un entier positif.`);
  return n;
}

// DB_POOL_SIZE : même valeur par défaut que server/config/db.js (via getRuntimeConfig()),
// pour ne jamais diverger de ce que le serveur ouvre réellement en l'absence de variable
// d'environnement explicite. Avant ce correctif, ce script utilisait un repli local de 10
// alors que le serveur en utilise 20 par défaut — ce script pouvait donc annoncer PASS pour
// un dimensionnement qui, en réalité, ouvrait deux fois plus de connexions MySQL.
const workers = int('WEB_CONCURRENCY', Math.max(1, typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length));
const pool = int('DB_POOL_SIZE', getRuntimeConfig().dbPoolSize);
const pdfWorkers = int('PDF_WORKERS', 1);
const instances = int('API_INSTANCES', 1);
const dbMax = Number(process.env.DB_MAX_CONNECTIONS || 151);
const apiConnections = workers * pool * instances;
const estimatedTotal = apiConnections + pdfWorkers * pool;
const reserve = Math.max(10, Math.ceil(dbMax * 0.15));

console.log(JSON.stringify({ workers, pool, apiInstances: instances, pdfWorkers, dbMaxConnections: dbMax, apiConnections, estimatedTotalConnections: estimatedTotal, recommendedReserve: reserve }, null, 2));
if (estimatedTotal >= dbMax - reserve) {
  console.error(`FAIL: capacité DB trop proche de max_connections (${estimatedTotal}/${dbMax}). Réduisez les pools/workers ou augmentez la capacité MySQL.`);
  process.exit(2);
}
console.log('PASS: dimensionnement DB raisonnablement borné.');
