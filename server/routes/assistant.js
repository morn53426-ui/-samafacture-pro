const express = require('express');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const MAX_HISTORIQUE = 20; // nombre de messages précédents rechargés dans le contexte, pour borner le coût par appel
const MAX_TOOL_LOOPS = 5; // garde-fou : empêche un enchaînement d'appels d'outils sans fin (donc un coût sans fin)

function isConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Chaque appel d'outil ci-dessous reçoit `userId` directement depuis req.user.id (jamais
// depuis les paramètres fournis par le modèle) : c'est ce qui garantit qu'une conversation
// ne peut jamais faire fuiter les données d'un autre utilisateur, quoi que le modèle "demande".
const TOOLS = [
  {
    name: 'factures_en_retard',
    description: "Liste les factures impayées dont la date d'échéance est dépassée, avec le nom du client, le numéro, le montant et le nombre de jours de retard. À utiliser pour toute question sur les retards de paiement ou pour préparer une relance.",
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'resume_ventes',
    description: "Donne un résumé chiffré des ventes sur une période : chiffre d'affaires, nombre de factures, dépenses et bénéfice net.",
    input_schema: {
      type: 'object',
      properties: {
        periode: { type: 'string', enum: ['mois_courant', 'mois_dernier', 'annee_courante'], description: 'Période à résumer.' }
      },
      required: ['periode']
    }
  },
  {
    name: 'top_clients',
    description: "Classe les clients par chiffre d'affaires généré (factures uniquement, hors devis), du plus élevé au plus faible.",
    input_schema: {
      type: 'object',
      properties: {
        limite: { type: 'integer', description: 'Nombre de clients à renvoyer (par défaut 5).' }
      },
      required: []
    }
  },
  {
    name: 'prevision_tresorerie',
    description: "Analyse les créances clients attendues à court terme à partir des dates d’échéance. Ces montants ne sont pas des paiements garantis.",
    input_schema: { type: 'object', properties: { horizon_jours: { type: 'integer', enum: [7, 30, 60, 90] } }, required: ['horizon_jours'] }
  },
  {
    name: 'alertes_stock',
    description: "Liste les produits dont le stock atteint ou passe sous le seuil minimum défini par l’entreprise.",
    input_schema: { type: 'object', properties: { limite: { type: 'integer' } }, required: [] }
  },
  {
    name: 'clients_inactifs',
    description: "Identifie les clients sans facture récente et leur dernière activité commerciale pour aider au suivi CRM.",
    input_schema: { type: 'object', properties: { jours_inactivite: { type: 'integer', enum: [30, 60, 90, 180] }, limite: { type: 'integer' } }, required: ['jours_inactivite'] }
  }
];

async function execFacturesEnRetard(userId) {
  const [rows] = await pool.query(
    `SELECT f.numero, f.date_echeance, f.total, c.nom as client,
            DATEDIFF(CURDATE(), f.date_echeance) as jours_retard
     FROM factures f JOIN clients c ON c.id = f.client_id
     WHERE f.user_id = ? AND f.type = 'facture' AND f.statut IN ('en_attente', 'en_retard')
       AND f.date_echeance IS NOT NULL AND f.date_echeance < CURDATE()
     ORDER BY f.date_echeance ASC
     LIMIT 30`,
    [userId]
  );
  return rows;
}

async function execResumeVentes(userId, { periode }) {
  let dateDebut;
  const now = new Date();
  if (periode === 'mois_dernier') {
    dateDebut = `DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)`;
  } else if (periode === 'annee_courante') {
    dateDebut = `DATE_FORMAT(CURDATE(), '%Y-01-01')`;
  } else {
    dateDebut = `DATE_FORMAT(CURDATE(), '%Y-%m-01')`;
  }
  const dateFinSql = periode === 'mois_dernier' ? `DATE_FORMAT(CURDATE(), '%Y-%m-01')` : `DATE_ADD(CURDATE(), INTERVAL 1 DAY)`;

  const [[ventes]] = await pool.query(
    `SELECT COUNT(*) as nb_factures, COALESCE(SUM(total), 0) as chiffre_affaires
     FROM factures WHERE user_id = ? AND type = 'facture'
       AND date_emission >= ${dateDebut} AND date_emission < ${dateFinSql}`,
    [userId]
  );
  const [[depenses]] = await pool.query(
    `SELECT COALESCE(SUM(montant), 0) as total
     FROM depenses WHERE user_id = ? AND date_depense >= ${dateDebut} AND date_depense < ${dateFinSql}`,
    [userId]
  );
  return {
    periode,
    nb_factures: ventes.nb_factures,
    chiffre_affaires: Number(ventes.chiffre_affaires),
    depenses: Number(depenses.total),
    benefice_net: Number(ventes.chiffre_affaires) - Number(depenses.total)
  };
}

async function execTopClients(userId, { limite }) {
  const n = Math.min(Math.max(Number(limite) || 5, 1), 20);
  const [rows] = await pool.query(
    `SELECT c.nom as client, COUNT(*) as nb_factures, COALESCE(SUM(f.total), 0) as total
     FROM factures f JOIN clients c ON c.id = f.client_id
     WHERE f.user_id = ? AND f.type = 'facture'
     GROUP BY c.id, c.nom ORDER BY total DESC LIMIT ?`,
    [userId, n]
  );
  return rows;
}

async function execPrevisionTresorerie(userId, { horizon_jours }) {
  const horizon = [7, 30, 60, 90].includes(Number(horizon_jours)) ? Number(horizon_jours) : 30;
  const [[summary]] = await pool.query(
    "SELECT COALESCE(SUM(CASE WHEN date_echeance < CURDATE() THEN total - montant_paye ELSE 0 END),0) AS deja_en_retard, COALESCE(SUM(CASE WHEN date_echeance >= CURDATE() AND date_echeance <= DATE_ADD(CURDATE(), INTERVAL ? DAY) THEN total - montant_paye ELSE 0 END),0) AS attendu_horizon, COUNT(CASE WHEN date_echeance BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY) THEN 1 END) AS nb_echeances FROM factures WHERE user_id = ? AND type = 'facture' AND statut IN ('en_attente','en_retard') AND total > montant_paye AND date_echeance IS NOT NULL",
    [horizon, horizon, userId]
  );
  return {
    horizon_jours: horizon,
    creances_en_retard: Number(summary.deja_en_retard),
    creances_a_echeance: Number(summary.attendu_horizon),
    nombre_echeances: Number(summary.nb_echeances),
    avertissement: 'Créances attendues uniquement : elles ne constituent pas une prévision de trésorerie garantie et ne tiennent pas compte des décaissements futurs.'
  };
}

async function execAlertesStock(userId, { limite }) {
  const n = Math.min(Math.max(Number(limite) || 20, 1), 100);
  const [rows] = await pool.query(
    'SELECT nom, reference, stock, stock_minimum, prix_achat FROM produits WHERE user_id = ? AND stock_minimum > 0 AND stock <= stock_minimum ORDER BY (stock_minimum-stock) DESC, nom ASC LIMIT ?',
    [userId, n]
  );
  return rows.map(row => ({
    produit: row.nom,
    reference: row.reference,
    stock_actuel: Number(row.stock),
    seuil_minimum: Number(row.stock_minimum),
    quantite_a_reapprovisionner: Math.max(0, Number(row.stock_minimum) - Number(row.stock)),
    prix_achat: Number(row.prix_achat)
  }));
}

async function execClientsInactifs(userId, { jours_inactivite, limite }) {
  const days = [30, 60, 90, 180].includes(Number(jours_inactivite)) ? Number(jours_inactivite) : 60;
  const n = Math.min(Math.max(Number(limite) || 20, 1), 100);
  const [rows] = await pool.query(
    'SELECT c.nom AS client, c.email, MAX(f.date_emission) AS derniere_facture, COALESCE(SUM(CASE WHEN f.type = "facture" THEN f.total - f.montant_paye ELSE 0 END),0) AS solde_du, DATEDIFF(CURDATE(), COALESCE(MAX(f.date_emission), c.created_at)) AS jours_sans_activite FROM clients c LEFT JOIN factures f ON f.client_id = c.id AND f.user_id = c.user_id WHERE c.user_id = ? GROUP BY c.id, c.nom, c.email, c.created_at HAVING jours_sans_activite >= ? ORDER BY derniere_facture ASC LIMIT ?',
    [userId, days, n]
  );
  return rows.map(row => ({ ...row, solde_du: Number(row.solde_du), jours_sans_activite: Number(row.jours_sans_activite) }));
}

async function executerOutil(name, input, userId) {
  switch (name) {
    case 'factures_en_retard': return execFacturesEnRetard(userId);
    case 'resume_ventes': return execResumeVentes(userId, input || {});
    case 'top_clients': return execTopClients(userId, input || {});
    case 'prevision_tresorerie': return execPrevisionTresorerie(userId, input || {});
    case 'alertes_stock': return execAlertesStock(userId, input || {});
    case 'clients_inactifs': return execClientsInactifs(userId, input || {});
    default: return { error: `Outil inconnu : ${name}` };
  }
}

function systemPrompt(nomEntreprise) {
  return `Tu es l'Assistant Comptable de SamaFacture Pro, une application de facturation pour les commerçants, artisans et PME d'Afrique de l'Ouest. Tu aides l'utilisateur de l'entreprise "${nomEntreprise || 'cette entreprise'}" à comprendre ses finances, à obtenir des conseils pratiques et à rédiger des messages de relance.

Règles importantes :
- Réponds toujours en français, de façon concise et actionnable.
- Les montants sont en Francs CFA (FCFA).
- Utilise les outils fournis pour obtenir les vrais chiffres de l'entreprise avant de répondre à toute question sur ses factures, ventes ou clients — ne devine jamais un montant.
- Tu n'es ni comptable agréé ni conseiller fiscal : pour toute question de fiscalité ou de droit des affaires, invite l'utilisateur à consulter un professionnel plutôt que de donner une réponse définitive.
- Pour une relance de facture impayée, reste courtois et professionnel, jamais menaçant.`;
}

async function appelerClaude(messages, system) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system,
      messages,
      tools: TOOLS
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Anthropic API ${response.status} : ${detail.slice(0, 300)}`);
  }
  return response.json();
}

// Limite dédiée : chaque message coûte un appel API payant, donc plus stricte que la
// limite générale de l'application (voir app.js).
const assistantLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || req.ip),
  message: { error: "Trop de messages envoyés à l'assistant en peu de temps. Réessayez dans quelques minutes." }
});

/**
 * @openapi
 * /assistant/conversations:
 *   get:
 *     summary: Liste les conversations de l'Assistant Comptable (les plus récentes en premier)
 *     tags: [Assistant IA]
 *     responses:
 *       200:
 *         description: Liste des conversations.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { conversations: { type: array, items: { $ref: '#/components/schemas/AssistantConversation' } } } }
 */
router.get('/conversations', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, titre, updated_at FROM assistant_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json({ conversations: rows });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /assistant/conversations/{id}:
 *   get:
 *     summary: Détail d'une conversation avec l'Assistant Comptable (tous ses messages)
 *     tags: [Assistant IA]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Conversation et ses messages.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversation: { $ref: '#/components/schemas/AssistantConversation' }
 *                 messages: { type: array, items: { $ref: '#/components/schemas/AssistantMessage' } }
 *       404: { description: "Conversation introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.get('/conversations/:id', async (req, res, next) => {
  try {
    const [convRows] = await pool.query(
      'SELECT id, titre FROM assistant_conversations WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!convRows.length) return res.status(404).json({ error: 'Conversation introuvable.' });

    const [messages] = await pool.query(
      'SELECT id, role, contenu, created_at FROM assistant_messages WHERE conversation_id = ? ORDER BY id ASC',
      [req.params.id]
    );
    res.json({ conversation: convRows[0], messages });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /assistant/conversations/{id}:
 *   delete:
 *     summary: Supprime une conversation avec l'Assistant Comptable (et ses messages)
 *     tags: [Assistant IA]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: "Supprimée." }
 *       404: { description: "Conversation introuvable.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.delete('/conversations/:id', async (req, res, next) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM assistant_conversations WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Conversation introuvable.' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /assistant/message:
 *   post:
 *     summary: Envoie un message à l'Assistant Comptable (Claude, Anthropic) et reçoit sa réponse
 *     description: "L'assistant peut interroger automatiquement les vraies données du compte (factures en retard, résumé des ventes, top clients) via des outils internes strictement limités à l'utilisateur authentifié. Nécessite ANTHROPIC_API_KEY configurée côté serveur. Limité à 30 messages / 10 minutes par utilisateur."
 *     tags: [Assistant IA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string, maxLength: 4000 }
 *               conversation_id: { type: integer, nullable: true, description: "Omis pour démarrer une nouvelle conversation." }
 *     responses:
 *       200:
 *         description: Réponse de l'assistant.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { conversation_id: { type: integer }, reponse: { type: string } } }
 *       400: { description: "Message vide ou trop long.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 *       429: { description: "Trop de messages envoyés en peu de temps.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 *       502: { description: "Assistant momentanément indisponible.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 *       503: { description: "Assistant IA non configuré sur ce serveur.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/message', assistantLimiter, async (req, res, next) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ error: "L'Assistant IA n'est pas encore configuré sur ce serveur (clé ANTHROPIC_API_KEY manquante)." });
    }

    const { conversation_id, message } = req.body;
    const texte = (message || '').trim();
    if (!texte) return res.status(400).json({ error: 'Message vide.' });
    if (texte.length > 4000) return res.status(400).json({ error: 'Message trop long (4000 caractères maximum).' });

    let conversationId = conversation_id || null;
    if (conversationId) {
      const [rows] = await pool.query(
        'SELECT id FROM assistant_conversations WHERE id = ? AND user_id = ?',
        [conversationId, req.user.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Conversation introuvable.' });
    } else {
      const titre = texte.slice(0, 60);
      const [result] = await pool.query(
        'INSERT INTO assistant_conversations (user_id, titre) VALUES (?, ?)',
        [req.user.id, titre]
      );
      conversationId = result.insertId;
    }

    await pool.query(
      "INSERT INTO assistant_messages (conversation_id, role, contenu) VALUES (?, 'user', ?)",
      [conversationId, texte]
    );

    const [historique] = await pool.query(
      'SELECT role, contenu FROM assistant_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?',
      [conversationId, MAX_HISTORIQUE]
    );
    historique.reverse();

    const [[user]] = await pool.query('SELECT entreprise_nom FROM users WHERE id = ?', [req.user.id]);
    const system = systemPrompt(user?.entreprise_nom);

    let messages = historique.map(m => ({ role: m.role, content: m.contenu }));
    let reponseTexte = '';

    for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
      const data = await appelerClaude(messages, system);
      const toolUses = data.content.filter(b => b.type === 'tool_use');

      if (!toolUses.length) {
        reponseTexte = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
        break;
      }

      messages.push({ role: 'assistant', content: data.content });
      const toolResults = [];
      for (const tu of toolUses) {
        let resultat;
        try {
          resultat = await executerOutil(tu.name, tu.input, req.user.id);
        } catch (err) {
          resultat = { error: err.message };
        }
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(resultat) });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    if (!reponseTexte) {
      reponseTexte = "Désolé, je n'ai pas pu terminer de traiter votre demande. Pouvez-vous reformuler ?";
    }

    await pool.query(
      "INSERT INTO assistant_messages (conversation_id, role, contenu) VALUES (?, 'assistant', ?)",
      [conversationId, reponseTexte]
    );
    await pool.query('UPDATE assistant_conversations SET updated_at = NOW() WHERE id = ?', [conversationId]);

    res.json({ conversation_id: conversationId, reponse: reponseTexte });
  } catch (err) {
    console.error("Erreur Assistant IA :", err.message);
    res.status(502).json({ error: "L'assistant est momentanément indisponible. Réessayez dans un instant." });
  }
});

module.exports = router;
