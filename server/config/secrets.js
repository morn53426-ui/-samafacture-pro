const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ENV_PATH = path.join(__dirname, '..', '.env');
const INSECURE_VALUES = ['change_this_secret_in_production', ''];

/**
 * Garantit que process.env.JWT_SECRET contient une valeur sûre avant que le serveur
 * ne commence à traiter des requêtes.
 *
 * - En développement/test : si absent ou laissé à la valeur par défaut de .env.example, un
 *   secret aléatoire de 384 bits est généré et sauvegardé dans .env, pour que ça fonctionne
 *   "out of the box" sans étape de configuration manuelle en local.
 * - En production (NODE_ENV=production) : **le serveur refuse de démarrer** si JWT_SECRET est
 *   absent ou vaut une valeur par défaut connue. Avant ce changement, un secret aléatoire était
 *   généré silencieusement même en production — un montage Docker mal permissionné (voir
 *   AUDIT_PRODUCTION.md §1.3) pouvait alors faire régénérer un nouveau secret à *chaque*
 *   redémarrage, invalidant toutes les sessions sans qu'aucune erreur ne soit visible. Échouer
 *   bruyamment au démarrage vaut mieux qu'échouer silencieusement en production.
 */
function ensureJwtSecret() {
  if (process.env.JWT_SECRET && !INSECURE_VALUES.includes(process.env.JWT_SECRET)) {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      "JWT_SECRET manquant ou non sécurisé. En production, le serveur refuse de démarrer sans un " +
      "JWT_SECRET explicite (voir AUDIT_PRODUCTION.md §1.3). Générez-en un avec `openssl rand -hex 48` " +
      "et ajoutez-le dans server/.env avant de relancer."
    );
  }

  const newSecret = crypto.randomBytes(48).toString('hex');
  process.env.JWT_SECRET = newSecret;

  try {
    let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
    if (/^JWT_SECRET=.*$/m.test(envContent)) {
      envContent = envContent.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${newSecret}`);
    } else {
      envContent += (envContent.length && !envContent.endsWith('\n') ? '\n' : '') + `JWT_SECRET=${newSecret}\n`;
    }
    fs.writeFileSync(ENV_PATH, envContent, 'utf8');
    console.log('🔐 JWT_SECRET généré automatiquement et enregistré dans server/.env (première utilisation, développement uniquement).');
  } catch (err) {
    console.warn("⚠️  Impossible d'écrire le secret JWT dans .env — un secret temporaire est utilisé pour cette session uniquement.");
    console.warn('   Toutes les sessions seront invalidées au prochain redémarrage. Ajoutez JWT_SECRET manuellement dans server/.env pour l\'éviter.');
  }
}

module.exports = { ensureJwtSecret };
