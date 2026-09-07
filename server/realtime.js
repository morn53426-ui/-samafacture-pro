const cluster = require('cluster');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { getRedisClient, isRedisConfigured, isRedisReady } = require('./config/redis');

let io = null;
let redisSub = null;

async function initSocket(httpServer) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.APP_URL || '')
    .split(',').map(o => o.trim()).filter(Boolean);
  const production = process.env.NODE_ENV === 'production';
  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        // Les clients same-origin et les outils sans en-tête Origin restent autorisés.
        // En production, les origines cross-origin doivent être explicitement déclarées.
        if (!origin || allowedOrigins.includes(origin) || (!production && allowedOrigins.length === 0)) {
          return callback(null, true);
        }
        callback(new Error('Origine Socket.IO non autorisée.'));
      }
    },
    // Autorise la reprise d'une session Socket.IO après une coupure réseau courte.
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000, skipMiddlewares: false }
  });

  if (cluster.isWorker) {
    const { createAdapter: createClusterAdapter } = require('@socket.io/cluster-adapter');
    const { setupWorker } = require('@socket.io/sticky');
    io.adapter(createClusterAdapter());
    setupWorker(io);
  }

  // En multi-conteneurs, l'adaptateur Redis permet à une notification émise par l'instance A
  // d'atteindre les sockets connectées sur B/C. En mode local sans REDIS_URL, le cluster-adapter
  // Node reste utilisé comme auparavant.
  if (isRedisConfigured() && isRedisReady()) {
    const { createAdapter: createRedisAdapter } = require('@socket.io/redis-adapter');
    const redisPub = getRedisClient();
    redisSub = redisPub.duplicate();
    redisSub.on('error', (err) => console.error('⚠️ Redis Socket.IO subscriber :', err.message));
    await redisSub.connect();
    io.adapter(createRedisAdapter(redisPub, redisSub));
    console.log('📡 Socket.IO : adaptateur Redis activé (multi-instance).');
  }

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentification requise.'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.id;
      next();
    } catch (err) {
      next(new Error('Session invalide ou expirée.'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
  });

  return io;
}

async function closeSocket() {
  if (redisSub?.isOpen) await redisSub.quit();
  redisSub = null;
  if (io) await new Promise(resolve => io.close(resolve));
  io = null;
}

function notifierUtilisateur(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}

module.exports = { initSocket, closeSocket, notifierUtilisateur };
