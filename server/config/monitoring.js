// Suivi des erreurs en production, façon "boîte noire" : si le serveur plante chez un
// client réel, une alerte arrive automatiquement au lieu de dépendre du client pour le
// signaler. Entièrement facultatif — reste désactivé tant que SENTRY_DSN n'est pas défini
// dans .env, sans rien casser (même comportement que Google/SMTP/paiements dans ce projet).
let sentryInstance = null;

function isMonitoringEnabled() {
  return !!process.env.SENTRY_DSN;
}

/** À appeler une seule fois, tout au début de app.js. Renvoie le module Sentry si activé. */
function initMonitoring() {
  if (!isMonitoringEnabled()) return null;

  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      // Proportion des requêtes suivies en détail (performance). 0.1 = 10%, suffisant pour
      // repérer les tendances sans envoyer un volume de données excessif sur un compte gratuit.
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1
    });
    sentryInstance = Sentry;
    console.log('🛰️  Suivi des erreurs Sentry activé.');
    return Sentry;
  } catch (err) {
    console.warn(
      "⚠️  SENTRY_DSN est configuré mais le paquet @sentry/node est introuvable. " +
      "Lancez `npm install` pour activer le suivi des erreurs."
    );
    return null;
  }
}

/** Envoie une erreur à Sentry si le suivi est actif ; ne fait rien sinon (sûr à appeler toujours). */
function captureException(err) {
  if (sentryInstance) sentryInstance.captureException(err);
}

module.exports = { initMonitoring, captureException, isMonitoringEnabled };
