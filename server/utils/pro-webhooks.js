const crypto = require('crypto');
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
          const secret = decryptSecret(row.secret_enc);
          const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
          const response = await fetch(row.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-SamaFacture-Event': row.evenement,
              'X-SamaFacture-Delivery': String(row.id),
              'X-SamaFacture-Signature': 'sha256=' + signature
            },
            body,
            signal: AbortSignal.timeout(10000)
          });
          statusCode = response.status;
          ok = response.ok;
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

module.exports = { encryptSecret, decryptSecret, queueWebhookEvent, deliverPendingWebhooks };
