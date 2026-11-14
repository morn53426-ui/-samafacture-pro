// Lance une sauvegarde immédiate, indépendamment du planificateur automatique.
// Usage : npm run backup
require('dotenv').config();
const { effectuerSauvegarde, BACKUP_DIR } = require('./config/backup');

(async () => {
  console.log(`💾 Sauvegarde manuelle en cours vers ${BACKUP_DIR}...`);
  try {
    const result = await effectuerSauvegarde();
    console.log(`Terminé : ${result.path}`);
  } catch (err) {
    console.error('Sauvegarde manuelle échouée :', err.message);
    process.exitCode = 1;
  }
})();
