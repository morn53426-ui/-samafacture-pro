// Lance une sauvegarde immédiate, indépendamment du planificateur automatique.
// Usage : npm run backup
require('dotenv').config();
const { effectuerSauvegarde, BACKUP_DIR } = require('./config/backup');

console.log(`💾 Sauvegarde manuelle en cours vers ${BACKUP_DIR}...`);
effectuerSauvegarde().then(() => {
  console.log('Terminé.');
  process.exit(0);
});
