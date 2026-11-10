const crypto = require('crypto');
const dns = require('node:dns').promises;
const net = require('node:net');
const https = require('node:https');
const { pool } = require('../config/db');

function encryptionKey() {
  const source = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!source) throw new Error('DATA_ENCRYPTION_KEY ou JWT_SECRET est requis pour chiffrer les secrets de webhooks.');
  return crypto.createHash('sha256').update(String(source) + '|samafacture-pro-webhooks').digest();
}

function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), ciphertext.toString('hex')].join(':');
}

function decryptSecret(value) {
  const parts = String(value || '').split(':');
  if (parts.length !== 3) throw new Error('Secret webhook illisible : format chiffré invalide.');
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const data = Buffer.from(parts[2], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

async function queueWebhookEvent(userId, eventName, payload) {
  const [hooks] = await pool.query('SELECT id, evenements_json FROM pro_webhooks WHERE user_id = ? AND actif = 1', [userId]);
  for (const hook of hooks) {
    let events = [];
    try { events = Array.isArray(hook.evenements_json) ? hook.evenements_json : JSON.parse(hook.evenements_json || '[]'); } catch (_) {}
    if (!events.includes(eventName)) continue;
    await pool.query(
      'INSERT INTO pro_webhook_deliveries (user_id, webhook_id, evenement, payload_json, prochaine_tentative) VALUES (?, ?, ?, ?, NOW())',
      [userId, hook.id, eventName, JSON.stringify(payload)]
    );
  }
}


function isPrivateAddress(address) {
  if (net.isIP(address) === 4) {
    const parts = address.split('.').map(Number);
    const [a,b] = parts;
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && parts[2] === 0) || (b === 0 && parts[2] === 2))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && parts[2] === 100))) ||
      (a === 203 && b === 0 && parts[2] === 113) || a >= 224;
  }
  if (net.isIP(address) === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice(7);
      if (net.isIP(mapped) === 4) return isPrivateAddress(mapped);
    }
    return normalized === '::' || normalized === '::1' ||
      normalized.startsWith('fc') || normalized.startsWith('fd') ||
      /^fe[89ab]/.test(normalized) || normalized.startsWith('ff');
  }
  return true;
}

async function resolvePublicWebhookTarget(rawUrl, lookup = dns.lookup) {
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch (_) {
    throw new Error('URL de webhook invalide.');
  }
  if (url.protocol !== 'https:' || (url.port && url.port !== '443')) {
    throw new Error('Les webhooks doivent utiliser HTTPS sur le port standard.');
  }
  if (url.username || url.password) {
    throw new Error('Les identifiants intégrés dans l’URL du webhook sont interdits.');
  }

  // URL.hostname peut conserver les crochets d'une adresse IPv6 littérale.
  const hostname = url.hostname.replace(/^\\[|\\]$/g, '').toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('La cible du webhook ne doit pas être locale.');
  }

  const literalFamily = net.isIP(hostname);
  let addresses;
  if (literalFamily) {
    addresses = [{ address: hostname, family: literalFamily }];
  } else {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  }

  if (!Array.isArray(addresses) || !addresses.length ||
      addresses.some(entry => !entry || isPrivateAddress(entry.address))) {
    throw new Error('Le domaine du webhook pointe vers une adresse non publique.');
  }

  // L'adresse retenue est renvoyée au transport HTTPS. La résolution DNS ne sera
  // donc pas répétée au moment de la connexion (protection contre le DNS rebinding).
  return {
    url,
    hostname,
    address: addresses[0].address,
    family: addresses[0].family || net.isIP(addresses[0].address)
  };
}

function createPinnedLookup(address, family) {
  return function pinnedLookup(_hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    const entry = { address, family };
    if (options && options.all) return callback(null, [entry]);
    return callback(null, address, family);
  };
}

function sendWebhookRequest(target, headers, body) {
  return new Promise((resolve, reject) => {
    const request = https.request(target.url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(body)
      },
      // On conserve le nom de domaine de l'URL pour le Host et la vérification TLS,
      // mais la socket utilise exclusivement l'IP publique déjà contrôlée.
      lookup: createPinnedLookup(target.address, target.family),
      signal: AbortSignal.timeout(10000)
    }, response => {
      const statusCode = response.statusCode || 0;
      response.once('error', reject);
      response.once('end', () => resolve({ statusCode }));
      response.resume();
    });
    request.once('error', reject);
    request.end(body);
  });
}

async function deliverPendingWebhooks() {
  const conn = await pool.getConnection();
  try {
    const [[lock]] = await conn.query("SELECT GET_LOCK('samafacture:pro-webhooks', 0) AS acquired");
    if (lock.acquired !== 1) return 0;
    try {
      const [rows] = await pool.query(
        "SELECT d.*, w.url, w.secret_enc FROM pro_webhook_deliveries d JOIN pro_webhooks w ON w.id = d.webhook_id WHERE d.statut = 'en_attente' AND (d.prochaine_tentative IS NULL OR d.prochaine_tentative <= NOW()) AND w.actif = 1 ORDER BY d.id ASC LIMIT 25"
      );
      let delivered = 0;
      for (const row of rows) {
        const body = JSON.stringify({
          id: row.id,
          event: row.evenement,
          created_at: row.created_at,
          data: (() => { try { return JSON.parse(row.payload_json); } catch (_) { return {}; } })()
        });
        const attempt = Number(row.tentatives || 0) + 1;
        let statusCode = null;
        let ok = false;
        try {
          const target = await resolvePublicWebhookTarget(row.url);
          const secret = decryptSecret(row.secret_enc);
          const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
          const response = await sendWebhookRequest(target, {
            'Content-Type': 'application/json',
            'X-SamaFacture-Event': row.evenement,
            'X-SamaFacture-Delivery': String(row.id),
            'X-SamaFacture-Signature': 'sha256=' + signature
          }, body);
          statusCode = response.statusCode;
          ok = statusCode >= 200 && statusCode < 300;
        } catch (err) {
          console.warn('Livraison webhook #' + row.id + ' impossible :', err.message);
        }
        if (ok) {
          await pool.query("UPDATE pro_webhook_deliveries SET statut = 'livre', tentatives = ?, http_status = ?, delivered_at = NOW(), prochaine_tentative = NULL WHERE id = ?", [attempt, statusCode, row.id]);
          delivered++;
        } else if (attempt >= 5) {
          await pool.query("UPDATE pro_webhook_deliveries SET statut = 'echec', tentatives = ?, http_status = ?, prochaine_tentative = NULL WHERE id = ?", [attempt, statusCode, row.id]);
        } else {
          const delayMinutes = [1, 5, 30, 120, 360][attempt - 1] || 360;
          await pool.query("UPDATE pro_webhook_deliveries SET tentatives = ?, http_status = ?, prochaine_tentative = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?", [attempt, statusCode, delayMinutes, row.id]);
        }
      }
      return delivered;
    } finally {
      await conn.query("SELECT RELEASE_LOCK('samafacture:pro-webhooks')").catch(() => {});
    }
  } finally {
    conn.release();
  }
}

module.exports = { encryptSecret, decryptSecret, queueWebhookEvent, deliverPendingWebhooks, isPrivateAddress, resolvePublicWebhookTarget, createPinnedLookup, sendWebhookRequest };
