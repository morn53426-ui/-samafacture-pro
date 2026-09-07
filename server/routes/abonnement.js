const express = require('express');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { captureException } = require('../config/monitoring');
const {
  waveConfigured, paydunyaConfigured,
  creerSessionWave, verifierSignatureWave, consulterSessionWave,
  creerFacturePaydunya, verifierHashPaydunya, confirmerFacturePaydunya
} = require('../config/payments');

const router = express.Router();

// Tarifs des plans payants (FCFA / mois). À ajuster selon votre marché — ce sont des
// valeurs de départ raisonnables pour des PME/commerçants d'Afrique de l'Ouest.
const TARIFS = {
  starter: 5000,
  pro: 15000,
  entreprise: 35000
};

function baseUrl(req) {
  return (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

// Indique au frontend quels moyens de paiement afficher (les boutons restent masqués
// tant que les clés correspondantes ne sont pas renseignées dans .env).
/**
 * @openapi
 * /abonnement/moyens-disponibles:
 *   get:
 *     summary: Indique quels moyens de paiement sont configurés côté serveur, et les tarifs des plans
 *     tags: [Abonnement]
 *     responses:
 *       200:
 *         description: Disponibilité et tarifs.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 wave: { type: boolean }
 *                 paydunya: { type: boolean }
 *                 tarifs: { type: object, properties: { starter: { type: integer }, pro: { type: integer }, entreprise: { type: integer } } }
 */
router.get('/moyens-disponibles', requireAuth, (req, res) => {
  res.json({
    wave: waveConfigured(),
    paydunya: paydunyaConfigured(),
    tarifs: TARIFS
  });
});

// Démarre un paiement d'abonnement : crée une session chez le fournisseur choisi et
// renvoie l'URL de paiement vers laquelle rediriger l'utilisateur.
/**
 * @openapi
 * /abonnement/payer:
 *   post:
 *     summary: Démarre un paiement d'abonnement (crée une session chez Wave ou PayDunya)
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
 *       200:
 *         description: URL de paiement à ouvrir.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { checkout_url: { type: string }, reference: { type: string } } }
 *       400: { description: "Plan invalide ou fournisseur non configuré.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/payer', requireAuth, async (req, res, next) => {
  try {
    const { plan, fournisseur } = req.body;
    if (!TARIFS[plan]) return res.status(400).json({ error: 'Plan invalide.' });
    if (!['wave', 'paydunya'].includes(fournisseur)) return res.status(400).json({ error: 'Moyen de paiement invalide.' });
    if (fournisseur === 'wave' && !waveConfigured()) return res.status(503).json({ error: "Le paiement Wave n'est pas configuré sur ce serveur." });
    if (fournisseur === 'paydunya' && !paydunyaConfigured()) return res.status(503).json({ error: "Le paiement par Orange Money / carte n'est pas configuré sur ce serveur." });

    const montant = TARIFS[plan];
    const reference = crypto.randomBytes(16).toString('hex');

    const [result] = await pool.query(
      `INSERT INTO abonnement_paiements (user_id, plan, montant, devise, fournisseur, reference, internal_reference, statut)
       VALUES (?, ?, ?, 'XOF', ?, ?, ?, 'en_attente')`,
      [req.user.id, plan, montant, fournisseur, reference, reference]
    );

    const retourUrl = `${baseUrl(req)}/abonnement-retour.html?ref=${reference}`;

    let checkoutUrl;
    try {
      if (fournisseur === 'wave') {
        const session = await creerSessionWave({
          amount: montant,
          reference,
          successUrl: retourUrl,
          errorUrl: retourUrl
        });
        checkoutUrl = session.checkoutUrl;
        // La référence Wave (session.id) remplace notre référence interne : c'est elle qui
        // reviendra dans le webhook, il faut donc pouvoir retrouver la ligne grâce à elle.
        await pool.query('UPDATE abonnement_paiements SET reference = ? WHERE id = ?', [session.sessionId || reference, result.insertId]);
      } else {
        const invoice = await creerFacturePaydunya({
          amount: montant,
          description: `Abonnement SamaFacture Pro — Plan ${plan}`,
          reference,
          storeName: req.user.nom,
          returnUrl: retourUrl,
          cancelUrl: retourUrl,
          callbackUrl: `${baseUrl(req)}/api/abonnement/webhook/paydunya`
        });
        checkoutUrl = invoice.checkoutUrl;
        await pool.query('UPDATE abonnement_paiements SET reference = ? WHERE id = ?', [invoice.token, result.insertId]);
      }
    } catch (providerErr) {
      // La session n'a pas pu être créée chez le fournisseur : on marque la tentative comme
      // échouée plutôt que de laisser une ligne "en_attente" fantôme (qui ne recevra jamais
      // de webhook, puisque aucune session réelle n'existe côté fournisseur).
      await pool.query(`UPDATE abonnement_paiements SET statut = 'echouee' WHERE id = ?`, [result.insertId]);
      throw providerErr;
    }

    res.json({ checkout_url: checkoutUrl, reference });
  } catch (err) { next(err); }
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

/** Marque un paiement comme réglé et met à jour le plan de l'utilisateur. Idempotent et
 *  protégé contre les traitements concurrents (deux webhooks/retries simultanés) grâce à
 *  la clause `AND statut != 'payee'` : un seul appel effectue réellement la mise à jour,
 *  même si plusieurs arrivent en même temps pour la même référence. */
async function confirmerPaiement(paiement, montantConfirme) {
  if (paiement.statut === 'payee') return;

  // Vérifie que le montant confirmé par le fournisseur correspond à celui du plan facturé
  // (défense en profondeur : le montant est déjà fixé côté serveur à la création, mais on
  // ne fait jamais confiance uniquement à ce que renvoie un tiers). Si le fournisseur ne
  // transmet pas de montant exploitable, on ne bloque pas (montantConfirme undefined).
  if (montantConfirme !== undefined && Math.round(montantConfirme) !== Math.round(Number(paiement.montant))) {
    console.error(`⚠️  Montant du webhook (${montantConfirme}) différent du montant attendu (${paiement.montant}) pour le paiement #${paiement.id} — traitement refusé.`);
    // Signalé à Sentry : un montant qui ne correspond pas peut indiquer une tentative de
    // fraude (webhook forgé) ou un changement d'API chez le fournisseur — dans les deux
    // cas, ça mérite une alerte plutôt qu'une ligne de log qui passe inaperçue.
    captureException(new Error(`Montant webhook incohérent pour le paiement #${paiement.id} (${paiement.fournisseur}) : reçu ${montantConfirme}, attendu ${paiement.montant}`));
    return;
  }

  const [result] = await pool.query(
    `UPDATE abonnement_paiements SET statut = 'payee', paid_at = NOW() WHERE id = ? AND statut != 'payee'`,
    [paiement.id]
  );
  if (result.affectedRows) {
    await pool.query('UPDATE users SET plan = ? WHERE id = ?', [paiement.plan, paiement.user_id]);
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
