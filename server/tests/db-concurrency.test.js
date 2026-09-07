const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
// Importé en premier pour ses effets de bord (NODE_ENV, DB_NAME=samafacture_test, etc.) —
// mêmes garanties que les autres fichiers de tests/, pour ne jamais toucher une base réelle.
const { teardownTestEnvironment } = require('./setup');
const { initDatabase } = require('../config/db');

// Simule ce qui se produit réellement en mode cluster (server/cluster.js) : plusieurs
// processus/appels indépendants exécutent initDatabase() au même instant. Avant la
// correction (verrou GET_LOCK côté MySQL), plusieurs appels simultanés pouvaient tenter le
// même `ALTER TABLE ADD COLUMN` / `ADD INDEX` en parallèle — un seul réussissait, les autres
// levaient une erreur MySQL non interceptée (ex: colonne déjà existante), ce qui aurait fait
// planter le(s) worker(s) concerné(s) à chaque démarrage du cluster.
describe('Initialisation du schéma sous concurrence (mode cluster)', () => {
  test('5 appels simultanés à initDatabase() réussissent tous, sans erreur', async () => {
    const resultats = await Promise.allSettled(
      Array.from({ length: 5 }, () => initDatabase())
    );
    const echecs = resultats.filter(r => r.status === 'rejected');
    if (echecs.length) {
      console.error('Échecs initDatabase() concurrents :', echecs.map(e => e.reason?.message));
    }
    assert.equal(echecs.length, 0, "aucun appel concurrent à initDatabase() ne doit échouer (verrou GET_LOCK)");
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
