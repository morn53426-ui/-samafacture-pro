// Configuration partagée par tous les fichiers de test. Doit être importé en tout premier
// (avant tout autre require du projet), pour que les variables d'environnement soient en
// place avant que db.js ne crée son pool de connexions.
process.env.NODE_ENV = 'test';
// Empêche server/config/secrets.js d'écrire un JWT_SECRET dans le vrai fichier .env pendant
// les tests — n'importe quelle valeur suffit ici, elle n'a pas besoin d'être secrète.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-de-test-ne-jamais-utiliser-en-production';
// Toujours utiliser une base séparée de la base réelle pour les tests : ils créent et
// suppriment des données librement. DB_NAME doit être défini AVANT le require('dotenv')
// plus bas pour que dotenv ne l'écrase pas (dotenv ne remplace jamais une variable déjà
// définie dans process.env).
process.env.DB_NAME = process.env.TEST_DB_NAME || 'samafacture_test';

const path = require('path');
const http = require('http');
const { after } = require('node:test');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { app } = require('../app');
const { initDatabase, pool } = require('../config/db');
const { closeBrowser } = require('../utils/pdf');

let initialized = false;
let testHttpServer = null;
let testHttpServerPromise = null;

/**
 * Démarre un serveur HTTP éphémère uniquement pour les tests qui utilisent Puppeteer.
 * Supertest peut tester `app` sans écouter sur un port, mais Chromium doit pouvoir
 * naviguer vers une vraie URL et charger les fichiers statiques + l'API. Le serveur
 * écoute sur 127.0.0.1 et un port aléatoire pour éviter tout conflit avec le serveur
 * de développement (4000). `unref()` permet au processus de test de se terminer
 * normalement sans teardown global fragile.
 */
async function ensureTestHttpServer() {
  if (testHttpServerPromise) return testHttpServerPromise;
  testHttpServerPromise = new Promise((resolve, reject) => {
    testHttpServer = http.createServer(app);
    testHttpServer.once('error', reject);
    testHttpServer.listen(0, '127.0.0.1', () => {
      testHttpServer.unref();
      const address = testHttpServer.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Impossible de déterminer le port du serveur HTTP de test.'));
        return;
      }
      process.env.PDF_BASE_URL = `http://127.0.0.1:${address.port}`;
      resolve(process.env.PDF_BASE_URL);
    });
  });
  return testHttpServerPromise;
}

/** Initialise la base de test (créée automatiquement si elle n'existe pas encore). */
async function setupTestDatabase() {
  if (initialized) return;
  await initDatabase();
  // Disponible pour les tests PDF/email qui passent par Puppeteer. Le serveur est
  // volontairement indépendant de PORT=4000 et n'altère jamais le serveur de production.
  await ensureTestHttpServer();
  initialized = true;
}

/** Génère un email unique à chaque appel, pour que les tests ne se percutent jamais. */
function emailDeTest(prefixe = 'test') {
  return `${prefixe}-${Date.now()}-${Math.floor(Math.random() * 100000)}@exemple-test.com`;
}

/**
 * Supprime un utilisateur de test et tout ce qui lui est rattaché (cascade via les clés
 * étrangères : clients, produits, factures, dépenses...). À appeler dans un `after()`
 * pour ne pas laisser de données de test s'accumuler dans la base.
 */
async function nettoyerUtilisateur(userId) {
  if (!userId) return;
  await pool.query('DELETE FROM users WHERE id = ?', [userId]);
}


/**
 * Ferme les ressources créées par le fichier de test courant.
 * Le hook est enregistré par chaque test APRÈS ses propres hooks de nettoyage.
 */
async function teardownTestEnvironment() {
  // Ferme le navigateur Chromium partagé (utils/pdf.js) s'il a été lancé par ce fichier de
  // test — sans ça, le process Chromium reste ouvert et empêche node --test de se terminer
  // proprement, provoquant l'annulation en cascade des fichiers de test suivants.
  await closeBrowser();
  if (testHttpServer) {
    await new Promise((resolve) => {
      if (!testHttpServer.listening) return resolve();
      testHttpServer.close(() => resolve());
    });
    testHttpServer = null;
    testHttpServerPromise = null;
  }
  try {
    await pool.end();
  } catch (err) {
    if (!/closed|pool/i.test(String(err && err.message))) throw err;
  }
  initialized = false;
}

module.exports = { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, ensureTestHttpServer, teardownTestEnvironment };

