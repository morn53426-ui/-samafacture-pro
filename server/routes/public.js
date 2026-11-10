const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { pool } = require('../config/db');

const router = express.Router();

// Limite les tentatives de vérification (évite qu'un script balaie des id/codes au hasard).
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Veuillez réessayer dans quelques minutes.' }
});

// Vérification publique d'une facture/devis (scannée depuis le QR code imprimé sur le
// document) : ne révèle que des informations minimales, uniquement si l'identifiant ET le
// code secret correspondent — empêche de deviner l'URL d'un autre document en changeant l'id.
/**
 * @openapi
 * /public/verifier/{id}/{code}:
 *   get:
 *     summary: Vérifie l'authenticité d'une facture/devis à partir du QR code imprimé dessus (aucun compte requis)
 *     description: "Renvoie uniquement des informations minimales (montant, statut, émetteur) — jamais les coordonnées du client, contrairement à /public/consulter."
 *     tags: [Public]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *         description: "Code de vérification encodé dans le QR code."
 *     responses:
 *       200:
 *         description: Document authentique.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 numero: { type: string }
 *                 type: { type: string, enum: [facture, devis] }
 *                 date_emission: { type: string, format: date }
 *                 total: { type: number }
 *                 statut: { type: string }
 *                 montant_paye: { type: number }
 *                 entreprise: { type: string }
 *       404: { description: "Document introuvable ou code invalide.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.get('/verifier/:id/:code', verifyLimiter, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.numero, f.type, f.date_emission, f.total, f.statut, f.montant_paye, u.entreprise_nom, u.nom as user_nom
       FROM factures f JOIN users u ON u.id = f.user_id
       WHERE f.id = ? AND f.verification_code = ?`,
      [req.params.id, req.params.code]
    );
    const facture = rows[0];
    if (!facture) return res.status(404).json({ error: 'Document introuvable ou code de vérification invalide.' });

    res.json({
      numero: facture.numero,
      type: facture.type,
      date_emission: facture.date_emission,
      total: facture.total,
      statut: facture.statut,
      montant_paye: facture.montant_paye,
      entreprise: facture.entreprise_nom || facture.user_nom
    });
  } catch (err) { next(err); }
});

// Consultation publique complète d'une facture/devis (lien envoyé par email au client) :
// lecture seule, sans compte requis, protégée par le même code de vérification que le QR
// code. Contrairement à /verifier, renvoie le détail complet (lignes, informations client)
// puisque c'est le client légitime qui a reçu ce lien précis par email.
/**
 * @openapi
 * /public/consulter/{id}/{code}:
 *   get:
 *     summary: Consultation complète d'une facture/devis via le lien envoyé par email (aucun compte requis)
 *     description: "Renvoie le détail complet (lignes, coordonnées du client et de l'entreprise) — protégée par le même code secret que /public/verifier, mais destinée au client légitime ayant reçu ce lien précis par email plutôt qu'à un simple contrôle d'authenticité."
 *     tags: [Public]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Détail complet du document.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 facture: { $ref: '#/components/schemas/Facture' }
 *                 lignes: { type: array, items: { $ref: '#/components/schemas/LigneFacture' } }
 *       404: { description: "Document introuvable ou lien invalide.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.get('/consulter/:id/:code', verifyLimiter, async (req, res, next) => {
  try {
    // Liste explicite de colonnes plutôt que `SELECT f.*` (voir AUDIT_PRODUCTION.md §2.1) :
    // l'ancienne requête renvoyait `verification_code` — le secret qui protège l'accès à cette
    // route — dans sa propre réponse publique, ainsi que les identifiants internes `user_id`/
    // `client_id`. Chaque champ ci-dessous a été vérifié comme effectivement utilisé par
    // public/consulter.html avant d'être gardé.
    const [rows] = await pool.query(
      `SELECT f.numero, f.type, f.date_emission, f.date_echeance, f.statut, f.remise,
              f.frais_livraison, f.mode_paiement, f.commentaires, f.sous_total, f.total_tva,
              f.total, f.montant_paye,
              c.nom as client_nom, c.email as client_email, c.telephone as client_telephone, c.adresse as client_adresse,
              u.entreprise_nom, u.nom as user_nom, u.entreprise_adresse, u.entreprise_telephone, u.entreprise_email, u.entreprise_logo, u.devise
       FROM factures f
       JOIN clients c ON c.id = f.client_id
       JOIN users u ON u.id = f.user_id
       WHERE f.id = ? AND f.verification_code = ?`,
      [req.params.id, req.params.code]
    );
    const facture = rows[0];
    if (!facture) return res.status(404).json({ error: 'Document introuvable ou lien invalide.' });

    // req.params.id reste un identifiant sûr pour cette deuxième requête : on ne l'utilise que
    // parce que la première a déjà confirmé la correspondance id+code ci-dessus.
    const [lignes] = await pool.query('SELECT designation, quantite, prix_unitaire, tva, total_ligne FROM facture_lignes WHERE facture_id = ?', [req.params.id]);
    res.json({ facture, lignes });
  } catch (err) { next(err); }
});


 // Demande de paiement publique : le jeton est imprévisible et seul son hash est conservé.
 // Cette page affiche la demande et les coordonnées du commerçant ; elle ne confirme pas
 // un paiement et ne remplace pas une intégration de passerelle de paiement.
 router.get('/paiement/:token', verifyLimiter, async (req, res, next) => {
   try {
     const token = String(req.params.token || '');
     if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(404).json({ error: 'Lien de paiement introuvable ou expiré.' });
     const hash = crypto.createHash('sha256').update(token).digest('hex');
     const [rows] = await pool.query(
       'SELECT l.id, l.montant, l.devise, l.statut, l.expire_at, f.numero, f.total, f.montant_paye, u.entreprise_nom, u.nom AS user_nom, u.entreprise_telephone, u.entreprise_email, u.entreprise_adresse FROM pro_payment_links l JOIN factures f ON f.id = l.facture_id JOIN users u ON u.id = l.user_id WHERE l.token_hash = ? AND l.statut = ? AND (l.expire_at IS NULL OR l.expire_at > NOW()) LIMIT 1',
       [hash, 'actif']
     );
     if (!rows.length) return res.status(404).json({ error: 'Lien de paiement introuvable ou expiré.' });
     const item = rows[0];
     const remaining = Math.max(0, Number(item.total) - Number(item.montant_paye));
     if (remaining + 0.001 < Number(item.montant)) {
       await pool.query("UPDATE pro_payment_links SET statut = 'expire' WHERE id = ? AND statut = 'actif'", [item.id]);
       return res.status(409).json({ error: 'Le solde de cette facture a changé. Demandez un nouveau lien de paiement à l’entreprise.' });
     }
     res.json({
       entreprise: item.entreprise_nom || item.user_nom,
       telephone: item.entreprise_telephone,
       email: item.entreprise_email,
       adresse: item.entreprise_adresse,
       facture: item.numero,
       montant: Number(item.montant),
       devise: item.devise,
       statut: item.statut,
       expiration: item.expire_at,
       solde_facture: remaining,
       type: 'demande_de_paiement'
     });
   } catch (err) { next(err); }
 });

module.exports = router;
