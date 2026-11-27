'use strict';

// Conteneur éphémère : seuls ce processus reçoit les identifiants DDL.
require('dotenv').config();
const { initDatabase, pool } = require('../config/db');

if (process.env.DB_SKIP_MIGRATIONS === 'true') {
  throw new Error('DB_SKIP_MIGRATIONS ne doit pas être activé dans le service de migration.');
}

initDatabase()
  .then(result => {
    console.log('Migrations MySQL terminées. Schéma courant : v' + Number(result?.version || 25) + '.');
  })
  .catch(err => {
    console.error('Échec des migrations MySQL :', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
