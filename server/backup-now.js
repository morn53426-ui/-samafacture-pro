// Lance une sauvegarde immédiate, indépendamment du planificateur quotidien.
// Usage : npm run backup
require('dotenv').config();
const { effectuerSauvegarde, BACKUP_DIR } = require('./config/backup');

async function main() {
  console.log(`💾 Sauvegarde manuelle en cours vers ${BACKUP_DIR}...`);
  try {
    const success = await effectuerSauvegarde();
    if (!success) {
      console.error('❌ La sauvegarde a échoué. Consultez le message ci-dessus et corrigez la configuration avant de réessayer.');
      process.exitCode = 1;
      return;
    }
    console.log('✅ Sauvegarde terminée.');
  } catch (err) {
    console.error('❌ Impossible de réaliser la sauvegarde :', err.message);
    process.exitCode = 1;
  }
}

main();
