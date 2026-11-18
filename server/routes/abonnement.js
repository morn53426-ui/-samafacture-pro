const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { captureException } = require('../config/monitoring');
const {
  waveConfigured, verifierSignatureWave, consulterSessionWave,
  verifierHashPaydunya, confirmerFacturePaydunya
} = require('../config/payments');

const router = express.Router();

// Indique au frontend quels moyens de paiement afficher (les boutons restent masqués
// tant que les clés correspondantes ne sont pas renseignées dans .env).
/**
 * @openapi
 * /abonnement/moyens-disponibles:
 *   get:
 *     summary: Décrit la disponibilité du paiement mensuel des plans
 *     tags: [Abonnement]
 *     responses:
 *       200:
 *         description: Disponibilité et tarifs.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 wave:
 *                   type: boolean
 *                 paydunya:
 *                   type: boolean
 *                 tarifs:
 *                   type: object
 *                   properties:
 *                     starter:
 *                       type: integer
 *                     pro:
 *                       type: integer
 *                     entreprise:
 *                       type: integer
 *                 facturation:
 *                   type: object
 *                   properties:
 *                     mode:
 *                       type: string
 *                       enum: [mensuel_renouvellement_automatique_en_preparation]
 *                     renouvellement_automatique:
 *                       type: boolean
 *                     expiration_automatique:
 *                       type: boolean
 *                     acces_jusqua_changement_manuel:
 *                       type: boolean
 *                     activation:
 *                       type: string
 *                       enum: [apres_confirmation]
 *                     disponible:
 *                       type: boolean
 */
router.get('/moyens-disponibles', requireAuth, (req, res) => {
  res.json({
    // Le checkout actuellement intégré par Wave/PayDunya est ponctuel : ne pas afficher
    // ses boutons tant que le renouvellement mensuel autorisé n'est pas opérationnel.
    wave: false,
    paydunya: false,
    tarifs: {},
    facturation: {
      mode: 'mensuel_renouvellement_automatique_en_preparation',
      renouvellement_automatique: true,
      expiration_automatique: false,
      acces_jusqua_changement_manuel: false,
      activation: 'apres_confirmation',
      disponible: false
    }
  });
});

// Prépare la demande de paiement mensuel. Aucun checkout ponctuel ne doit être utilisé
// comme substitut d'un mandat récurrent autorisé par le prestataire.
/**
 * @openapi
 * /abonnement/payer:
 *   post:
 *     summary: Refuse temporairement la souscription tant que le paiement récurrent n'est pas disponible
 *     tags: [Abonnement]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan, fournisseur]
 *             properties:
 *               plan: { type: string, enum: [starter, pro, entreprise] }
 *               fournisseur: { type: string, enum: [wave, paydunya] }
 *     responses:
 *       400: { description: "Plan ou moyen de paiement invalide.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 *       503: { description: "Le renouvellement automatique n'est pas encore disponible ; aucun paiement n'est lancé.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/payer', requireAuth, async (req, res) => {
  const { plan, fournisseur } = req.body || {};
  if (!['starter', 'pro', 'entreprise'].includes(plan)) {
    return res.status(400).json({ error: 'Plan invalide.' });
  }
  if (!['wave', 'paydunya'].includes(fournisseur)) {
    return res.status(400).json({ error: 'Moyen de paiement invalide.' });
  }

  return res.status(503).json({
    error: 'Les formules payantes sont prévues au mois avec renouvellement automatique. Le prestataire ne confirme pas encore un mandat de débit récurrent utilisable par OptiGest ; aucun paiement ponctuel ne sera lancé.',
    code: 'PAIEMENT_RECURRENT_NON_CONFIGURE'
  });
});

// Statut d'un paiement (utilisé par la page de retour pour afficher la confirmation).
// On filtre sur internal_reference (stable, générée par nos soins) et non sur `reference`
// (écrasée par l'identifiant du fournisseur une fois la session créée — voir schema.sql).
/**
 * @openapi
 * /abonnement/statut/{reference}:
 *   get:
 *     summary: Statut d'un paiement d'abonnement (utilisé par la page de retour après paiement)
 *     description: "Si le paiement est encore en attente et vient de Wave, une vérification directe auprès de Wave est faite avant de répondre (le webhook peut mettre quelques secondes à arriver)."
 *     tags: [Abonnement]
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema: { type: string }
 *         description: "Référence interne renvoyée par /abonnement/payer (pas la référence du fournisseur)."
 *     responses:
 *       200:
 *         description: Statut du paiement.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { statut: { type: string, enum: [en_attente, payee, echouee, expiree] }, plan: { type: string } } }
 *       404: { description: "Paiement introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.get('/statut/:reference', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM abonnement_paiements WHERE user_id = ? AND internal_reference = ? ORDER BY id DESC LIMIT 1',
      [req.user.id, req.params.reference]
    );
    const paiement = rows[0];
    if (!paiement) return res.status(404).json({ error: 'Paiement introuvable.' });

    // Wave n'envoie pas toujours son webhook instantanément : on vérifie aussi directement
    // auprès de Wave par sécurité si le paiement est encore marqué "en attente".
    if (paiement.statut === 'en_attente' && paiement.fournisseur === 'wave' && waveConfigured()) {
      const session = await consulterSessionWave(paiement.reference);
      if (session?.status === 'completed') {
        await confirmerPaiement(paiement, session.amount !== undefined ? Number(session.amount) : undefined);
        const [[refreshed]] = await pool.query('SELECT statut FROM abonnement_paiements WHERE id = ?', [paiement.id]);
        paiement.statut = refreshed?.statut || paiement.statut;
      }
    }

    res.json({ statut: paiement.statut, plan: paiement.plan });
  } catch (err) { next(err); }
});

/** Confirme un paiement et active son plan dans une transaction SQL unique.
 * Le verrou FOR UPDATE sérialise les webhooks concurrents ; le statut et le plan sont
 * validés ensemble ou aucun des deux n'est enregistré. Le montant doit être fourni par
 * le fournisseur et correspondre au prix attendu : une absence de montant n'est jamais
 * considérée comme une confirmation valide. */
async function confirmerPaiement(paiement, montantConfirme) {
  const montantAttendu = Number(paiement?.montant);
  const montantRecu = montantConfirme === undefined || montantConfirme === null
    ? NaN
    : Number(montantConfirme);

  if (!Number.isFinite(montantRecu) || !Number.isFinite(montantAttendu) ||
      Math.round(montantRecu) !== Math.round(montantAttendu)) {
    const erreur = new Error(
      `Montant de paiement absent ou incohérent pour le paiement #${paiement?.id} (${paiement?.fournisseur}) : reçu ${montantConfirme}, attendu ${paiement?.montant}`
    );
    console.error('⚠️ ', erreur.message, '— traitement refusé.');
    captureException(erreur);
    return false;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT * FROM abonnement_paiements WHERE id = ? FOR UPDATE',
      [paiement.id]
    );
    const courant = rows[0];

    // Un webhook rejoué ou une tentative échouée ne doit pas réactiver un plan.
    // Une tentative locale expirée peut toutefois avoir été payée juste avant l'expiration :
    // le statut fournisseur signé et le montant viennent d'être vérifiés, on accepte donc
    // aussi 'expiree' pour éviter de perdre un règlement dont le callback arrive en retard.
    if (!courant || !['en_attente', 'expiree'].includes(courant.statut)) {
      await conn.commit();
      return false;
    }

    const montantEnBase = Number(courant.montant);
    if (!Number.isFinite(montantEnBase) ||
        Math.round(montantRecu) !== Math.round(montantEnBase) ||
        courant.devise !== 'XOF') {
      await conn.rollback();
      const erreur = new Error(
        `Paiement #${courant.id} rejeté : montant ou devise non conforme (reçu ${montantRecu} ${courant.devise}, attendu ${courant.montant} XOF).`
      );
      console.error('⚠️ ', erreur.message);
      captureException(erreur);
      return false;
    }

    const [paymentUpdate] = await conn.query(
      "UPDATE abonnement_paiements SET statut = 'payee', paid_at = NOW() WHERE id = ? AND statut IN ('en_attente', 'expiree')",
      [courant.id]
    );
    if (paymentUpdate.affectedRows !== 1) {
      await conn.rollback();
      return false;
    }

    // Vérifier l'existence de l'utilisateur séparément : MySQL rapporte affectedRows=0
    // lorsque le plan est déjà identique. Un renouvellement payé du même plan doit réussir.
    const [userRows] = await conn.query(
      'SELECT id FROM users WHERE id = ? FOR UPDATE',
      [courant.user_id]
    );
    if (!userRows.length) {
      throw new Error(`Utilisateur #${courant.user_id} introuvable après paiement #${courant.id}.`);
    }
    await conn.query(
      'UPDATE users SET plan = ? WHERE id = ?',
      [courant.plan, courant.user_id]
    );

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

// --- Webhook Wave ---
// Monté sans authentification (Wave n'a pas de jeton de session utilisateur), la sécurité
// repose entièrement sur la vérification de signature HMAC ci-dessous.
/**
 * @openapi
 * /abonnement/webhook/wave:
 *   post:
 *     summary: "Callback Wave (réservé à Wave — non destiné à un appel manuel)"
 *     description: "Non authentifié par JWT : la sécurité repose entièrement sur la signature HMAC envoyée par Wave dans l'en-tête Wave-Signature, vérifiée avant tout traitement."
 *     tags: [Abonnement]
 *     security: []
 *     responses:
 *       200: { description: "Événement traité." }
 *       401: { description: "Signature invalide.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/webhook/wave', async (req, res) => {
  const signature = req.headers['wave-signature'];
  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);

  if (!verifierSignatureWave(rawBody, signature)) {
    console.warn('⚠️  Webhook Wave reçu avec une signature invalide — ignoré.');
    return res.status(401).json({ error: 'Signature invalide.' });
  }

  try {
    const event = req.body;
    if (event.event === 'checkout.session.completed' && event.data?.status === 'completed') {
      const [rows] = await pool.query('SELECT * FROM abonnement_paiements WHERE reference = ?', [event.data.id]);
      if (rows[0]) {
        const montant = event.data.amount !== undefined ? Number(event.data.amount) : undefined;
        await confirmerPaiement(rows[0], montant);
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Erreur traitement webhook Wave :', err.message);
    captureException(err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// --- IPN PayDunya ---
/**
 * @openapi
 * /abonnement/webhook/paydunya:
 *   post:
 *     summary: "Callback PayDunya / IPN (réservé à PayDunya — non destiné à un appel manuel)"
 *     description: "Non authentifié par JWT : la sécurité repose sur la vérification du hash renvoyé dans la notification, recalculé et comparé côté serveur."
 *     tags: [Abonnement]
 *     security: []
 *     responses:
 *       200: { description: "Notification traitée." }
 */
router.post('/webhook/paydunya', async (req, res) => {
  try {
    // PayDunya envoie du form-urlencoded ; certaines intégrations reçoivent le nœud "data"
    // déjà sous forme d'objet (parsing imbriqué), d'autres sous forme de texte JSON brut.
    let data = req.body?.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { data = null; }
    }
    if (!data) return res.status(400).json({ error: 'Corps de notification invalide.' });

    if (!verifierHashPaydunya(data.hash)) {
      console.warn('⚠️  IPN PayDunya reçu avec un hash invalide — ignoré.');
      return res.status(401).json({ error: 'Hash invalide.' });
    }

    if (data.status === 'completed') {
      const token = data.invoice?.token || data.token;
      const [rows] = await pool.query('SELECT * FROM abonnement_paiements WHERE reference = ?', [token]);
      if (rows[0]) {
        // Le hash IPN n'authentifie pas le contenu de la notification (voir commentaire dans
        // config/payments.js) : on ne fait donc jamais confiance directement à data.status /
        // data.invoice.total_amount. On revérifie le statut réel auprès de PayDunya avant de
        // créditer quoi que ce soit.
        const confirmation = await confirmerFacturePaydunya(token);
        if (confirmation?.status === 'completed') {
          const montantBrut = confirmation.invoice?.total_amount;
          const montant = montantBrut !== undefined ? Number(montantBrut) : undefined;
          await confirmerPaiement(rows[0], montant);
        } else {
          console.warn(`⚠️  IPN PayDunya "completed" mais la confirmation serveur-à-serveur ne le confirme pas (token ${token}) — traitement refusé.`);
        }
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Erreur traitement IPN PayDunya :', err.message);
    captureException(err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// Exposé uniquement pour les tests (tests/paiements.test.js), afin de vérifier
// l'idempotence et la validation de montant sans dépendre des API externes Wave/PayDunya.
router.confirmerPaiementPourTests = confirmerPaiement;

module.exports = router;
