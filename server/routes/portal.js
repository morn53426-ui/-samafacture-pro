const express = require('express');
const crypto = require('crypto');
const { pool } = require('../config/db');

const router = express.Router();

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

async function accessForToken(token) {
  if (!/^[a-f0-9]{64}$/i.test(String(token || ''))) return null;
  const hash = tokenHash(token);
  const [rows] = await pool.query(
    `SELECT a.id AS access_id, a.user_id, a.client_id, a.expires_at, a.revoked_at,
            c.nom AS client_nom, c.email AS client_email,
            u.entreprise_nom, u.entreprise_logo, u.entreprise_email, u.entreprise_telephone,
            u.entreprise_site_web, u.devise, u.langue, u.locale
     FROM pro_customer_portal_access a
     JOIN clients c ON c.id = a.client_id AND c.user_id = a.user_id
     JOIN users u ON u.id = a.user_id
     WHERE a.token_hash = ? LIMIT 1`,
    [hash]
  );
  const access = rows[0];
  if (!access || access.revoked_at || new Date(access.expires_at).getTime() < Date.now()) return null;
  return access;
}

router.get('/', async (req, res, next) => {
  try {
    const access = await accessForToken(req.get('X-SF-Portal-Token'));
    if (!access) return res.status(404).json({ error: 'Ce lien client est invalide, expiré ou révoqué.' });
    await pool.query('UPDATE pro_customer_portal_access SET last_access_at = NOW() WHERE id = ?', [access.access_id]);

    const [documents] = await pool.query(
      `SELECT f.id, f.numero, f.type, f.date_emission, f.date_echeance, f.date_validite,
              f.statut, f.sous_total, f.total_tva, f.total, f.montant_paye,
              f.devise, f.objet, f.conditions_reglement,
              d.decision AS portail_decision, d.commentaire AS commentaire_client, d.decided_at
       FROM factures f
       LEFT JOIN pro_portal_quote_decisions d ON d.facture_id = f.id AND d.user_id = f.user_id
       WHERE f.user_id = ? AND f.client_id = ? AND f.type IN ('facture','devis')
       ORDER BY f.date_emission DESC, f.id DESC LIMIT 100`,
      [access.user_id, access.client_id]
    );
    const ids = documents.map(d => Number(d.id));
    let lineRows = [];
    if (ids.length) {
      const [rows] = await pool.query(
        `SELECT fl.facture_id, fl.designation, fl.quantite, fl.prix_unitaire, fl.tva, fl.total_ligne
         FROM facture_lignes fl JOIN factures f ON f.id = fl.facture_id
         WHERE f.user_id = ? AND f.client_id = ? AND fl.facture_id IN (${ids.map(() => '?').join(',')})
         ORDER BY fl.id ASC`,
        [access.user_id, access.client_id, ...ids]
      );
      lineRows = rows;
    }
    const lineMap = new Map();
    for (const line of lineRows) {
      const key = Number(line.facture_id);
      if (!lineMap.has(key)) lineMap.set(key, []);
      lineMap.get(key).push({
        designation: line.designation,
        quantite: Number(line.quantite),
        prix_unitaire: Number(line.prix_unitaire),
        tva: Number(line.tva),
        total_ligne: Number(line.total_ligne)
      });
    }
    const safeDocuments = documents.map(doc => ({
      ...doc,
      total: Number(doc.total),
      montant_paye: Number(doc.montant_paye),
      solde: Math.max(0, Number(doc.total) - Number(doc.montant_paye)),
      lignes: lineMap.get(Number(doc.id)) || []
    }));
    const [[summary]] = await pool.query(
      `SELECT COUNT(*) AS nb_factures,
              COALESCE(SUM(CASE WHEN type = 'facture' AND statut <> 'annulee' THEN total - montant_paye ELSE 0 END),0) AS solde_du,
              COUNT(CASE WHEN type = 'devis' THEN 1 END) AS nb_devis
       FROM factures WHERE user_id = ? AND client_id = ?`,
      [access.user_id, access.client_id]
    );
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    res.json({
      client: { nom: access.client_nom, email: access.client_email },
      entreprise: {
        nom: access.entreprise_nom,
        logo: access.entreprise_logo,
        email: access.entreprise_email,
        telephone: access.entreprise_telephone,
        site_web: access.entreprise_site_web,
        devise: access.devise,
        langue: access.langue,
        locale: access.locale
      },
      resume: {
        nb_factures: Number(summary.nb_factures),
        nb_devis: Number(summary.nb_devis),
        solde_du: Number(summary.solde_du)
      },
      documents: safeDocuments
    });
  } catch (err) { next(err); }
});

router.post('/quotes/:invoiceId/decision', async (req, res, next) => {
  try {
    const access = await accessForToken(req.get('X-SF-Portal-Token'));
    if (!access) return res.status(404).json({ error: 'Ce lien client est invalide, expiré ou révoqué.' });
    const decision = String(req.body.decision || '');
    const commentaire = String(req.body.commentaire || '').trim().slice(0, 1000);
    if (!['accepte', 'refuse'].includes(decision)) return res.status(400).json({ error: 'Décision invalide.' });

    const [quotes] = await pool.query(
      `SELECT id, numero, statut, date_validite FROM factures
       WHERE id = ? AND user_id = ? AND client_id = ? AND type = 'devis' LIMIT 1`,
      [req.params.invoiceId, access.user_id, access.client_id]
    );
    const quote = quotes[0];
    if (!quote) return res.status(404).json({ error: 'Devis introuvable.' });
    if (quote.statut !== 'en_attente') return res.status(409).json({ error: 'Ce devis n’est plus disponible pour une décision en ligne.' });
    if (quote.date_validite && new Date(quote.date_validite + 'T23:59:59Z').getTime() < Date.now()) {
      return res.status(409).json({ error: 'La validité de ce devis est expirée. Contactez l’entreprise.' });
    }
    const [existing] = await pool.query(
      'SELECT id, decision, decided_at FROM pro_portal_quote_decisions WHERE user_id = ? AND facture_id = ? LIMIT 1',
      [access.user_id, quote.id]
    );
    if (existing.length) return res.status(409).json({ error: 'Une décision a déjà été enregistrée pour ce devis.', decision: existing[0].decision });
    await pool.query(
      'INSERT INTO pro_portal_quote_decisions (user_id, client_id, facture_id, portal_access_id, decision, commentaire) VALUES (?, ?, ?, ?, ?, ?)',
      [access.user_id, access.client_id, quote.id, access.access_id, decision, commentaire || null]
    );
    // Rendre la décision visible dans l'historique CRM de l'entreprise.
    await pool.query(
      "INSERT INTO pro_crm_activities (user_id, client_id, acteur_user_id, type, titre, description, statut, completed_at) VALUES (?, ?, NULL, 'note', ?, ?, 'terminee', NOW())",
      [
        access.user_id, access.client_id,
        'Réponse client au devis ' + quote.numero,
        (decision === 'accepte' ? 'Devis accepté' : 'Devis refusé') + (commentaire ? ' — ' + commentaire : '')
      ]
    );
    res.status(201).json({ success: true, numero: quote.numero, decision, message: decision === 'accepte' ? 'Votre acceptation a été transmise à l’entreprise.' : 'Votre réponse a été transmise à l’entreprise.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Une décision a déjà été enregistrée pour ce devis.' });
    next(err);
  }
});

module.exports = router;
