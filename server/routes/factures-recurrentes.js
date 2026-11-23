const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { resolveTenant, requirePermission } = require('../middleware/tenant');
const { positiveNumber, percentage } = require('../utils/validation');
const { computeTotals, insererLignesFacture, ajusterStockFacture, resoudreEntrepotFacture } = require('./factures');
const { reserveMonthlyInvoiceQuota } = require('../utils/invoice-quota');
const { localDateString } = require('../utils/local-date');

const router = express.Router();
function parseBooleanInput(value, fieldName, fallback) {
  if (value === undefined) return fallback;
  if (value === null) return false;
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0' || normalized === '') return false;
  }
  throw new TypeError(fieldName + ' doit être un booléen (true/false).');
}

router.use(requireAuth, resolveTenant, requirePermission);

function parseDateOnly(value) {
  const iso = value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new TypeError('La date doit respecter le format AAAA-MM-JJ.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const normalized = new Date(Date.UTC(year, month - 1, day));
  if (year < 1000 || year > 9999 ||
      normalized.getUTCFullYear() !== year ||
      normalized.getUTCMonth() + 1 !== month ||
      normalized.getUTCDate() !== day) {
    throw new TypeError('La date de facturation est invalide.');
  }
  return { iso, year, month, day };
}

function addInterval(date, frequence, jourAncre) {
  const current = parseDateOnly(date);
  if (frequence === 'hebdomadaire') {
    const next = new Date(Date.UTC(current.year, current.month - 1, current.day + 7));
    return next.toISOString().slice(0, 10);
  }

  const anchor = Number.isInteger(Number(jourAncre)) && Number(jourAncre) >= 1 && Number(jourAncre) <= 31
    ? Number(jourAncre)
    : current.day;
  const monthIndex = current.year * 12 + current.month - 1 +
    (frequence === 'annuelle' ? 12 : 1);
  const nextYear = Math.floor(monthIndex / 12);
  const nextMonth = monthIndex % 12 + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const nextDay = Math.min(anchor, lastDay);
  return new Date(Date.UTC(nextYear, nextMonth - 1, nextDay)).toISOString().slice(0, 10);
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
       JOIN clients c ON c.id = r.client_id AND c.user_id = r.user_id
       WHERE r.user_id = ? ORDER BY r.prochaine_date ASC`,
      [req.tenantId]
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
 *               envoi_auto_email: { type: boolean, default: false }
 *               lignes: { type: array, items: { $ref: '#/components/schemas/LigneFacture' } }
 *     responses:
 *       201: { description: "Créée.", content: { application/json: { schema: { type: object, properties: { recurrente: { $ref: '#/components/schemas/FactureRecurrente' } } } } } }
 *       400: { description: "Champs manquants ou client invalide.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/', async (req, res, next) => {
  try {
    const { client_id, libelle, frequence, prochaine_date, remise, frais_livraison, mode_paiement, commentaires, lignes, envoi_auto_email } = req.body;

    let envoiAutoEmail;
    try {
      envoiAutoEmail = parseBooleanInput(envoi_auto_email, 'envoi_auto_email', false);
    } catch (booleanErr) {
      return res.status(400).json({ error: booleanErr.message });
    }

    if (!client_id || !libelle || !Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({ error: 'Client, libellé et au moins une ligne sont requis.' });
    }
    const [clientRows] = await pool.query('SELECT id FROM clients WHERE id = ? AND user_id = ?', [client_id, req.tenantId]);
    if (!clientRows.length) return res.status(400).json({ error: 'Client invalide.' });

    const freqValides = ['hebdomadaire', 'mensuelle', 'annuelle'];
    if (frequence !== undefined && !freqValides.includes(frequence)) {
      return res.status(400).json({ error: 'Fréquence de facturation invalide.' });
    }
    const freq = frequence || 'mensuelle';

    let prochaineDate;
    try {
      let premiereDate = prochaine_date;
      if (!premiereDate) {
        const [[company]] = await pool.query(
          'SELECT fuseau_horaire FROM users WHERE id = ?',
          [req.tenantId]
        );
        premiereDate = localDateString(company?.fuseau_horaire || 'Africa/Dakar');
      }
      prochaineDate = parseDateOnly(premiereDate).iso;
    } catch (dateErr) {
      return res.status(400).json({ error: dateErr.message });
    }
    const jourAncre = parseDateOnly(prochaineDate).day;

    if (lignes.some(ligne => !ligne || typeof ligne !== 'object' || Array.isArray(ligne))) {
      return res.status(400).json({ error: 'Chaque ligne doit être un objet de facture valide.' });
    }

    // Comme pour la création manuelle, ne conserver le lien catalogue que si le produit
    // appartient bien à l'entreprise courante. Les lignes libres restent facturables.
    const requestedProductIds = [...new Set(lignes
      .map(ligne => Number(ligne.produit_id))
      .filter(id => Number.isSafeInteger(id) && id > 0)
    )];
    const ownedProductIds = new Set();
    if (requestedProductIds.length) {
      const [ownedProducts] = await pool.query(
        `SELECT id FROM produits WHERE user_id = ? AND id IN (${requestedProductIds.map(() => '?').join(',')})`,
        [req.tenantId, ...requestedProductIds]
      );
      for (const product of ownedProducts) ownedProductIds.add(Number(product.id));
    }

    const lignesClean = lignes.map(l => {
      const productId = Number(l.produit_id);
      return {
        produit_id: l.produit_id && Number.isSafeInteger(productId) && ownedProductIds.has(productId)
          ? productId
          : null,
        designation: String(l.designation || '').slice(0, 255),
        quantite: positiveNumber(l.quantite, 1),
        prix_unitaire: positiveNumber(l.prix_unitaire, 0),
        tva: percentage(l.tva, 0)
      };
    });

    const [result] = await pool.query(
      `INSERT INTO factures_recurrentes (user_id, client_id, libelle, frequence, prochaine_date, jour_ancre, remise, frais_livraison, mode_paiement, commentaires, lignes_json, envoi_auto_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.tenantId, client_id, libelle, freq, prochaineDate, jourAncre,
        positiveNumber(remise, 0), positiveNumber(frais_livraison, 0), mode_paiement || null, commentaires || null,
        JSON.stringify(lignesClean), envoiAutoEmail ? 1 : 0
      ]
    );

    const [rows] = await pool.query('SELECT * FROM factures_recurrentes WHERE id = ? AND user_id = ?', [result.insertId, req.tenantId]);
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
 *               envoi_auto_email: { type: boolean }
 *     responses:
 *       200: { description: "Mise à jour.", content: { application/json: { schema: { type: object, properties: { recurrente: { $ref: '#/components/schemas/FactureRecurrente' } } } } } }
 *       404: { description: "Introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.put('/:id', async (req, res, next) => {
  try {
    const [existingRows] = await pool.query('SELECT * FROM factures_recurrentes WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Facture récurrente introuvable.' });

    const { libelle, frequence, prochaine_date, remise, frais_livraison, mode_paiement, commentaires, actif, envoi_auto_email } = req.body;

    let actifValue;
    let envoiAutoEmailValue;
    try {
      actifValue = parseBooleanInput(actif, 'actif', Number(existing.actif) === 1);
      envoiAutoEmailValue = parseBooleanInput(
        envoi_auto_email,
        'envoi_auto_email',
        Number(existing.envoi_auto_email) === 1
      );
    } catch (booleanErr) {
      return res.status(400).json({ error: booleanErr.message });
    }
    const freqValides = ['hebdomadaire', 'mensuelle', 'annuelle'];
    // Même règle qu'à la création (POST ci-dessus) : le libellé est obligatoire — corrige la
    // même incohérence que celle déjà trouvée sur clients/produits/dépenses (une chaîne vide
    // explicite n'était pas rejetée par `libelle ?? existing.libelle`).
    if (libelle !== undefined && !libelle) {
      return res.status(400).json({ error: 'Le libellé est obligatoire.' });
    }
    if (frequence !== undefined && !freqValides.includes(frequence)) {
      return res.status(400).json({ error: 'Fréquence de facturation invalide.' });
    }

    let prochaineDate;
    try {
      prochaineDate = prochaine_date !== undefined
        ? parseDateOnly(prochaine_date).iso
        : parseDateOnly(existing.prochaine_date).iso;
    } catch (dateErr) {
      return res.status(400).json({ error: dateErr.message });
    }
    const jourAncre = prochaine_date !== undefined
      ? parseDateOnly(prochaineDate).day
      : (Number(existing.jour_ancre) || parseDateOnly(prochaineDate).day);

    await pool.query(
      `UPDATE factures_recurrentes SET libelle=?, frequence=?, prochaine_date=?, jour_ancre=?, remise=?, frais_livraison=?, mode_paiement=?, commentaires=?, actif=?, envoi_auto_email=?
       WHERE id = ? AND user_id = ?`,
      [
        libelle ?? existing.libelle,
        frequence ?? existing.frequence,
        prochaineDate,
        jourAncre,
        remise !== undefined ? positiveNumber(remise, existing.remise) : existing.remise,
        frais_livraison !== undefined ? positiveNumber(frais_livraison, existing.frais_livraison) : existing.frais_livraison,
        mode_paiement ?? existing.mode_paiement,
        commentaires ?? existing.commentaires,
        actifValue ? 1 : 0,
        envoiAutoEmailValue ? 1 : 0,
        existing.id, req.tenantId
      ]
    );

    const [rows] = await pool.query('SELECT * FROM factures_recurrentes WHERE id = ? AND user_id = ?', [existing.id, req.tenantId]);
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
    const [existingRows] = await pool.query('SELECT * FROM factures_recurrentes WHERE id = ? AND user_id = ?', [req.params.id, req.tenantId]);
    if (!existingRows.length) return res.status(404).json({ error: 'Facture récurrente introuvable.' });
    await pool.query('DELETE FROM factures_recurrentes WHERE id = ? AND user_id = ?', [existingRows[0].id, req.tenantId]);
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
    const facture = await genererFactureDepuisModele(req.params.id, req.tenantId, { onlyIfDue: false });
    if (!facture) return res.status(404).json({ error: 'Facture récurrente introuvable.' });
    res.status(201).json({ facture });
  } catch (err) {
    if (err?.code === 'QUOTA_DEPASSE') return res.status(403).json({ error: err.message, code: 'QUOTA_DEPASSE' });
    if (err?.code === 'CLIENT_TENANT_MISMATCH') {
      return res.status(409).json({ error: err.message, code: 'CLIENT_TENANT_MISMATCH' });
    }
    next(err);
  }
});

/**
 * Transforme un modèle de facture récurrente en une vraie facture, réutilisant la même
 * logique de numérotation atomique que la création manuelle. Exportée pour être appelée
 * aussi bien depuis la route "générer maintenant" que depuis le vérificateur périodique.
 */
async function genererFactureDepuisModele(id, userId, { onlyIfDue = false } = {}) {
  const conn = await pool.getConnection();
  let transactionCommitted = false;
  try {
    await conn.beginTransaction();
    // Même ordre de verrouillage que les autres créations : compte, puis modèle.
    const [[company]] = await conn.query('SELECT devise, fuseau_horaire FROM users WHERE id = ? FOR UPDATE', [userId]);

    // SELECT ... FOR UPDATE sérialise les générations du même modèle. Le scheduler
    // recontrôle l'échéance après le verrou (onlyIfDue) et saute une échéance déjà traitée.
    // Une action manuelle explicite peut toujours créer une facture supplémentaire.
    const [rows] = await conn.query('SELECT * FROM factures_recurrentes WHERE id = ? AND user_id = ? FOR UPDATE', [id, userId]);
    const modele = rows[0];
    if (!modele) {
      await conn.rollback();
      return null;
    }

    // Défense en profondeur : un modèle historique ou modifié hors API ne doit jamais
    // produire une facture associée au client d'un autre tenant.
    const [clientRows] = await conn.query(
      'SELECT id FROM clients WHERE id = ? AND user_id = ? FOR UPDATE',
      [modele.client_id, userId]
    );
    if (!clientRows.length) {
      const error = new Error('Le client associé au modèle récurrent n’appartient plus à cette entreprise.');
      error.code = 'CLIENT_TENANT_MISMATCH';
      throw error;
    }

    if (onlyIfDue && Number(modele.actif) !== 1) {
      await conn.rollback();
      return null;
    }

    // Un passage du scheduler peut avoir sélectionné ce modèle avant qu'une génération
    // manuelle ou un autre passage n'obtienne le verrou et n'avance l'échéance. Recontrôler
    // la date sous verrou évite de générer une seconde facture pour la même échéance.
    const companyLocalDate = localDateString(company?.fuseau_horaire || 'Africa/Dakar');
    const modeleNextDate = parseDateOnly(modele.prochaine_date).iso;
    const scheduledDateDue = Number(modele.actif) === 1 && modeleNextDate <= companyLocalDate;
    if (onlyIfDue && !scheduledDateDue) {
      await conn.rollback();
      return null;
    }

    const quota = await reserveMonthlyInvoiceQuota(conn, userId);
    if (!quota.allowed) {
      // Le compteur reconstitué est une donnée de quota, pas la facture refusée.
      await conn.commit();
      transactionCommitted = true;
      const error = new Error(`Le plan Gratuit est limité à ${quota.limit} factures par mois.`);
      error.code = 'QUOTA_DEPASSE';
      throw error;
    }

    const documentCurrency = String(company?.devise || 'FCFA').toUpperCase();
    const documentDate = companyLocalDate;

    const lignes = JSON.parse(modele.lignes_json);
    // Même règle de calcul qu'une facture créée manuellement (voir routes/factures.js) :
    // la remise est répartie au prorata de chaque ligne avant le calcul de la TVA. Avant
    // cette correction, cette fonction dupliquait le calcul en appliquant la TVA sur le HT
    // brut (sans tenir compte de la remise), ce qui surestimait la TVA des factures
    // générées automatiquement dès qu'un modèle récurrent avait une remise configurée.
    const { computedLignes, sous_total, total_tva, total, remise: remiseAppliquee } = computeTotals(lignes, modele.remise, modele.frais_livraison);

    // Numérotation atomique (même mécanisme que POST /api/factures)
    const prefix = 'FAC';
    const year = Number(documentDate.slice(0, 4));
    await conn.query(
      `INSERT INTO compteurs_numerotation (user_id, type, annee, dernier_numero)
       VALUES (?, 'facture', ?, LAST_INSERT_ID(1))
       ON DUPLICATE KEY UPDATE dernier_numero = LAST_INSERT_ID(dernier_numero + 1)`,
      [userId, year]
    );
    const [[{ n }]] = await conn.query('SELECT LAST_INSERT_ID() as n');
    const numero = `${prefix}-${year}-${String(n).padStart(4, '0')}`;

    const invoiceWarehouse = await resoudreEntrepotFacture(conn, userId, null);
    if (!invoiceWarehouse) {
      throw new Error('Le magasin principal est introuvable ou inactif pour cette entreprise.');
    }

    const [result] = await conn.query(
      `INSERT INTO factures (user_id, client_id, entrepot_id, numero, type, date_emission, devise, statut, remise, frais_livraison, mode_paiement, commentaires, sous_total, total_tva, total)
       VALUES (?, ?, ?, ?, 'facture', ?, ?, 'en_attente', ?, ?, ?, ?, ?, ?, ?)`,
      [userId, modele.client_id, invoiceWarehouse.id, numero, documentDate, documentCurrency, remiseAppliquee, modele.frais_livraison, modele.mode_paiement, modele.commentaires, sous_total, total_tva, total]
    );
    const factureId = result.insertId;

    await insererLignesFacture(conn, factureId, computedLignes);
    // Le magasin utilisé est mémorisé sur la facture et dans le journal de stock,
    // afin que les annulations et suppressions restituent au bon endroit.
    await ajusterStockFacture(conn, factureId, userId, -1, invoiceWarehouse.id);

    if (scheduledDateDue) {
      const nextDate = addInterval(modele.prochaine_date, modele.frequence, modele.jour_ancre);
      await conn.query(
        `UPDATE factures_recurrentes SET prochaine_date = ?, derniere_generation = NOW(), factures_generees = factures_generees + 1 WHERE id = ? AND user_id = ?`,
        [nextDate, modele.id, userId]
      );
    } else {
      // Une génération manuelle anticipée est une facture supplémentaire : elle ne doit
      // pas décaler l'échéance automatique future du modèle.
      await conn.query(
        `UPDATE factures_recurrentes SET derniere_generation = NOW(), factures_generees = factures_generees + 1 WHERE id = ? AND user_id = ?`,
        [modele.id, userId]
      );
    }

    await conn.commit();
    transactionCommitted = true;
    const [factureRows] = await pool.query('SELECT * FROM factures WHERE id = ?', [factureId]);
    return factureRows[0];
  } catch (err) {
    if (!transactionCommitted) await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = router;
module.exports.genererFactureDepuisModele = genererFactureDepuisModele;
module.exports.addInterval = addInterval;
module.exports.parseDateOnly = parseDateOnly;
