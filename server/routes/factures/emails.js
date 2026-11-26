/**
 * Routes d'envoi (facture/devis par email) — extrait de routes/factures.js (Phase 2).
 * Inclut `envoyerFactureParEmail` (utilisé par config/scheduler.js pour l'envoi automatique).
 */
const express = require('express');
const crypto = require('crypto');
const { pool } = require('../../config/db');
const { sendMail, isSmtpConfigured } = require('../../config/mailer');
const { escapeHtmlEmail, sanitizeEmailHeader } = require('../../utils/email-escape');
const { formatAmountWithCurrency } = require('../../utils/money-format');
const { genererPdfFacture } = require('../../utils/pdf');

const router = express.Router();

/**
 * Envoie une facture/devis par email au client, avec PDF en pièce jointe si la génération
 * réussit (sinon l'email part quand même, sans bloquer sur un souci de rendu PDF). Extraite
 * en fonction réutilisable pour que la route manuelle ci-dessous ET l'envoi automatique des
 * factures récurrentes (voir config/scheduler.js) partagent exactement la même logique —
 * un seul endroit de vérité, pas de comportement divergent entre les deux déclencheurs.
 * @param {string|undefined} destinataireForce email explicite (sinon celui du client)
 */
async function envoyerFactureParEmail(factureId, userId, baseUrl, destinataireForce) {
  const [rows] = await pool.query(
    `SELECT f.*, c.nom as client_nom, c.email as client_email,
            u.entreprise_nom, u.nom as user_nom, u.email as user_email, u.role as user_role
      FROM factures f JOIN clients c ON c.id = f.client_id AND c.user_id = f.user_id JOIN users u ON u.id = f.user_id
      WHERE f.id = ? AND f.user_id = ?`,
    [factureId, userId]
  );
  const facture = rows[0];
  if (!facture) throw new Error('Document introuvable.');

  const destinataire = destinataireForce || facture.client_email;
  if (!destinataire) throw new Error("Aucune adresse email pour ce client.");

  if (!facture.verification_code) {
    facture.verification_code = crypto.randomBytes(5).toString('hex');
    await pool.query('UPDATE factures SET verification_code = ? WHERE id = ? AND user_id = ?', [facture.verification_code, facture.id, userId]);
  }

  const consultUrl = `${baseUrl}/consulter.html?id=${facture.id}&code=${facture.verification_code}`;
  const emetteur = facture.entreprise_nom || facture.user_nom;
  const isDevis = facture.type === 'devis';
  const label = isDevis ? 'devis' : 'facture';
  if (!isSmtpConfigured()) {
    const error = new Error('SMTP non configuré : email non envoyé.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }
  const safeClientNom = escapeHtmlEmail(facture.client_nom);
  const safeEmetteur = escapeHtmlEmail(emetteur);
  const safeNumero = escapeHtmlEmail(facture.numero);
  const safeConsultUrl = escapeHtmlEmail(consultUrl);
  const montantFormate = formatAmountWithCurrency(facture.total, facture.devise);
  const safeMontantFormate = escapeHtmlEmail(montantFormate);

  let attachments;
  try {
    // genererPdfFacture signe un token temporaire avec id/email/role/nom (voir
    // utils/pdf.js) : on reconstruit ici le même objet "utilisateur" que req.user
    // fournirait normalement, à partir des colonnes déjà jointes ci-dessus — pour que
    // l'envoi automatique (sans req, déclenché par le planificateur) se comporte
    // exactement comme l'envoi manuel depuis la route.
    const pdfBuffer = await genererPdfFacture(facture.id, { id: userId, email: facture.user_email, role: facture.user_role, nom: facture.user_nom });
    attachments = [{ filename: `${label}-${facture.numero}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }];
  } catch (pdfErr) {
    console.error('PDF joint à l\'email échoué (email envoyé sans pièce jointe) :', pdfErr.message);
  }

  const mailResult = await sendMail({
    to: destinataire,
    subject: sanitizeEmailHeader(`${emetteur} vous a envoyé un ${label} — ${facture.numero}`),
    text: `Bonjour ${facture.client_nom},\n\n${emetteur} vous a envoyé un ${label} d'un montant de ${montantFormate}.\n\nConsultez-le en ligne : ${consultUrl}\n\nMerci de votre confiance.`,
    html: `<p>Bonjour ${safeClientNom},</p><p><strong>${safeEmetteur}</strong> vous a envoyé un ${label} (${safeNumero}) d'un montant de <strong>${safeMontantFormate}</strong>.</p><p><a href="${safeConsultUrl}" style="display:inline-block;padding:10px 18px;background:#0FA980;color:#fff;border-radius:8px;text-decoration:none;">Consulter le ${label}</a></p><p>Ou copiez ce lien : ${safeConsultUrl}</p>`,
    attachments
  });
  if (!mailResult?.sent) {
    const error = new Error('SMTP non configuré : email non envoyé.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  return { success: true, sent_to: destinataire };
}

/** @openapi
 * /factures/{id}/envoyer:
 *   post:
 *     summary: Envoie la facture/le devis par email au client (lien de consultation en ligne + PDF en pièce jointe)
 *     tags: [Factures]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { email: { type: string, description: "Remplace l'email du client par défaut." } }
 *     responses:
 *       200: { description: "Email envoyé.", content: { application/json: { schema: { type: object, properties: { success: { type: boolean }, sent_to: { type: string } } } } } }
 *       400: { description: "Aucune adresse email disponible.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 *       404: { description: "Document introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/:id/envoyer', async (req, res, next) => {
  try {
    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const resultat = await envoyerFactureParEmail(req.params.id, req.tenantId, baseUrl, req.body && req.body.email);
    res.json(resultat);
  } catch (err) {
    if (err.message === 'Document introuvable.') return res.status(404).json({ error: err.message });
    if (err.message === "Aucune adresse email pour ce client.") {
      return res.status(400).json({ error: "Aucune adresse email pour ce client. Ajoutez-en une dans sa fiche, ou précisez-en une." });
    }
    if (err.code === 'SMTP_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    next(err);
  }
});

/**
 * @openapi
 * /factures/{id}/relancer:
 *   post:
 *     summary: Envoie une relance par email pour une facture en attente/en retard (PDF joint)
 *     tags: [Factures]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { email: { type: string, description: "Remplace l'email du client par défaut." } }
 *     responses:
 *       200: { description: "Relance envoyée.", content: { application/json: { schema: { type: object, properties: { success: { type: boolean }, sent_to: { type: string } } } } } }
 *       400: { description: "Facture déjà payée, ou aucune adresse email disponible.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 *       404: { description: "Facture introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/:id/relancer', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.*, c.nom as client_nom, c.email as client_email, u.entreprise_nom, u.nom as user_nom
       FROM factures f JOIN clients c ON c.id = f.client_id AND c.user_id = f.user_id JOIN users u ON u.id = f.user_id
       WHERE f.id = ? AND f.user_id = ? AND f.type = 'facture'`,
      [req.params.id, req.tenantId]
    );
    const facture = rows[0];
    if (!facture) return res.status(404).json({ error: 'Facture introuvable.' });
    if (facture.statut === 'payee') return res.status(400).json({ error: 'Cette facture est déjà payée.' });

    const destinataire = (req.body && req.body.email) || facture.client_email;
    if (!destinataire) return res.status(400).json({ error: "Aucune adresse email pour ce client." });
    if (!isSmtpConfigured()) return res.status(503).json({ error: 'SMTP non configuré : email non envoyé.' });

    if (!facture.verification_code) {
      facture.verification_code = crypto.randomBytes(5).toString('hex');
      await pool.query('UPDATE factures SET verification_code = ? WHERE id = ? AND user_id = ?', [facture.verification_code, facture.id, req.tenantId]);
    }

    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const consultUrl = `${baseUrl}/consulter.html?id=${facture.id}&code=${facture.verification_code}`;
    const emetteur = facture.entreprise_nom || facture.user_nom;
    const resteAPayer = Number(facture.total) - Number(facture.montant_paye);
    const resteAPayerFormate = formatAmountWithCurrency(resteAPayer, facture.devise);
    const safeResteAPayer = escapeHtmlEmail(resteAPayerFormate);

    const safeClientNom = escapeHtmlEmail(facture.client_nom);
    const safeEmetteur = escapeHtmlEmail(emetteur);
    const safeNumero = escapeHtmlEmail(facture.numero);
    const safeConsultUrl = escapeHtmlEmail(consultUrl);
    let attachments;
    try {
      const pdfBuffer = await genererPdfFacture(facture.id, { ...req.user, id: req.tenantId });
      attachments = [{ filename: `facture-${facture.numero}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }];
    } catch (pdfErr) {
      console.error('PDF joint à la relance échoué (email envoyé sans pièce jointe) :', pdfErr.message);
    }

    const mailResult = await sendMail({
      to: destinataire,
      subject: sanitizeEmailHeader(`Rappel : facture ${facture.numero} en attente de paiement`),
      text: `Bonjour ${facture.client_nom},\n\nNous vous rappelons que la facture ${facture.numero} d'un montant de ${resteAPayerFormate} est toujours en attente de règlement.\n\nConsultez-la ici : ${consultUrl}\n\nMerci de régulariser dans les meilleurs délais.`,
      html: `<p>Bonjour ${safeClientNom},</p><p>Nous vous rappelons que la facture <strong>${safeNumero}</strong> d'un montant restant dû de <strong>${safeResteAPayer}</strong> est toujours en attente de règlement par ${safeEmetteur}.</p><p><a href="${safeConsultUrl}" style="display:inline-block;padding:10px 18px;background:#E8A33D;color:#0F1B33;border-radius:8px;text-decoration:none;font-weight:600;">Consulter la facture</a></p><p>Merci de régulariser dans les meilleurs délais.</p>`,
      attachments
    });
    if (!mailResult?.sent) return res.status(503).json({ error: 'SMTP non configuré : email non envoyé.' });

    res.json({ success: true, sent_to: destinataire });
  } catch (err) {
    if (err.code === 'SMTP_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
module.exports.envoyerFactureParEmail = envoyerFactureParEmail;
