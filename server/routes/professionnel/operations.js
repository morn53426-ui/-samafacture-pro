const { SUPPORTED_CURRENCIES } = require('../../config/localization');
const { creerFacturePaydunya, creerSessionWave, paydunyaConfigured, waveConfigured } = require('../../config/payments');
const crypto = require('crypto');
const { decryptSecret, encryptSecret } = require('../../utils/pro-webhooks');
const { localDateString } = require('../../utils/local-date');
const net = require('net');
const { pool } = require('../../config/db');
const {
  actor,
  audit,
  clientOwned,
  ensureDefaultWarehouse,
  idOk,
  invoiceOwned,
  lireGateway,
  optionalText,
  owner,
  parseJson,
  randomRef,
  safeDateForUser
} = require('./shared');

module.exports = function registerOperationsRoutes(router) {
/* ---------------------------- DOCUMENTS -------------------------------- */
router.get('/documents', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, facture_id, client_id, nom_fichier, mime_type, taille_octets, signature_nom, signature_hash, signed_at, created_at FROM pro_documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 300', [owner(req)]);
    res.json({ documents: rows });
  } catch (err) { next(err); }
});
router.post('/documents', async (req, res, next) => {
  try {
    const uid = owner(req), name = String(req.body.nom_fichier || '').trim().slice(0, 255);
    const mime = String(req.body.mime_type || '').toLowerCase();
    const allowed = ['application/pdf','image/jpeg','image/png'];
    const raw = String(req.body.contenu_base64 || '').replace(/^data:[^,]+,/, '');
    if (!name || !allowed.includes(mime) || !raw) return res.status(400).json({ error: 'Nom, type PDF/JPEG/PNG et contenu requis.' });
    const content = Buffer.from(raw, 'base64');
    if (!content.length || content.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Le document doit peser moins de 5 Mo.' });
    const isPdf = mime === 'application/pdf' && content.subarray(0, 5).toString('ascii') === '%PDF-';
    const isPng = mime === 'image/png' && content.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
    const isJpeg = mime === 'image/jpeg' && content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
    if (!isPdf && !isPng && !isJpeg) return res.status(400).json({ error: 'Le contenu du fichier ne correspond pas à son type PDF/JPEG/PNG déclaré.' });
    if (req.body.facture_id && !await invoiceOwned(uid, Number(req.body.facture_id))) return res.status(404).json({ error: 'Facture introuvable.' });
    if (req.body.client_id && !await clientOwned(uid, Number(req.body.client_id))) return res.status(404).json({ error: 'Client introuvable.' });
    const [result] = await pool.query('INSERT INTO pro_documents (user_id, facture_id, client_id, nom_fichier, mime_type, taille_octets, contenu) VALUES (?, ?, ?, ?, ?, ?, ?)', [uid, req.body.facture_id || null, req.body.client_id || null, name, mime, content.length, content]);
    await audit(req, 'document.archive', 'document', result.insertId, { nom_fichier: name, taille: content.length });
    res.status(201).json({ id: result.insertId, nom_fichier: name, taille_octets: content.length });
  } catch (err) { next(err); }
});
router.get('/documents/:id/download', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT nom_fichier, mime_type, contenu FROM pro_documents WHERE id = ? AND user_id = ?', [req.params.id, owner(req)]);
    if (!rows.length) return res.status(404).json({ error: 'Document introuvable.' });
    res.setHeader('Content-Type', rows[0].mime_type);
    res.setHeader('Content-Disposition', 'attachment; filename="' + rows[0].nom_fichier.replace(/["\\\r\n]/g, '_') + '"');
    res.send(rows[0].contenu);
  } catch (err) { next(err); }
});
router.post('/documents/:id/signature', async (req, res, next) => {
  try {
    const nom = String(req.body.nom || '').trim().slice(0, 190);
    const data = String(req.body.signature_data || '');
    if (!nom || !/^data:image\/(png|jpeg);base64,/.test(data) || data.length > 700000) return res.status(400).json({ error: 'Nom du signataire et signature PNG/JPEG valides requis.' });
    const signatureBytes = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
    const signaturePng = data.startsWith('data:image/png;') && signatureBytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
    const signatureJpeg = data.startsWith('data:image/jpeg;') && signatureBytes.length >= 3 && signatureBytes[0] === 0xff && signatureBytes[1] === 0xd8 && signatureBytes[2] === 0xff;
    if (!signaturePng && !signatureJpeg) return res.status(400).json({ error: 'La signature image ne possède pas un contenu PNG/JPEG valide.' });
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    const [result] = await pool.query('UPDATE pro_documents SET signature_nom = ?, signature_data = ?, signature_hash = ?, signed_at = NOW() WHERE id = ? AND user_id = ?', [nom, data, hash, req.params.id, owner(req)]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Document introuvable.' });
    await audit(req, 'document.signe', 'document', req.params.id, { signataire: nom, signature_hash: hash });
    res.json({ success: true, signature_hash: hash, signed_at: new Date().toISOString(), niveau: 'signature interne simple — ne constitue pas une signature qualifiée' });
  } catch (err) { next(err); }
});

/* ---------------------- RAPPORTS / ANALYSES ----------------------------- */
router.get('/reports/margins', async (req, res, next) => {
  try {
    const params = [owner(req)];
    let dateClause = '';
    if (req.query.from && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)) { dateClause += ' AND f.date_emission >= ?'; params.push(req.query.from); }
    if (req.query.to && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) { dateClause += ' AND f.date_emission <= ?'; params.push(req.query.to); }
    const [rows] = await pool.query(
      'SELECT fl.produit_id, fl.designation, SUM(fl.quantite) AS quantite, SUM(fl.quantite * fl.prix_unitaire) AS chiffre_affaires_ht, SUM(fl.quantite * COALESCE(p.prix_achat,0)) AS cout_estime, SUM(fl.quantite * (fl.prix_unitaire - COALESCE(p.prix_achat,0))) AS marge_estimee, SUM(CASE WHEN p.id IS NULL OR p.prix_achat = 0 THEN 1 ELSE 0 END) AS lignes_sans_cout FROM facture_lignes fl JOIN factures f ON f.id = fl.facture_id LEFT JOIN produits p ON p.id = fl.produit_id AND p.user_id = f.user_id WHERE f.user_id = ? AND f.type = ? AND f.statut != ?' + dateClause + ' GROUP BY fl.produit_id, fl.designation ORDER BY marge_estimee DESC LIMIT 250',
      [...params, 'facture', 'annulee']
    );
    const data = rows.map(r => ({ ...r, marge_estimee: Number(r.marge_estimee || 0), chiffre_affaires_ht: Number(r.chiffre_affaires_ht || 0), cout_estime: Number(r.cout_estime || 0), marge_pourcent: Number(r.chiffre_affaires_ht) > 0 ? Number(r.marge_estimee) / Number(r.chiffre_affaires_ht) * 100 : null }));
    res.json({ marges: data, avertissement: 'Les marges sont estimatives : renseignez le prix d’achat de chaque produit. Les frais indirects et coûts de service ne sont pas inclus.' });
  } catch (err) { next(err); }
});

router.get('/reports/forecast', async (req, res, next) => {
  try {
    const userId = owner(req);
    const [accounts] = await pool.query(
      'SELECT fuseau_horaire FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const localToday = localDateString(accounts?.[0]?.fuseau_horaire || 'Africa/Dakar');
    const [rows] = await pool.query(
      "SELECT DATE_FORMAT(p.date_paiement, '%Y-%m') AS mois, SUM(p.montant) AS encaissements, COUNT(*) AS nb_paiements FROM paiements p JOIN factures f ON f.id = p.facture_id AND f.user_id = p.user_id WHERE p.user_id = ? AND f.type = 'facture' AND f.statut != 'annulee' AND p.date_paiement >= DATE_SUB(?, INTERVAL 6 MONTH) GROUP BY mois ORDER BY mois",
      [userId, localToday]
    );
    const monthlyAverage = rows.length ? rows.reduce((s, r) => s + Number(r.encaissements || 0), 0) / 6 : 0;
    const [yearPart, monthPart] = localToday.slice(0, 7).split('-').map(Number);
    const forecast = [1, 2, 3].map(i => {
      const monthIndex = yearPart * 12 + monthPart - 1 + i;
      const year = Math.floor(monthIndex / 12);
      const month = String(monthIndex % 12 + 1).padStart(2, '0');
      return { mois: year + '-' + month, encaissements_estimes: Math.round(monthlyAverage * 100) / 100 };
    });
    res.json({ historique: rows, moyenne_mensuelle_6_mois: monthlyAverage, previsions: forecast, methode: 'Moyenne simple des encaissements des six derniers mois, sans saisonnalité ni correction statistique.' });
  } catch (err) { next(err); }
});
router.get('/reports/custom', async (req, res, next) => {
  try {
    const group = ['day','month','client'].includes(req.query.group_by) ? req.query.group_by : 'month';
    const dateExpr = group === 'day' ? 'f.date_emission' : group === 'client' ? 'c.nom' : "DATE_FORMAT(f.date_emission, '%Y-%m')";
    const params = [owner(req), 'facture'];
    let where = '';
    if (req.query.from && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)) { where += ' AND f.date_emission >= ?'; params.push(req.query.from); }
    if (req.query.to && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) { where += ' AND f.date_emission <= ?'; params.push(req.query.to); }
    if (idOk(req.query.client_id)) { where += ' AND f.client_id = ?'; params.push(Number(req.query.client_id)); }
    const [rows] = await pool.query('SELECT ' + dateExpr + ' AS label, COUNT(*) AS nb_factures, SUM(f.total) AS total, SUM(f.montant_paye) AS encaisse FROM factures f JOIN clients c ON c.id = f.client_id AND c.user_id = f.user_id WHERE f.user_id = ? AND f.type = ? AND f.statut != ?' + where + ' GROUP BY label ORDER BY label', [params[0], params[1], 'annulee', ...params.slice(2)]);
    res.json({ groupe: group, rows });
  } catch (err) { next(err); }
});

/* -------------------------- AUTOMATISATIONS ----------------------------- */
router.get('/automations', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pro_automations WHERE user_id = ? ORDER BY created_at DESC', [owner(req)]);
    res.json({ automatisations: rows.map(r => ({ ...r, configuration: parseJson(r.configuration_json, {}) })) });
  } catch (err) { next(err); }
});
router.post('/automations', async (req, res, next) => {
  try {
    const type = String(req.body.type || '');
    const allowed = ['relance_impayes_email','relance_impayes_whatsapp','relance_devis_email','alerte_stock_email'];
    const nom = String(req.body.nom || '').trim().slice(0, 150);
    const config = req.body.configuration && typeof req.body.configuration === 'object' ? req.body.configuration : {};
    if (!allowed.includes(type) || !nom) return res.status(400).json({ error: 'Type ou nom d’automatisation invalide.' });
    if (type === 'relance_impayes_whatsapp') return res.status(501).json({ error: 'L’envoi WhatsApp automatique exige un fournisseur WhatsApp Business configuré. Le canal email reste disponible.' });

    let normalized;
    if (type === 'relance_impayes_email') {
      normalized = {
        jours_retard: Math.min(120, Math.max(1, Number(config.jours_retard) || 7)),
        frequence_jours: Math.min(90, Math.max(1, Number(config.frequence_jours) || 7)),
        canal: 'email'
      };
    } else if (type === 'relance_devis_email') {
      normalized = {
        jours_avant_expiration: Math.min(30, Math.max(0, Number(config.jours_avant_expiration ?? 5))),
        frequence_jours: Math.min(90, Math.max(1, Number(config.frequence_jours) || 3)),
        canal: 'email'
      };
    } else {
      normalized = {
        frequence_jours: Math.min(30, Math.max(1, Number(config.frequence_jours) || 1)),
        canal: 'email',
        utiliser_seuils_produits: true
      };
    }
    const [result] = await pool.query(
      'INSERT INTO pro_automations (user_id, type, nom, configuration_json, prochaine_execution) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))',
      [owner(req), type, nom, JSON.stringify(normalized)]
    );
    await audit(req, 'automatisation.creee', 'automatisation', result.insertId, { type, configuration: normalized });
    res.status(201).json({ id: result.insertId, type, prochaine_execution: 'dans environ une heure' });
  } catch (err) { next(err); }
});
router.put('/automations/:id', async (req, res, next) => {
  try {
    const active = req.body.actif ? 1 : 0;
    const [result] = await pool.query('UPDATE pro_automations SET actif = ?, prochaine_execution = CASE WHEN ? = 1 THEN COALESCE(prochaine_execution, DATE_ADD(NOW(), INTERVAL 1 HOUR)) ELSE NULL END WHERE id = ? AND user_id = ?', [active, active, req.params.id, owner(req)]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Automatisation introuvable.' });
    await audit(req, 'automatisation.modifiee', 'automatisation', req.params.id, { actif: !!active });
    res.json({ success: true, actif: !!active });
  } catch (err) { next(err); }
});
router.delete('/automations/:id', async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM pro_automations WHERE id = ? AND user_id = ?', [req.params.id, owner(req)]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Automatisation introuvable.' });
    await audit(req, 'automatisation.supprimee', 'automatisation', req.params.id, {});
    res.json({ success: true });
  } catch (err) { next(err); }
});

/* ------------------------- INTÉGRATIONS --------------------------------- */
router.get('/integrations/api-keys', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, nom, scopes_json, derniere_utilisation, expire_at, revoked_at, created_at FROM pro_api_keys WHERE user_id = ? ORDER BY created_at DESC', [owner(req)]);
    res.json({ cles: rows.map(r => ({ ...r, scopes: parseJson(r.scopes_json, []) })) });
  } catch (err) { next(err); }
});
router.post('/integrations/api-keys', async (req, res, next) => {
  try {
    const nom = String(req.body.nom || '').trim().slice(0, 120);
    const available = ['clients:read','products:read','invoices:read','invoices:write'];
    const scopes = Array.isArray(req.body.scopes) ? [...new Set(req.body.scopes.filter(s => available.includes(s)))] : ['invoices:read'];
    if (!nom || !scopes.length) return res.status(400).json({ error: 'Nom et permissions API valides requis.' });
    const token = 'sf_live_' + crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = req.body.expire_jours ? new Date(Date.now() + Math.min(365, Math.max(1, Number(req.body.expire_jours))) * 86400000) : null;
    const [result] = await pool.query('INSERT INTO pro_api_keys (user_id, nom, token_hash, scopes_json, expire_at) VALUES (?, ?, ?, ?, ?)', [owner(req), nom, tokenHash, JSON.stringify(scopes), expires]);
    await audit(req, 'api.cle_creee', 'api_key', result.insertId, { nom, scopes });
    res.status(201).json({ id: result.insertId, nom, token, scopes, warning: 'Copiez cette clé maintenant : elle ne sera plus affichée.' });
  } catch (err) { next(err); }
});
router.delete('/integrations/api-keys/:id', async (req, res, next) => {
  try {
    const [result] = await pool.query('UPDATE pro_api_keys SET revoked_at = NOW() WHERE id = ? AND user_id = ? AND revoked_at IS NULL', [req.params.id, owner(req)]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Clé API introuvable ou déjà révoquée.' });
    await audit(req, 'api.cle_revoquee', 'api_key', req.params.id, {});
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/integrations/webhooks', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, url, evenements_json, actif, created_at FROM pro_webhooks WHERE user_id = ? ORDER BY created_at DESC', [owner(req)]);
    res.json({ webhooks: rows.map(r => ({ ...r, evenements: parseJson(r.evenements_json, []) })) });
  } catch (err) { next(err); }
});
router.post('/integrations/webhooks', async (req, res, next) => {
  try {
    const url = String(req.body.url || '').trim();
    let parsed;
    try { parsed = new URL(url); } catch (_) { return res.status(400).json({ error: 'URL de webhook invalide.' }); }
    if (parsed.protocol !== 'https:' || (parsed.port && parsed.port !== '443')) return res.status(400).json({ error: 'Les webhooks doivent utiliser HTTPS sur le port standard.' });
    const host = parsed.hostname.toLowerCase();
    const literalIp = net.isIP(host);
    const privateIpv4 = literalIp === 4 && (/^(10|127|0)\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host));
    const privateIpv6 = literalIp === 6 && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80'));
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || privateIpv4 || privateIpv6) {
      return res.status(400).json({ error: 'Les webhooks ne peuvent pas cibler un hôte local ou une adresse IP privée.' });
    }
    const allowedEvents = ['invoice.created','payment.received','client.created'];
    const events = Array.isArray(req.body.evenements) ? [...new Set(req.body.evenements.filter(x => allowedEvents.includes(x)))] : [];
    if (!events.length) return res.status(400).json({ error: 'Sélectionnez au moins un événement valide.' });
    const secret = crypto.randomBytes(32).toString('hex');
    const [result] = await pool.query('INSERT INTO pro_webhooks (user_id, url, secret_enc, evenements_json) VALUES (?, ?, ?, ?)', [owner(req), url, encryptSecret(secret), JSON.stringify(events)]);
    await audit(req, 'webhook.cree', 'webhook', result.insertId, { url, events });
    res.status(201).json({ id: result.insertId, url, evenements: events, secret, warning: 'Conservez le secret : il ne sera pas réaffiché.' });
  } catch (err) { next(err); }
});
router.delete('/integrations/webhooks/:id', async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM pro_webhooks WHERE id = ? AND user_id = ?', [req.params.id, owner(req)]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Webhook introuvable.' });
    await audit(req, 'webhook.supprime', 'webhook', req.params.id, {});
    res.json({ success: true });
  } catch (err) { next(err); }
});
router.post('/integrations/webhooks/:id/test', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id FROM pro_webhooks WHERE id = ? AND user_id = ? AND actif = 1', [req.params.id, owner(req)]);
    if (!rows.length) return res.status(404).json({ error: 'Webhook introuvable ou inactif.' });
    const [result] = await pool.query('INSERT INTO pro_webhook_deliveries (user_id, webhook_id, evenement, payload_json, prochaine_tentative) VALUES (?, ?, ?, ?, NOW())', [owner(req), req.params.id, 'test.ping', JSON.stringify({ test: true, date: new Date().toISOString() })]);
    res.status(202).json({ success: true, delivery_id: result.insertId, message: 'Test placé dans la file de livraison.' });
  } catch (err) { next(err); }
});

router.get('/audit', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, acteur_user_id, action, entite, entite_id, details_json, adresse_ip, created_at FROM pro_audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 300', [owner(req)]);
    res.json({ journal: rows.map(r => ({ ...r, details: parseJson(r.details_json, null) })) });
  } catch (err) { next(err); }
});

router.get('/payment-gateways', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT fournisseur, mode, actif, updated_at FROM pro_payment_gateways WHERE user_id = ? ORDER BY fournisseur',
      [owner(req)]
    );
    res.json({
      gateways: rows.map(row => ({ ...row, configured: true })),
      encryption_ready: Boolean(process.env.DATA_ENCRYPTION_KEY),
      warning: 'Chaque entreprise doit utiliser ses propres identifiants marchands. Les clés d’abonnement SamaFacture ne sont jamais réutilisées pour encaisser les factures clients.'
    });
  } catch (err) { next(err); }
});

router.put('/payment-gateways/:provider', async (req, res, next) => {
  try {
    const uid = owner(req), provider = String(req.params.provider || '').toLowerCase();
    if (!['wave', 'paydunya'].includes(provider)) return res.status(400).json({ error: 'Prestataire non pris en charge.' });
    if (!process.env.DATA_ENCRYPTION_KEY) return res.status(503).json({ error: 'DATA_ENCRYPTION_KEY doit être configurée avant d’enregistrer des clés marchandes.' });

    const [existingRows] = await pool.query(
      'SELECT credentials_enc, mode FROM pro_payment_gateways WHERE user_id = ? AND fournisseur = ? LIMIT 1',
      [uid, provider]
    );
    let credentials = existingRows.length ? JSON.parse(decryptSecret(existingRows[0].credentials_enc)) : {};
    if (provider === 'wave') {
      const apiKey = String(req.body.api_key || '').trim();
      const signingSecret = String(req.body.signing_secret || '').trim();
      if (apiKey) credentials.WAVE_API_KEY = apiKey;
      if (signingSecret) credentials.WAVE_SIGNING_SECRET = signingSecret;
      if (!credentials.WAVE_API_KEY || !credentials.WAVE_SIGNING_SECRET) {
        return res.status(400).json({ error: 'La clé API Wave et le secret de signature de webhook sont obligatoires.' });
      }
      if (credentials.WAVE_API_KEY.length < 12 || credentials.WAVE_SIGNING_SECRET.length < 12) {
        return res.status(400).json({ error: 'Les identifiants Wave semblent incomplets.' });
      }
    } else {
      const master = String(req.body.master_key || '').trim();
      const privateKey = String(req.body.private_key || '').trim();
      const token = String(req.body.token || '').trim();
      if (master) credentials.PAYDUNYA_MASTER_KEY = master;
      if (privateKey) credentials.PAYDUNYA_PRIVATE_KEY = privateKey;
      if (token) credentials.PAYDUNYA_TOKEN = token;
      if (!credentials.PAYDUNYA_MASTER_KEY || !credentials.PAYDUNYA_PRIVATE_KEY || !credentials.PAYDUNYA_TOKEN) {
        return res.status(400).json({ error: 'Les trois clés PayDunya sont obligatoires.' });
      }
      if ([credentials.PAYDUNYA_MASTER_KEY, credentials.PAYDUNYA_PRIVATE_KEY, credentials.PAYDUNYA_TOKEN].some(value => String(value).length < 8)) {
        return res.status(400).json({ error: 'Les identifiants PayDunya semblent incomplets.' });
      }
    }

    const mode = provider === 'paydunya' ? String(req.body.mode || existingRows[0]?.mode || 'test') : 'live';
    if (provider === 'paydunya' && !['test', 'live'].includes(mode)) return res.status(400).json({ error: 'Mode PayDunya invalide.' });
    await pool.query(
      'INSERT INTO pro_payment_gateways (user_id, fournisseur, credentials_enc, mode, actif) VALUES (?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE credentials_enc = VALUES(credentials_enc), mode = VALUES(mode), actif = 1',
      [uid, provider, encryptSecret(JSON.stringify(credentials)), mode]
    );
    await audit(req, 'paiement.prestataire_configure', 'prestataire', provider, { mode });
    res.json({ success: true, fournisseur: provider, mode, credentials_masked: true });
  } catch (err) { next(err); }
});

router.post('/invoices/:invoiceId/checkout', async (req, res, next) => {
  try {
    const uid = owner(req), provider = String(req.body.fournisseur || '').toLowerCase();
    if (!['wave', 'paydunya'].includes(provider)) return res.status(400).json({ error: 'Choisissez Wave ou PayDunya.' });
    const credentials = await lireGateway(uid, provider);
    if (!credentials || (provider === 'wave' ? !waveConfigured(credentials) : !paydunyaConfigured(credentials))) {
      return res.status(409).json({ error: 'Ce prestataire n’est pas configuré pour cette entreprise. Renseignez d’abord ses clés marchandes.' });
    }
    const [rows] = await pool.query(
      "SELECT f.id, f.numero, f.total, f.montant_paye, f.statut, f.type, u.entreprise_nom, u.devise FROM factures f JOIN users u ON u.id = f.user_id WHERE f.id = ? AND f.user_id = ? LIMIT 1",
      [req.params.invoiceId, uid]
    );
    const invoice = rows[0];
    if (!invoice || invoice.type !== 'facture') return res.status(404).json({ error: 'Facture introuvable.' });
    if (invoice.statut === 'annulee') return res.status(409).json({ error: 'Une facture annulée ne peut pas être payée.' });
    const remaining = Math.round((Number(invoice.total) - Number(invoice.montant_paye)) * 100) / 100;
    if (!Number.isFinite(remaining) || remaining <= 0) return res.status(409).json({ error: 'Cette facture est déjà soldée.' });
    // Wave et PayDunya règlent ici en XOF, devise sans sous-unité. Refuser un solde
    // fractionnaire plutôt que de créer un lien arrondi qui pourrait encaisser un autre montant.
    if (invoice.devise && invoice.devise !== 'FCFA' && invoice.devise !== 'XOF') {
      return res.status(409).json({ error: 'Les paiements en ligne ne sont activés que pour les factures en XOF/FCFA.' });
    }
    if (Math.abs(remaining - Math.round(remaining)) > 0.001) {
      return res.status(409).json({ error: 'Le solde XOF doit être un montant entier avant de créer un lien Wave ou PayDunya.' });
    }

    const base = String(process.env.APP_URL || '').replace(/\/$/, '');
    if (!base || !base.startsWith('https://')) return res.status(503).json({ error: 'APP_URL doit être une URL publique HTTPS pour activer le paiement en ligne.' });
    const reference = crypto.randomBytes(32).toString('hex');
    const [inserted] = await pool.query(
      "INSERT INTO pro_invoice_checkouts (user_id, facture_id, fournisseur, reference_interne, montant, devise, statut, expire_at) VALUES (?, ?, ?, ?, ?, 'XOF', 'creation', DATE_ADD(NOW(), INTERVAL 30 MINUTE))",
      [uid, invoice.id, provider, reference, remaining]
    );
    const returnUrl = base + '/paiement-retour.html?reference=' + encodeURIComponent(reference);
    try {
      let checkoutUrl, providerRef;
      if (provider === 'wave') {
        const session = await creerSessionWave({
          amount: remaining, reference, successUrl: returnUrl, errorUrl: returnUrl, credentials
        });
        checkoutUrl = session.checkoutUrl;
        providerRef = session.sessionId;
      } else {
        const created = await creerFacturePaydunya({
          amount: remaining,
          description: 'Facture ' + invoice.numero,
          reference,
          storeName: invoice.entreprise_nom || 'SamaFacture Pro',
          returnUrl,
          cancelUrl: returnUrl,
          callbackUrl: base + '/api/payment-webhooks/paydunya',
          credentials
        });
        checkoutUrl = created.checkoutUrl;
        providerRef = created.token;
      }
      if (!checkoutUrl || !providerRef) throw new Error('Le prestataire n’a pas retourné une session de paiement valide.');
      await pool.query(
        "UPDATE pro_invoice_checkouts SET reference_prestataire = ?, checkout_url = ?, statut = 'en_attente' WHERE id = ? AND user_id = ?",
        [String(providerRef), checkoutUrl, inserted.insertId, uid]
      );
      await audit(req, 'paiement.checkout_cree', 'facture', invoice.id, { fournisseur: provider, montant: remaining, reference_interne: reference });
      res.status(201).json({ checkout_url: checkoutUrl, reference, fournisseur: provider, montant: remaining, devise: 'XOF', expires_in_minutes: 30 });
    } catch (providerError) {
      await pool.query("UPDATE pro_invoice_checkouts SET statut = 'echec' WHERE id = ? AND user_id = ?", [inserted.insertId, uid]);
      throw providerError;
    }
  } catch (err) {
    if (/Impossible|prestataire|Wave|PayDunya|session/i.test(err.message || '')) return res.status(502).json({ error: err.message });
    next(err);
  }
});

router.get('/checkouts/:reference/status', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT c.statut, c.montant, c.devise, c.fournisseur, c.created_at, c.paid_at, f.numero AS facture_numero FROM pro_invoice_checkouts c JOIN factures f ON f.id = c.facture_id AND f.user_id = c.user_id WHERE c.reference_interne = ? AND c.user_id = ? LIMIT 1',
      [req.params.reference, owner(req)]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session de paiement introuvable.' });
    res.json({ checkout: rows[0] });
  } catch (err) { next(err); }
});

router.get('/suppliers', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, nom, email, telephone, adresse, ninea, notes, actif, created_at FROM pro_fournisseurs WHERE user_id = ? ORDER BY nom LIMIT 500', [owner(req)]);
    res.json({ fournisseurs: rows });
  } catch (err) { next(err); }
});

router.post('/suppliers', async (req, res, next) => {
  try {
    const nom = String(req.body.nom || '').trim().slice(0, 190);
    if (!nom) return res.status(400).json({ error: 'Le nom du fournisseur est obligatoire.' });
    const [result] = await pool.query(
      'INSERT INTO pro_fournisseurs (user_id, nom, email, telephone, adresse, ninea, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [owner(req), nom, optionalText(req.body.email, 190), optionalText(req.body.telephone, 40), optionalText(req.body.adresse, 255), optionalText(req.body.ninea, 60), optionalText(req.body.notes, 5000)]
    );
    await audit(req, 'achat.fournisseur_cree', 'fournisseur', result.insertId, { nom });
    res.status(201).json({ id: result.insertId, nom });
  } catch (err) { next(err); }
});

router.put('/suppliers/:id', async (req, res, next) => {
  try {
    const nom = String(req.body.nom || '').trim().slice(0, 190);
    if (!nom) return res.status(400).json({ error: 'Le nom du fournisseur est obligatoire.' });
    const [result] = await pool.query(
      'UPDATE pro_fournisseurs SET nom = ?, email = ?, telephone = ?, adresse = ?, ninea = ?, notes = ?, actif = ? WHERE id = ? AND user_id = ?',
      [nom, optionalText(req.body.email, 190), optionalText(req.body.telephone, 40), optionalText(req.body.adresse, 255), optionalText(req.body.ninea, 60), optionalText(req.body.notes, 5000), req.body.actif === false ? 0 : 1, req.params.id, owner(req)]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Fournisseur introuvable.' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/warehouses', async (req, res, next) => {
  try {
    await ensureDefaultWarehouse(owner(req));
    const [rows] = await pool.query('SELECT id, code, nom, adresse, par_defaut, actif FROM pro_entrepots WHERE user_id = ? ORDER BY par_defaut DESC, nom', [owner(req)]);
    res.json({ entrepots: rows });
  } catch (err) { next(err); }
});

router.post('/warehouses', async (req, res, next) => {
  try {
    await ensureDefaultWarehouse(owner(req));
    const code = String(req.body.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
    const nom = String(req.body.nom || '').trim().slice(0, 120);
    if (!code || !nom) return res.status(400).json({ error: 'Code et nom de l’entrepôt obligatoires.' });
    const [result] = await pool.query(
      'INSERT INTO pro_entrepots (user_id, code, nom, adresse, par_defaut) VALUES (?, ?, ?, ?, 0)',
      [owner(req), code, nom, optionalText(req.body.adresse, 255)]
    );
    res.status(201).json({ id: result.insertId, code, nom });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ce code d’entrepôt existe déjà.' });
    next(err);
  }
});

router.get('/purchase-orders', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT o.*, s.nom AS fournisseur_nom FROM pro_commandes_fournisseurs o JOIN pro_fournisseurs s ON s.id = o.fournisseur_id AND s.user_id = o.user_id WHERE o.user_id = ? ORDER BY o.date_commande DESC, o.id DESC LIMIT 250',
      [owner(req)]
    );
    res.json({ commandes: rows });
  } catch (err) { next(err); }
});

router.get('/purchase-orders/:id', async (req, res, next) => {
  try {
    const [orders] = await pool.query(
      'SELECT o.*, s.nom AS fournisseur_nom FROM pro_commandes_fournisseurs o JOIN pro_fournisseurs s ON s.id = o.fournisseur_id AND s.user_id = o.user_id WHERE o.id = ? AND o.user_id = ?',
      [req.params.id, owner(req)]
    );
    if (!orders.length) return res.status(404).json({ error: 'Commande fournisseur introuvable.' });
    const [lines] = await pool.query('SELECT * FROM pro_commandes_fournisseurs_lignes WHERE commande_id = ? AND user_id = ? ORDER BY id', [req.params.id, owner(req)]);
    res.json({ commande: orders[0], lignes: lines });
  } catch (err) { next(err); }
});

router.post('/purchase-orders', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req), supplierId = Number(req.body.fournisseur_id), lines = Array.isArray(req.body.lignes) ? req.body.lignes : [];
    if (!idOk(supplierId) || !lines.length || lines.length > 100) return res.status(400).json({ error: 'Fournisseur et 1 à 100 lignes obligatoires.' });
    let totalHt = 0, totalTax = 0;
    const normalized = [];
    const productIds = [];
    for (const line of lines) {
      const designation = String(line.designation || '').trim().slice(0, 255);
      const rawProductId = line.produit_id;
      const productId = rawProductId === undefined || rawProductId === null || rawProductId === '' ? null : Number(rawProductId);
      if (productId !== null && (!Number.isSafeInteger(productId) || productId <= 0)) {
        return res.status(400).json({ error: 'Le produit associé à une ligne de commande est invalide.' });
      }
      if (productId !== null) productIds.push(productId);
      const qty = Math.round(Number(line.quantite) * 1000) / 1000, price = Math.round(Number(line.prix_unitaire) * 100) / 100, tax = Math.round(Number(line.tva || 0) * 100) / 100;
      if (!designation || !Number.isFinite(qty) || qty <= 0 || qty > 10000000 || !Number.isFinite(price) || price < 0 || !Number.isFinite(tax) || tax < 0 || tax > 100) {
        return res.status(400).json({ error: 'Chaque ligne doit avoir une désignation, une quantité, un prix et une TVA valides.' });
      }
      const ht = Math.round(qty * price * 100) / 100;
      const vat = Math.round(ht * tax) / 100;
      totalHt += ht; totalTax += vat;
      normalized.push({ produit_id: productId, designation, qty, price, tax, total: ht + vat });
    }
    totalHt = Math.round(totalHt * 100) / 100;
    totalTax = Math.round(totalTax * 100) / 100;
    const uniqueProductIds = [...new Set(productIds)].sort((a, b) => a - b);
    const numero = randomRef('ACH');
    conn = await pool.getConnection();
    await conn.beginTransaction();
    // Verrou partagé avec les paramètres de devise : un changement de devise ne
    // peut pas passer entre la lecture du compte et l'insertion de l'achat.
    const [[company]] = await conn.query('SELECT devise FROM users WHERE id = ? FOR UPDATE', [uid]);
    if (!company) {
      await conn.rollback();
      return res.status(404).json({ error: 'Entreprise introuvable.' });
    }
    const companyCurrency = String(company.devise || 'FCFA').toUpperCase();
    const orderCurrency = String(req.body.devise || companyCurrency).toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(orderCurrency)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Devise de commande fournisseur non prise en charge.' });
    }
    if (orderCurrency !== companyCurrency) {
      await conn.rollback();
      return res.status(409).json({ error: 'La devise de la commande doit correspondre à la devise de base de l’entreprise. Les conversions ne sont pas encore activées.' });
    }
    const [[supplier]] = await conn.query('SELECT id FROM pro_fournisseurs WHERE id = ? AND user_id = ? AND actif = 1', [supplierId, uid]);
    if (!supplier) {
      await conn.rollback();
      return res.status(400).json({ error: 'Fournisseur inconnu ou inactif.' });
    }
    if (uniqueProductIds.length) {
      const [owned] = await conn.query(
        `SELECT id, type_catalogue FROM produits
         WHERE user_id = ? AND id IN (${uniqueProductIds.map(() => '?').join(',')})
         ORDER BY id FOR UPDATE`,
        [uid, ...uniqueProductIds]
      );
      const ownedById = new Map(owned.map(row => [Number(row.id), row]));
      if (uniqueProductIds.some(id => !ownedById.has(id))) {
        await conn.rollback();
        return res.status(400).json({ error: 'Un produit référencé n’appartient pas à cette entreprise.' });
      }
      if (uniqueProductIds.some(id => ownedById.get(id).type_catalogue === 'service')) {
        await conn.rollback();
        return res.status(400).json({ error: 'Les services ne peuvent pas être commandés via Achats & stocks.' });
      }
    }
    const [created] = await conn.query(
      "INSERT INTO pro_commandes_fournisseurs (user_id, fournisseur_id, numero, statut, date_commande, date_livraison_prevue, devise, total_ht, total_tva, total_ttc, notes) VALUES (?, ?, ?, 'confirmee', ?, ?, ?, ?, ?, ?, ?)",
      [uid, supplierId, numero, await safeDateForUser(req.body.date_commande, uid), req.body.date_livraison_prevue || null, orderCurrency, totalHt, totalTax, totalHt + totalTax, optionalText(req.body.notes, 5000)]
    );
    for (const line of normalized) {
      await conn.query(
        'INSERT INTO pro_commandes_fournisseurs_lignes (user_id, commande_id, produit_id, designation, quantite, prix_unitaire, tva, total_ligne) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uid, created.insertId, line.produit_id, line.designation, line.qty, line.price, line.tax, line.total]
      );
    }
    await conn.commit();
    await audit(req, 'achat.commande_creee', 'commande_fournisseur', created.insertId, { numero, montant: totalHt + totalTax });
    res.status(201).json({ id: created.insertId, numero, total_ht: totalHt, total_tva: totalTax, total_ttc: totalHt + totalTax, statut: 'confirmee' });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally { if (conn) conn.release(); }
});

router.post('/purchase-orders/:id/cancel', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req);
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [orderRows] = await conn.query(
      'SELECT * FROM pro_commandes_fournisseurs WHERE id = ? AND user_id = ? FOR UPDATE',
      [req.params.id, uid]
    );
    const order = orderRows[0];
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ error: 'Commande fournisseur introuvable.' });
    }
    if (order.statut === 'annulee') {
      await conn.rollback();
      return res.status(409).json({ error: 'Cette commande fournisseur est déjà annulée.' });
    }
    const [[progress]] = await conn.query(
      `SELECT COUNT(*) AS lignes,
              COALESCE(SUM(quantite), 0) AS commandee,
              COALESCE(SUM(quantite_recue), 0) AS recue
         FROM pro_commandes_fournisseurs_lignes
        WHERE commande_id = ? AND user_id = ?`,
      [order.id, uid]
    );
    const orderedQuantity = Number(progress.commandee || 0);
    const receivedQuantity = Number(progress.recue || 0);
    if (Number(progress.lignes || 0) === 0 || order.statut === 'recue' ||
        (orderedQuantity > 0 && receivedQuantity + 0.0001 >= orderedQuantity)) {
      await conn.rollback();
      return res.status(409).json({ error: 'Une commande intégralement réceptionnée ne peut pas être annulée.' });
    }
    const remainingQuantity = Math.max(0, Math.round((orderedQuantity - receivedQuantity) * 1000) / 1000);
    await conn.query(
      "UPDATE pro_commandes_fournisseurs SET statut = 'annulee' WHERE id = ? AND user_id = ?",
      [order.id, uid]
    );
    await conn.commit();
    await audit(req, 'achat.commande_annulee', 'commande_fournisseur', order.id, {
      reference: order.numero,
      quantite_recue_conservee: Math.round(receivedQuantity * 1000) / 1000,
      quantite_restante_annulee: remainingQuantity
    });
    res.json({
      id: order.id,
      numero: order.numero,
      statut: 'annulee',
      quantite_recue_conservee: Math.round(receivedQuantity * 1000) / 1000,
      quantite_restante_annulee: remainingQuantity
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally { if (conn) conn.release(); }
});
router.put('/purchase-orders/:id/lines/:lineId/product', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req);
    const orderId = Number(req.params.id), lineId = Number(req.params.lineId), productId = Number(req.body.produit_id);
    if (![orderId, lineId, productId].every(value => Number.isSafeInteger(value) && value > 0)) {
      return res.status(400).json({ error: 'Commande, ligne et produit doivent être valides.' });
    }
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [orders] = await conn.query(
      'SELECT id, statut FROM pro_commandes_fournisseurs WHERE id = ? AND user_id = ? FOR UPDATE',
      [orderId, uid]
    );
    const order = orders[0];
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ error: 'Commande fournisseur introuvable.' });
    }
    if (order.statut === 'annulee' || order.statut === 'recue') {
      await conn.rollback();
      return res.status(409).json({ error: 'Cette commande ne peut plus être modifiée.' });
    }
    const [lines] = await conn.query(
      'SELECT id, quantite_recue FROM pro_commandes_fournisseurs_lignes WHERE id = ? AND commande_id = ? AND user_id = ? FOR UPDATE',
      [lineId, orderId, uid]
    );
    const line = lines[0];
    if (!line) {
      await conn.rollback();
      return res.status(404).json({ error: 'Ligne de commande introuvable.' });
    }
    if (Number(line.quantite_recue) > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Le produit d’une ligne déjà réceptionnée ne peut plus être modifié.' });
    }
    const [products] = await conn.query(
      'SELECT id, type_catalogue FROM produits WHERE id = ? AND user_id = ? FOR UPDATE',
      [productId, uid]
    );
    if (!products.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Le produit sélectionné n’appartient pas à cette entreprise.' });
    }
    if (products[0].type_catalogue === 'service') {
      await conn.rollback();
      return res.status(400).json({ error: 'Un service ne peut pas être associé à une réception de stock physique.' });
    }
    await conn.query(
      'UPDATE pro_commandes_fournisseurs_lignes SET produit_id = ? WHERE id = ? AND commande_id = ? AND user_id = ?',
      [productId, lineId, orderId, uid]
    );
    await conn.commit();
    await audit(req, 'achat.ligne_produit_associe', 'commande_fournisseur', orderId, { ligne_id: lineId, produit_id: productId });
    res.json({ success: true, commande_id: orderId, ligne_id: lineId, produit_id: productId });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally { if (conn) conn.release(); }
});
router.post('/purchase-orders/:id/receive', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req), defaultWarehouseId = await ensureDefaultWarehouse(uid);
    const lines = Array.isArray(req.body.lignes) ? req.body.lignes : [];
    const warehouseId = Number(req.body.entrepot_id) || defaultWarehouseId;
    if (!lines.length || lines.length > 100) return res.status(400).json({ error: 'Indiquez au moins une ligne à réceptionner.' });
    const normalizedLines = lines.map(line => ({
      ligne_id: Number(line.ligne_id),
      quantite: Math.round(Number(line.quantite) * 1000) / 1000
    }));
    if (normalizedLines.some(line => !Number.isSafeInteger(line.ligne_id) || line.ligne_id <= 0 ||
        !Number.isFinite(line.quantite) || line.quantite <= 0)) {
      return res.status(400).json({ error: 'Chaque ligne doit avoir un identifiant et une quantité reçue valides.' });
    }
    if (new Set(normalizedLines.map(line => line.ligne_id)).size !== normalizedLines.length) return res.status(400).json({ error: 'Une même ligne de commande ne peut être réceptionnée qu’une fois par opération.' });
    const operationId = String(req.body.operation_id || '').trim();
    if (operationId && !/^[a-zA-Z0-9_-]{16,64}$/.test(operationId)) {
      return res.status(400).json({ error: 'Identifiant d’opération de réception invalide.' });
    }
    const reference = operationId ? 'REC-' + operationId : randomRef('REC');
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [orderRows] = await conn.query('SELECT * FROM pro_commandes_fournisseurs WHERE id = ? AND user_id = ? FOR UPDATE', [req.params.id, uid]);
    const order = orderRows[0];
    if (!order) { await conn.rollback(); return res.status(404).json({ error: 'Commande fournisseur introuvable.' }); }
    const [existingReceipts] = await conn.query(
      'SELECT id, commande_id FROM pro_receptions_achats WHERE user_id = ? AND reference = ? FOR UPDATE',
      [uid, reference]
    );
    if (existingReceipts.length) {
      const existing = existingReceipts[0];
      if (Number(existing.commande_id) !== Number(order.id)) {
        await conn.rollback();
        return res.status(409).json({ error: 'Cet identifiant de réception est déjà utilisé pour une autre commande.' });
      }
      const [savedLines] = await conn.query(
        'SELECT commande_ligne_id, quantite FROM pro_receptions_achats_lignes WHERE reception_id = ? AND user_id = ? ORDER BY commande_ligne_id',
        [existing.id, uid]
      );
      const requested = normalizedLines.slice().sort((a, b) => a.ligne_id - b.ligne_id);
      const saved = savedLines.map(line => ({ ligne_id: Number(line.commande_ligne_id), quantite: Number(line.quantite) }))
        .sort((a, b) => a.ligne_id - b.ligne_id);
      const samePayload = requested.length === saved.length && requested.every((line, index) =>
        line.ligne_id === saved[index].ligne_id && Math.abs(line.quantite - saved[index].quantite) <= 0.0001
      );
      if (!samePayload) {
        await conn.rollback();
        return res.status(409).json({ error: 'Cet identifiant de réception a déjà été utilisé avec des quantités différentes.' });
      }
      await conn.rollback();
      return res.status(200).json({ reception_id: existing.id, reference, statut: order.statut, repeated: true });
    }
    if (order.statut === 'annulee' || order.statut === 'recue') {
      await conn.rollback();
      return res.status(409).json({ error: 'Commande annulée ou déjà intégralement réceptionnée.' });
    }
    const [warehouseRows] = await conn.query('SELECT id, nom FROM pro_entrepots WHERE id = ? AND user_id = ? AND actif = 1', [warehouseId, uid]);
    if (!warehouseRows.length) { await conn.rollback(); return res.status(400).json({ error: 'Entrepôt invalide.' }); }
    const [receipt] = await conn.query(
      'INSERT INTO pro_receptions_achats (user_id, commande_id, entrepot_id, reference, date_reception, acteur_user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [uid, order.id, warehouseId, reference, await safeDateForUser(req.body.date_reception, uid), actor(req)]
    );
    const [orderLines] = await conn.query('SELECT * FROM pro_commandes_fournisseurs_lignes WHERE commande_id = ? AND user_id = ? FOR UPDATE', [order.id, uid]);
    for (const received of normalizedLines) {
      const line = orderLines.find(item => Number(item.id) === received.ligne_id);
      const qty = received.quantite;
      if (!line || !Number.isFinite(qty) || qty <= 0 || qty > Number(line.quantite) - Number(line.quantite_recue) + 0.0001) {
        throw new Error('Quantité reçue invalide ou supérieure au reliquat de commande.');
      }
      if (!line.produit_id) throw new Error('La ligne "' + line.designation + '" doit être associée à un produit du catalogue avant de mettre à jour le stock.');
      const [productRows] = await conn.query('SELECT id, type_catalogue FROM produits WHERE id = ? AND user_id = ? FOR UPDATE', [line.produit_id, uid]);
      if (!productRows.length) throw new Error('Produit supprimé ou non autorisé.');
      if (productRows[0].type_catalogue === 'service') throw new Error('Un service ne peut pas être réceptionné dans le stock physique.');
      await conn.query(
        'INSERT INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE id = id',
        [uid, warehouseId, line.produit_id]
      );
      await conn.query('UPDATE pro_stocks_entrepots SET quantite = quantite + ? WHERE user_id = ? AND entrepot_id = ? AND produit_id = ?', [qty, uid, warehouseId, line.produit_id]);
      await conn.query('UPDATE pro_commandes_fournisseurs_lignes SET quantite_recue = quantite_recue + ? WHERE id = ? AND user_id = ?', [qty, line.id, uid]);
      await conn.query(
        'INSERT INTO pro_receptions_achats_lignes (user_id, reception_id, commande_ligne_id, produit_id, quantite, prix_unitaire) VALUES (?, ?, ?, ?, ?, ?)',
        [uid, receipt.insertId, line.id, line.produit_id, qty, line.prix_unitaire]
      );
      await conn.query(
        "INSERT INTO pro_mouvements_stock (user_id, produit_id, produit_nom, entrepot_id, entrepot_nom, type, quantite, cout_unitaire, reference, motif, acteur_user_id) VALUES (?, ?, ?, ?, ?, 'reception_achat', ?, ?, ?, ?, ?)",
        [uid, line.produit_id, line.designation, warehouseId, warehouseRows[0].nom, qty, line.prix_unitaire, reference, 'Réception ' + order.numero, actor(req)]
      );
    }
    const [[progress]] = await conn.query('SELECT SUM(quantite_recue) AS recu, SUM(quantite) AS commande FROM pro_commandes_fournisseurs_lignes WHERE commande_id = ? AND user_id = ?', [order.id, uid]);
    const status = Number(progress.recu) + 0.0001 >= Number(progress.commande) ? 'recue' : 'partiellement_recue';
    await conn.query('UPDATE pro_commandes_fournisseurs SET statut = ? WHERE id = ? AND user_id = ?', [status, order.id, uid]);
    await conn.query(
      'UPDATE produits p SET p.stock = (SELECT COALESCE(SUM(s.quantite),0) FROM pro_stocks_entrepots s WHERE s.user_id = p.user_id AND s.produit_id = p.id) WHERE p.user_id = ? AND EXISTS (SELECT 1 FROM pro_stocks_entrepots s WHERE s.user_id = p.user_id AND s.produit_id = p.id)',
      [uid]
    );
    await conn.commit();
    await audit(req, 'achat.reception', 'commande_fournisseur', order.id, { reference, statut: status });
    res.status(201).json({ reception_id: receipt.insertId, reference, statut: status, repeated: false });
  } catch (err) {
    if (conn) await conn.rollback();
    if (/Quantité reçue|associée à un produit|Produit supprimé|service ne peut pas être réceptionné/.test(err.message || '')) return res.status(400).json({ error: err.message });
    next(err);
  } finally { if (conn) conn.release(); }
});

router.get('/inventory/stock', async (req, res, next) => {
  try {
    await ensureDefaultWarehouse(owner(req));
    const [rows] = await pool.query(
      `SELECT p.id AS produit_id, p.nom, p.reference, p.prix_achat, p.prix_ht, COALESCE(SUM(s.quantite),0) AS quantite, COUNT(DISTINCT s.entrepot_id) AS nb_entrepots FROM produits p LEFT JOIN pro_stocks_entrepots s ON s.produit_id = p.id AND s.user_id = p.user_id WHERE p.user_id = ? AND COALESCE(p.type_catalogue, 'non_classe') <> 'service' GROUP BY p.id ORDER BY p.nom`,
      [owner(req)]
    );
    res.json({ stocks: rows });
  } catch (err) { next(err); }
});

router.get('/inventory/movements', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT m.*, COALESCE(m.produit_nom, p.nom) AS produit_nom, COALESCE(m.entrepot_nom, w.nom) AS entrepot_nom FROM pro_mouvements_stock m LEFT JOIN produits p ON p.id = m.produit_id AND p.user_id = m.user_id LEFT JOIN pro_entrepots w ON w.id = m.entrepot_id AND w.user_id = m.user_id WHERE m.user_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 300',
      [owner(req)]
    );
    res.json({ mouvements: rows });
  } catch (err) { next(err); }
});

router.post('/inventory/adjustments', async (req, res, next) => {
  let conn;
  try {
    const uid = owner(req), productId = Number(req.body.produit_id), warehouseId = Number(req.body.entrepot_id) || await ensureDefaultWarehouse(uid);
    const delta = Math.round(Number(req.body.quantite) * 1000) / 1000, reason = String(req.body.motif || '').trim().slice(0, 255);
    if (!idOk(productId) || !Number.isFinite(delta) || !delta || Math.abs(delta) > 10000000 || !reason) return res.status(400).json({ error: 'Produit, quantité non nulle et motif obligatoires.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [products] = await conn.query('SELECT id, nom, prix_achat, type_catalogue FROM produits WHERE id = ? AND user_id = ? FOR UPDATE', [productId, uid]);
    const [warehouses] = await conn.query('SELECT id, nom FROM pro_entrepots WHERE id = ? AND user_id = ? AND actif = 1', [warehouseId, uid]);
    if (!products.length || !warehouses.length) { await conn.rollback(); return res.status(404).json({ error: 'Produit ou entrepôt introuvable.' }); }
    if (products[0].type_catalogue === 'service') { await conn.rollback(); return res.status(409).json({ error: 'Un service ne peut pas recevoir de mouvement de stock.' }); }
    await conn.query('INSERT INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE id = id', [uid, warehouseId, productId]);
    const [[stock]] = await conn.query('SELECT quantite FROM pro_stocks_entrepots WHERE user_id = ? AND entrepot_id = ? AND produit_id = ? FOR UPDATE', [uid, warehouseId, productId]);
    const next = Math.round((Number(stock.quantite) + delta) * 1000) / 1000;
    if (next < 0) { await conn.rollback(); return res.status(409).json({ error: 'Le stock de cet entrepôt ne peut pas devenir négatif.' }); }
    await conn.query('UPDATE pro_stocks_entrepots SET quantite = ? WHERE user_id = ? AND entrepot_id = ? AND produit_id = ?', [next, uid, warehouseId, productId]);
    await conn.query(
      "INSERT INTO pro_mouvements_stock (user_id, produit_id, produit_nom, entrepot_id, entrepot_nom, type, quantite, cout_unitaire, motif, acteur_user_id) VALUES (?, ?, ?, ?, ?, 'ajustement', ?, ?, ?, ?)",
      [uid, productId, products[0].nom, warehouseId, warehouses[0].nom, delta, products[0].prix_achat, reason, actor(req)]
    );
    await conn.query(
      'UPDATE produits p SET p.stock = (SELECT COALESCE(SUM(s.quantite),0) FROM pro_stocks_entrepots s WHERE s.user_id = p.user_id AND s.produit_id = p.id) WHERE p.id = ? AND p.user_id = ?',
      [productId, uid]
    );
    await conn.commit();
    await audit(req, 'stock.ajustement', 'produit', productId, { entrepot_id: warehouseId, variation: delta, motif: reason });
    res.json({ success: true, stock_entrepot: next });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally { if (conn) conn.release(); }
});

router.post('/inventory/transfers', async (req, res, next) => {
  let conn;
  try {
    await ensureDefaultWarehouse(owner(req));
    const uid = owner(req), productId = Number(req.body.produit_id), fromId = Number(req.body.entrepot_source_id), toId = Number(req.body.entrepot_destination_id), qty = Math.round(Number(req.body.quantite) * 1000) / 1000;
    if (!idOk(productId) || !idOk(fromId) || !idOk(toId) || fromId === toId || !Number.isFinite(qty) || qty <= 0 || qty > 10000000) return res.status(400).json({ error: 'Produit, deux entrepôts différents et quantité positive obligatoires.' });
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [productRows] = await conn.query('SELECT id, nom, prix_achat, type_catalogue FROM produits WHERE id = ? AND user_id = ? FOR UPDATE', [productId, uid]);
    const [warehouseRows] = await conn.query('SELECT id, nom FROM pro_entrepots WHERE id IN (?, ?) AND user_id = ? AND actif = 1', [fromId, toId, uid]);
    if (!productRows.length || warehouseRows.length !== 2) { await conn.rollback(); return res.status(404).json({ error: 'Produit ou entrepôt introuvable.' }); }
    if (productRows[0].type_catalogue === 'service') { await conn.rollback(); return res.status(409).json({ error: 'Un service ne peut pas être transféré entre entrepôts.' }); }
    await conn.query('INSERT INTO pro_stocks_entrepots (user_id, entrepot_id, produit_id, quantite) VALUES (?, ?, ?, 0), (?, ?, ?, 0) ON DUPLICATE KEY UPDATE id = id', [uid, fromId, productId, uid, toId, productId]);
    const [stocks] = await conn.query('SELECT entrepot_id, quantite FROM pro_stocks_entrepots WHERE user_id = ? AND produit_id = ? AND entrepot_id IN (?, ?) FOR UPDATE', [uid, productId, fromId, toId]);
    const source = stocks.find(row => Number(row.entrepot_id) === fromId);
    if (!source || Number(source.quantite) < qty) { await conn.rollback(); return res.status(409).json({ error: 'Stock insuffisant dans l’entrepôt source.' }); }
    const reference = randomRef('TRF');
    await conn.query('UPDATE pro_stocks_entrepots SET quantite = quantite - ? WHERE user_id = ? AND entrepot_id = ? AND produit_id = ?', [qty, uid, fromId, productId]);
    await conn.query('UPDATE pro_stocks_entrepots SET quantite = quantite + ? WHERE user_id = ? AND entrepot_id = ? AND produit_id = ?', [qty, uid, toId, productId]);
    await conn.query(
      "INSERT INTO pro_mouvements_stock (user_id, produit_id, produit_nom, entrepot_id, entrepot_nom, type, quantite, cout_unitaire, reference, motif, acteur_user_id) VALUES (?, ?, ?, ?, ?, 'transfert_sortant', ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, 'transfert_entrant', ?, ?, ?, ?, ?)",
      [uid, productId, productRows[0].nom, fromId, warehouseRows.find(w => Number(w.id) === fromId).nom, -qty, productRows[0].prix_achat, reference, 'Transfert vers entrepôt #' + toId, actor(req),
       uid, productId, productRows[0].nom, toId, warehouseRows.find(w => Number(w.id) === toId).nom, qty, productRows[0].prix_achat, reference, 'Transfert depuis entrepôt #' + fromId, actor(req)]
    );
    await conn.commit();
    res.json({ success: true, reference });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally { if (conn) conn.release(); }
});

router.get('/inventory/valuation', async (req, res, next) => {
  try {
    await ensureDefaultWarehouse(owner(req));
    const [rows] = await pool.query(
      `SELECT p.id, p.nom, p.reference, p.prix_achat, COALESCE(SUM(s.quantite),0) AS quantite, COALESCE(SUM(s.quantite * p.prix_achat),0) AS valeur FROM produits p LEFT JOIN pro_stocks_entrepots s ON s.produit_id = p.id AND s.user_id = p.user_id WHERE p.user_id = ? AND COALESCE(p.type_catalogue, 'non_classe') <> 'service' GROUP BY p.id ORDER BY p.nom`,
      [owner(req)]
    );
    const total = rows.reduce((sum, row) => sum + Number(row.valeur), 0);
    const [[company]] = await pool.query('SELECT devise FROM users WHERE id = ? LIMIT 1', [owner(req)]);
    res.json({ valorisation: rows, valeur_totale: Math.round(total * 100) / 100, devise: company?.devise || 'FCFA' });
  } catch (err) { next(err); }
});
};
