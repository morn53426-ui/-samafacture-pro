const cluster = require('cluster');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { pool } = require('./config/db');
const { getRedisClient, isRedisConfigured, isRedisReady } = require('./config/redis');
const { isEnterprisePlan } = require('./utils/plans');

let io = null;
let redisSub = null;

/** Résout l'espace temps réel demandé via une adhésion d'équipe ou un groupe Entreprise actif. */
async function resolveSocketTenant(userId, requestedOwner, query = pool.query.bind(pool)) {
  const actorId = Number(userId);
  if (!Number.isSafeInteger(actorId) || actorId <= 0) throw new Error('Utilisateur Socket.IO invalide.');
  if (requestedOwner === undefined || requestedOwner === null || requestedOwner === '') return actorId;
  if (!/^\\d+$/.test(String(requestedOwner))) throw new Error('Sélection d’entreprise invalide.');

  const selectedOwner = Number(requestedOwner);
  if (!Number.isSafeInteger(selectedOwner) || selectedOwner <= 0) throw new Error('Sélection d’entreprise invalide.');
  if (selectedOwner === actorId) return actorId;

  const [teamRows] = await query(
    'SELECT owner_user_id FROM pro_team_members WHERE member_user_id = ? AND owner_user_id = ? AND active = 1 LIMIT 1',
    [actorId, selectedOwner]
  );
  if (teamRows.length) return Number(teamRows[0].owner_user_id);

  // Le propriétaire d'un groupe peut ouvrir une filiale uniquement après son
  // rattachement explicite et tant que son propre plan Entreprise reste actif.
  // La relation est orientée : une filiale ne peut pas remonter vers le groupe.
  const [groupRows] = await query(
    `SELECT gc.company_owner_id AS owner_user_id, group_owner.plan AS group_plan
     FROM pro_company_group_companies gc
     JOIN pro_company_groups g ON g.id = gc.group_id
     JOIN users group_owner ON group_owner.id = g.owner_user_id
     WHERE g.owner_user_id = ? AND gc.company_owner_id = ?
     LIMIT 1`,
    [actorId, selectedOwner]
  );
  if (groupRows.length && isEnterprisePlan(groupRows[0].group_plan)) {
    return Number(groupRows[0].owner_user_id);
  }

  throw new Error('Adhésion à cette entreprise absente ou inactive.');
}

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

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentification requise.'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (!(await require('./utils/session').jetonEstValide(payload))) throw new Error('révoqué');
      socket.userId = Number(payload.id);
      socket.tenantId = await resolveSocketTenant(socket.userId, socket.handshake.auth?.companyOwner);
      next();
    } catch (err) {
      next(new Error('Session invalide ou sélection d’entreprise non autorisée.'));
    }
  });

  io.on('connection', (socket) => {
    // La salle personnelle reste disponible ; un membre ou le propriétaire d'un groupe
    // rejoint le tenant sélectionné uniquement après validation de son accès actif.
    socket.join(`user:${socket.userId}`);
    if (socket.tenantId !== socket.userId) socket.join(`user:${socket.tenantId}`);
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

module.exports = { initSocket, closeSocket, notifierUtilisateur, resolveSocketTenant };
