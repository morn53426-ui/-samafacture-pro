const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { positiveNumber, percentage } = require('../utils/validation');
const { computeTotals, insererLignesFacture } = require('./factures');

const router = express.Router();
router.use(requireAuth);

function addInterval(date, frequence) {
  const d = new Date(date);
  if (frequence === 'hebdomadaire') d.setDate(d.getDate() + 7);
  else if (frequence === 'annuelle') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1); // mensuelle par défaut
  return d.toISOString().slice(0, 10);
}

/**
 * @openapi
 * /factures-recurrentes:
 *   get:
 *     summary: Liste les factures récurrentes (abonnements clients), triées par prochaine échéance
 *     tags: [Factures récurrentes]
 *     responses:
 *       200:
 *         description: Liste.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { recurrentes: { type: array, items: { $ref: '#/components/schemas/FactureRecurrente' } } } }
 */
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, c.nom as client_nom FROM factures_recurrentes r
       JOIN clients c ON c.id = r.client_id
       WHERE r.user_id = ? ORDER BY r.prochaine_date ASC`,
      [req.user.id]
    );
    res.json({ recurrentes: rows.map(r => ({ ...r, lignes: JSON.parse(r.lignes_json) })) });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /factures-recurrentes:
 *   post:
 *     summary: Crée une facture récurrente (génération automatique périodique — voir le planificateur du serveur)
 *     tags: [Factures récurrentes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [client_id, libelle, lignes]
 *             properties:
 *               client_id: { type: integer }
 *               libelle: { type: string }
 *               frequence: { type: string, enum: [hebdomadaire, mensuelle, annuelle], default: mensuelle }
 *               prochaine_date: { type: string, format: date }
 *               remise: { type: number, default: 0 }
 *               frais_livraison: { type: number, default: 0 }
 *               mode_paiement: { type: string, nullable: true }
 *               commentaires: { type: string, nullable: true }
 *               lignes: { type: array, items: { $ref: '#/components/schemas/LigneFacture' } }
 *     responses:
 *       201: { description: "Créée.", content: { application/json: { schema: { type: object, properties: { recurrente: { $ref: '#/components/schemas/FactureRecurrente' } } } } } }
 *       400: { description: "Champs manquants ou client invalide.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/', async (req, res, next) => {
  try {
    const { client_id, libelle, frequence, prochaine_date, remise, frais_livraison, mode_paiement, commentaires, lignes, envoi_auto_email } = req.body;

    if (!client_id || !libelle || !Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({ error: 'Client, libellé et au moins une ligne sont requis.' });
    }
    const [clientRows] = await pool.query('SELECT id FROM clients WHERE id = ? AND user_id = ?', [client_id, req.user.id]);
    if (!clientRows.length) return res.status(400).json({ error: 'Client invalide.' });

    const freqValides = ['hebdomadaire', 'mensuelle', 'annuelle'];
    const freq = freqValides.includes(frequence) ? frequence : 'mensuelle';

    const lignesClean = lignes.map(l => ({
      designation: String(l.designation || '').slice(0, 255),
      quantite: positiveNumber(l.quantite, 1),
      prix_unitaire: positiveNumber(l.prix_unitaire, 0),
      tva: percentage(l.tva, 0)
    }));

    const [result] = await pool.query(
      `INSERT INTO factures_recurrentes (user_id, client_id, libelle, frequence, prochaine_date, remise, frais_livraison, mode_paiement, commentaires, lignes_json, envoi_auto_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, client_id, libelle, freq, prochaine_date || new Date().toISOString().slice(0, 10),
        positiveNumber(remise, 0), positiveNumber(frais_livraison, 0), mode_paiement || null, commentaires || null,
        JSON.stringify(lignesClean), envoi_auto_email ? 1 : 0
      ]
    );

    const [rows] = await pool.query('SELECT * FROM factures_recurrentes WHERE id = ?', [result.insertId]);
    res.status(201).json({ recurrente: { ...rows[0], lignes: lignesClean } });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /factures-recurrentes/{id}:
 *   put:
 *     summary: Met à jour une facture récurrente (peut aussi servir à l'activer/désactiver via "actif")
 *     tags: [Factures récurrentes]
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
 *             properties:
 *               libelle: { type: string }
 *               frequence: { type: string, enum: [hebdomadaire, mensuelle, annuelle] }
 *               prochaine_date: { type: string, format: date }
 *               remise: { type: number }
 *               frais_livraison: { type: number }
 *               mode_paiement: { type: string, nullable: true }
 *               commentaires: { type: string, nullable: true }
 *               actif: { type: boolean }
 *     responses:
 *       200: { description: "Mise à jour.", content: { application/json: { schema: { type: object, properties: { recurrente: { $ref: '#/components/schemas/FactureRecurrente' } } } } } }
 *       404: { description: "Introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.put('/:id', async (req, res, next) => {
  try {
    const [existingRows] = await pool.query('SELECT * FROM factures_recurrentes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Facture récurrente introuvable.' });

    const { libelle, frequence, prochaine_date, remise, frais_livraison, mode_paiement, commentaires, actif, envoi_auto_email } = req.body;
    const freqValides = ['hebdomadaire', 'mensuelle', 'annuelle'];
    // Même règle qu'à la création (POST ci-dessus) : le libellé est obligatoire — corrige la
    // même incohérence que celle déjà trouvée sur clients/produits/dépenses (une chaîne vide
    // explicite n'était pas rejetée par `libelle ?? existing.libelle`).
    if (libelle !== undefined && !libelle) {
      return res.status(400).json({ error: 'Le libellé est obligatoire.' });
    }

    await pool.query(
      `UPDATE factures_recurrentes SET libelle=?, frequence=?, prochaine_date=?, remise=?, frais_livraison=?, mode_paiement=?, commentaires=?, actif=?, envoi_auto_email=?
       WHERE id = ?`,
      [
        libelle ?? existing.libelle,
        freqValides.includes(frequence) ? frequence : existing.frequence,
        prochaine_date ?? existing.prochaine_date,
        remise !== undefined ? positiveNumber(remise, existing.remise) : existing.remise,
        frais_livraison !== undefined ? positiveNumber(frais_livraison, existing.frais_livraison) : existing.frais_livraison,
        mode_paiement ?? existing.mode_paiement,
        commentaires ?? existing.commentaires,
        actif !== undefined ? (actif ? 1 : 0) : existing.actif,
        envoi_auto_email !== undefined ? (envoi_auto_email ? 1 : 0) : existing.envoi_auto_email,
        existing.id
      ]
    );

    const [rows] = await pool.query('SELECT * FROM factures_recurrentes WHERE id = ?', [existing.id]);
    res.json({ recurrente: { ...rows[0], lignes: JSON.parse(rows[0].lignes_json) } });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /factures-recurrentes/{id}:
 *   delete:
 *     summary: Supprime une facture récurrente (ne supprime pas les factures déjà générées)
 *     tags: [Factures récurrentes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: "Supprimée." }
 *       404: { description: "Introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const [existingRows] = await pool.query('SELECT * FROM factures_recurrentes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!existingRows.length) return res.status(404).json({ error: 'Facture récurrente introuvable.' });
    await pool.query('DELETE FROM factures_recurrentes WHERE id = ?', [existingRows[0].id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /factures-recurrentes/{id}/generer:
 *   post:
 *     summary: Génère immédiatement une facture à partir du modèle récurrent, sans attendre la prochaine échéance automatique
 *     tags: [Factures récurrentes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       201: { description: "Facture générée.", content: { application/json: { schema: { type: object, properties: { facture: { $ref: '#/components/schemas/Facture' } } } } } }
 *       404: { description: "Introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/:id/generer', async (req, res, next) => {
  try {
    const facture = await genererFactureDepuisModele(req.params.id, req.user.id);
    if (!facture) return res.status(404).json({ error: 'Facture récurrente introuvable.' });
    res.status(201).json({ facture });
  } catch (err) { next(err); }
});

/**
 * Transforme un modèle de facture récurrente en une vraie facture, réutilisant la même
 * logique de numérotation atomique que la création manuelle. Exportée pour être appelée
 * aussi bien depuis la route "générer maintenant" que depuis le vérificateur périodique.
 */
async function genererFactureDepuisModele(id, userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // SELECT ... FOR UPDATE verrouille la ligne le temps de la transaction : si le
    // vérificateur périodique et un appel manuel (ou deux workers en mode cluster)
    // tentent de générer la même facture en même temps, le second attend que le premier
    // termine, puis constate que la date a déjà été avancée et ne génère rien en double.
    const [rows] = await conn.query('SELECT * FROM factures_recurrentes WHERE id = ? AND user_id = ? FOR UPDATE', [id, userId]);
    const modele = rows[0];
    if (!modele) {
      await conn.rollback();
      return null;
    }

    const lignes = JSON.parse(modele.lignes_json);
    // Même règle de calcul qu'une facture créée manuellement (voir routes/factures.js) :
    // la remise est répartie au prorata de chaque ligne avant le calcul de la TVA. Avant
    // cette correction, cette fonction dupliquait le calcul en appliquant la TVA sur le HT
    // brut (sans tenir compte de la remise), ce qui surestimait la TVA des factures
    // générées automatiquement dès qu'un modèle récurrent avait une remise configurée.
    const { computedLignes, sous_total, total_tva, total, remise: remiseAppliquee } = computeTotals(lignes, modele.remise, modele.frais_livraison);

    // Numérotation atomique (même mécanisme que POST /api/factures)
    const prefix = 'FAC';
    const year = new Date().getFullYear();
    await conn.query(
      `INSERT INTO compteurs_numerotation (user_id, type, annee, dernier_numero)
       VALUES (?, 'facture', ?, LAST_INSERT_ID(1))
       ON DUPLICATE KEY UPDATE dernier_numero = LAST_INSERT_ID(dernier_numero + 1)`,
      [userId, year]
    );
    const [[{ n }]] = await conn.query('SELECT LAST_INSERT_ID() as n');
    const numero = `${prefix}-${year}-${String(n).padStart(4, '0')}`;

    const [result] = await conn.query(
      `INSERT INTO factures (user_id, client_id, numero, type, date_emission, statut, remise, frais_livraison, mode_paiement, commentaires, sous_total, total_tva, total)
       VALUES (?, ?, ?, 'facture', CURDATE(), 'en_attente', ?, ?, ?, ?, ?, ?, ?)`,
      [userId, modele.client_id, numero, remiseAppliquee, modele.frais_livraison, modele.mode_paiement, modele.commentaires, sous_total, total_tva, total]
    );
    const factureId = result.insertId;

    await insererLignesFacture(conn, factureId, computedLignes);

    const nextDate = addInterval(modele.prochaine_date, modele.frequence);
    await conn.query(
      `UPDATE factures_recurrentes SET prochaine_date = ?, derniere_generation = NOW(), factures_generees = factures_generees + 1 WHERE id = ?`,
      [nextDate, modele.id]
    );

    await conn.commit();
    const [factureRows] = await pool.query('SELECT * FROM factures WHERE id = ?', [factureId]);
    return factureRows[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = router;
module.exports.genererFactureDepuisModele = genererFactureDepuisModele;
