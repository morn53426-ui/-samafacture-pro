// Point d'entrée "production" : lance un processus worker par cœur CPU, chacun exécutant
// une instance complète du serveur (app.js). Node.js étant mono-thread par processus, un
// seul processus ne peut utiliser qu'un seul cœur — le mode cluster permet d'exploiter
// tout le CPU disponible et d'absorber beaucoup plus de requêtes simultanées.
//
// Usage : npm run start:cluster (au lieu de npm start)
// Réglable via la variable d'environnement WEB_CONCURRENCY (nombre de workers).
const cluster = require('cluster');
const os = require('os');
const http = require('http');
const { setupMaster } = require('@socket.io/sticky');
const { setupPrimary } = require('@socket.io/cluster-adapter');

if (cluster.isPrimary) {
  // Génère (si besoin) le JWT_SECRET et l'écrit dans .env AVANT de forker les workers.
  // Sans ça, chaque worker exécute indépendamment ensureJwtSecret() au démarrage de
  // app.js : au tout premier lancement (sans JWT_SECRET déjà défini), plusieurs workers
  // généreraient chacun un secret différent en même temps et se marcheraient dessus en
  // écrivant .env en parallèle, provoquant des déconnexions aléatoires selon le worker
  // qui traite la requête. En le générant ici une seule fois, tous les workers forkés
  // ensuite liront (via dotenv) le même secret déjà écrit sur disque.
  require('dotenv').config();
  const { ensureJwtSecret } = require('./config/secrets');
  ensureJwtSecret();

  const available = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  const numWorkers = Math.max(1, Number(process.env.WEB_CONCURRENCY) || available);
  const PORT = process.env.PORT || 4000;
  console.log(`🧩 Mode cluster : démarrage de ${numWorkers} worker(s) (processus principal ${process.pid}).`);

  // Le processus principal ne sert aucune requête lui-même : il se contente de router
  // chaque connexion entrante (HTTP normal ET WebSocket) vers toujours le même worker
  // pour un client donné (setupMaster), et de relayer les événements Socket.io émis par
  // un worker vers tous les autres (setupPrimary) — voir server/realtime.js pour le détail.
  const httpServer = http.createServer();
  setupMaster(httpServer, { loadBalancingMethod: 'least-connection' });
  setupPrimary();
  cluster.setupPrimary({ serialization: 'advanced' }); // requis par @socket.io/cluster-adapter

  httpServer.listen(PORT, () => {
    console.log(`🧩 Routage cluster en écoute sur le port ${PORT}.`);
  });

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    if (shuttingDown) return;
    console.error(`⚠️  Worker ${worker.process.pid} arrêté (code ${code}${signal ? `, signal ${signal}` : ''}). Redémarrage automatique...`);
    cluster.fork();
  });

  let shuttingDown = false;
  async function shutdownPrimary(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} reçu — arrêt du cluster...`);
    httpServer.close();
    const workers = Object.values(cluster.workers || {}).filter(Boolean);
    for (const worker of workers) worker.disconnect();
    const forceTimer = setTimeout(() => {
      for (const worker of Object.values(cluster.workers || {}).filter(Boolean)) worker.kill();
      process.exit(1);
    }, 10000);
    forceTimer.unref();
    await new Promise(resolve => {
      const check = () => Object.values(cluster.workers || {}).filter(Boolean).length === 0
        ? resolve() : setTimeout(check, 100);
      check();
    });
    clearTimeout(forceTimer);
    process.exit(0);
  }
  process.on('SIGTERM', () => { void shutdownPrimary('SIGTERM'); });
  process.on('SIGINT', () => { void shutdownPrimary('SIGINT'); });

} else {
  // Chaque worker exécute une instance normale du serveur ; le processus principal
  // route les connexions entrantes vers lui via le mécanisme "sticky" ci-dessus.
  require('./app.js');
}
