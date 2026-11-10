const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { isValidImageDataUrl } = require('../utils/validation');
const { isProPlan, isEnterprisePlan, PRO_TEMPLATES, ENTERPRISE_TEMPLATES } = require('../utils/plans');
const { sendMail } = require('../config/mailer');

const router = express.Router();
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

// Personnalisation des modèles de facture (couleurs / logo / police) — voir la même liste de clés
// et la même logique de validation côté client dans public/js/facture-templates.js
// (sanitizeCssColor, LOGO_ECHELLES, POLICES_AUTORISEES...). Les deux doivent rester synchronisées :
// une clé acceptée ici mais inconnue du moteur de rendu serait enregistrée sans jamais s'afficher.
const COULEUR_HEX_OU_RGB = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$|^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/;
const POLICES_VALIDES = ['defaut', 'sans', 'serif', 'mono'];
const TAILLES_TEXTE_VALIDES = ['petit', 'normal', 'grand'];
const EPAISSEURS_TEXTE_VALIDES = ['normal', 'moyen', 'gras'];
const LOGO_TAILLES_VALIDES = ['petit', 'moyen', 'grand'];

/**
 * Valide et nettoie l'objet de personnalisation envoyé par le client. Contrairement au moteur de
 * rendu (qui ignore silencieusement une valeur invalide par défense en profondeur), l'API rejette
 * la requête avec une erreur 400 explicite : l'utilisateur doit savoir que sa couleur n'a pas été
 * enregistrée plutôt que de le découvrir en regardant sa facture.
 * @returns {{ error: string }|{ cleaned: object|null }}
 */
function validerPersonnalisation(personnalisation) {
  if (personnalisation === undefined || personnalisation === null) return { cleaned: null };
  if (typeof personnalisation !== 'object' || Array.isArray(personnalisation)) {
    return { error: 'Format de personnalisation invalide.' };
  }
  const cleaned = {};
  for (const cle of ['couleur_principale', 'couleur_secondaire', 'couleur_texte']) {
    const v = personnalisation[cle];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v !== 'string' || !COULEUR_HEX_OU_RGB.test(v.trim())) {
      return { error: `Couleur invalide pour "${cle}" (attendu : #rrggbb ou rgb(...)).` };
    }
    cleaned[cle] = v.trim();
  }
  if (personnalisation.police !== undefined && personnalisation.police !== null && personnalisation.police !== '') {
    if (!POLICES_VALIDES.includes(personnalisation.police)) {
      return { error: `Police invalide (attendu : ${POLICES_VALIDES.join(', ')}).` };
    }
    cleaned.police = personnalisation.police;
  }
  if (personnalisation.taille_texte !== undefined && personnalisation.taille_texte !== null && personnalisation.taille_texte !== '') {
    if (!TAILLES_TEXTE_VALIDES.includes(personnalisation.taille_texte)) {
      return { error: `Taille de texte invalide (attendu : ${TAILLES_TEXTE_VALIDES.join(', ')}).` };
    }
    cleaned.taille_texte = personnalisation.taille_texte;
  }
  if (personnalisation.epaisseur_texte !== undefined && personnalisation.epaisseur_texte !== null && personnalisation.epaisseur_texte !== '') {
    if (!EPAISSEURS_TEXTE_VALIDES.includes(personnalisation.epaisseur_texte)) {
      return { error: `Épaisseur de texte invalide (attendu : ${EPAISSEURS_TEXTE_VALIDES.join(', ')}).` };
    }
    cleaned.epaisseur_texte = personnalisation.epaisseur_texte;
  }
  if (personnalisation.logo_taille !== undefined && personnalisation.logo_taille !== null && personnalisation.logo_taille !== '') {
    if (!LOGO_TAILLES_VALIDES.includes(personnalisation.logo_taille)) {
      return { error: `Taille de logo invalide (attendu : ${LOGO_TAILLES_VALIDES.join(', ')}).` };
    }
    cleaned.logo_taille = personnalisation.logo_taille;
  }
  return { cleaned: Object.keys(cleaned).length ? cleaned : null };
}

// Anti brute-force : limite les tentatives de connexion par adresse IP.
// Les tentatives réussies ne comptent pas dans le quota, seuls les échecs.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Veuillez réessayer dans quelques minutes.' }
});

// Limite aussi les créations de compte pour éviter la génération massive de comptes.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de comptes créés depuis cette adresse. Veuillez réessayer plus tard.' }
});

// Limite les demandes de réinitialisation de mot de passe (évite le spam d'emails).
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de demandes. Veuillez réessayer dans quelques minutes.' }
});

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, nom: user.nom, token_version: Number(user.token_version) || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// Convertit une durée façon jsonwebtoken ("7d", "24h", "3600s"...) en millisecondes pour
// l'option maxAge de res.cookie(). Se limite volontairement aux formats déjà utilisés par ce
// projet (voir .env.example, JWT_EXPIRES_IN) plutôt que de dépendre du parseur interne du
// package "ms" (dépendance transitive de jsonwebtoken, non déclarée directement — s'appuyer
// dessus casserait silencieusement si jsonwebtoken change un jour sa dépendance interne).
function dureeEnMs(duree) {
  const m = /^(\d+)\s*(s|m|h|d)?$/.exec(String(duree).trim());
  if (!m) return 7 * 24 * 60 * 60 * 1000; // repli : 7 jours, comme la valeur par défaut ci-dessus
  const n = Number(m[1]);
  const unite = m[2] || 's';
  const multiplicateurs = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * multiplicateurs[unite];
}

// Cookie de session HttpOnly — migration progressive depuis le seul jeton en localStorage (voir
// SECURITY_REPORT.md). Posé EN PLUS du jeton renvoyé dans le corps JSON (inchangé) : le frontend
// web/mobile actuel continue de fonctionner à l'identique sans aucune modification, l'en-tête
// Authorization restant la source d'authentification prioritaire (voir
// server/middleware/auth.js). Ce cookie n'est donc pas encore utilisé activement par le frontend
// aujourd'hui — il prépare le terrain pour un futur basculement, sans rien changer au
// comportement actuel ni exiger que web et mobile migrent en même temps.
function definirCookieSession(res, token) {
  res.cookie('sf_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: dureeEnMs(process.env.JWT_EXPIRES_IN || '7d'),
    path: '/'
  });
}

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Crée un compte (entreprise) et renvoie un jeton de session
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nom, email, password]
 *             properties:
 *               nom: { type: string, example: 'Fatou Ndiaye' }
 *               email: { type: string, example: 'fatou@example.com' }
 *               password: { type: string, format: password, minLength: 8 }
 *               entreprise_nom: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Compte créé.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user: { $ref: '#/components/schemas/Utilisateur' }
 *       400: { description: "Champs manquants ou email déjà utilisé.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const { nom, email, password, entreprise_nom } = req.body;

    if (!nom || !email || !password) {
      return res.status(400).json({ error: 'Nom, email et mot de passe sont obligatoires.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const emailLower = email.toLowerCase();
    const [existingRows] = await pool.query('SELECT id FROM users WHERE email = ?', [emailLower]);
    if (existingRows.length) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (nom, email, password_hash, entreprise_nom) VALUES (?, ?, ?, ?)`,
      [nom, emailLower, hash, entreprise_nom || nom]
    );

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    const user = rows[0];
    const token = signToken(user);
    definirCookieSession(res, token);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Connexion par email/mot de passe
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Connexion réussie.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user: { $ref: '#/components/schemas/Utilisateur' }
 *       401: { description: "Email ou mot de passe incorrect.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const token = signToken(user);
    definirCookieSession(res, token);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) { next(err); }
});

// --- Connexion avec Google ---
// Le frontend récupère un "credential" (jeton d'identité) via Google Identity Services,
// on le vérifie ici auprès de Google avant de créer la session. Nécessite GOOGLE_CLIENT_ID
// dans .env (voir .env.example) ; sans cela, la route répond une erreur claire.
/**
 * @openapi
 * /auth/google:
 *   post:
 *     summary: Connexion ou création de compte via Google (jeton d'identité Google Sign-In)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [credential]
 *             properties:
 *               credential: { type: string, description: "Jeton ID renvoyé par le bouton Google Sign-In." }
 *     responses:
 *       200:
 *         description: Connexion réussie (compte existant ou nouvellement créé).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user: { $ref: '#/components/schemas/Utilisateur' }
 *       503: { description: "Connexion Google non configurée sur ce serveur.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/google', async (req, res, next) => {
  try {
    if (!googleClient) {
      return res.status(503).json({ error: "La connexion Google n'est pas configurée sur ce serveur." });
    }
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Jeton Google manquant.' });

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      return res.status(401).json({ error: 'Jeton Google invalide ou expiré.' });
    }

    const { sub: googleId, email, name } = payload;
    if (!email) return res.status(400).json({ error: "Votre compte Google n'a pas d'adresse email associée." });
    const emailLower = email.toLowerCase();

    // Cherche d'abord un compte déjà lié à ce Google ID, puis un compte existant avec le
    // même email (on le lie alors automatiquement à Google pour la prochaine connexion).
    let [rows] = await pool.query('SELECT * FROM users WHERE google_id = ?', [googleId]);
    let user = rows[0];

    if (!user) {
      [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [emailLower]);
      user = rows[0];
      if (user) {
        await pool.query('UPDATE users SET google_id = ? WHERE id = ?', [googleId, user.id]);
      }
    }

    if (!user) {
      // Nouveau compte : mot de passe aléatoire inutilisable (la connexion se fera via Google)
      const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      const [result] = await pool.query(
        `INSERT INTO users (nom, email, password_hash, entreprise_nom, google_id) VALUES (?, ?, ?, ?, ?)`,
        [name || emailLower, emailLower, randomPassword, name || emailLower, googleId]
      );
      [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
      user = rows[0];
    }

    const token = signToken(user);
    definirCookieSession(res, token);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Révoque les sessions actives puis efface le cookie HttpOnly.
 *     description: "Incrémente la version de session du compte : tous les JWT émis avant cette déconnexion deviennent invalides, sur navigateur et mobile."
 *     tags: [Auth]
 *     responses:
 *       204: { description: "Cookie effacé." }
 */
router.post('/logout', (req, res, next) => {
  // Efface le cookie même si le jeton Bearer présenté est expiré/invalide : le navigateur
  // ne doit pas conserver une session cookie inutilisable après une tentative de déconnexion.
  res.clearCookie('sf_token', { httpOnly: true, sameSite: 'lax', path: '/' });
  next();
}, requireAuth, async (req, res, next) => {
  try {
    // Révoque les sessions actives de ce compte, y compris les jetons Bearer conservés
    // dans un ancien navigateur ou appareil. Le changement est pris en compte à la
    // prochaine requête authentifiée.
    await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [req.user.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// --- Mot de passe oublié ---
/**
 * @openapi
 * /auth/mot-de-passe-oublie:
 *   post:
 *     summary: Envoie un email de réinitialisation de mot de passe (si l'adresse existe)
 *     description: Répond toujours avec succès, que l'email existe ou non, pour ne pas révéler quels emails sont enregistrés.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [email], properties: { email: { type: string } } }
 *     responses:
 *       200: { description: "Email envoyé si un compte correspond (ou silencieusement ignoré sinon)." }
 */
router.post('/mot-de-passe-oublie', resetLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Adresse email requise.' });

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    const user = rows[0];

    // Réponse volontairement identique que le compte existe ou non, pour ne pas révéler
    // quelles adresses sont inscrites (bonne pratique de sécurité).
    const genericMessage = { message: 'Si un compte existe avec cette adresse, un email de réinitialisation vient de lui être envoyé.' };

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      await pool.query('UPDATE users SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?', [tokenHash, expires, user.id]);

      const resetUrl = `${process.env.APP_URL || 'http://localhost:4000'}/reinitialiser-mot-de-passe.html?token=${rawToken}`;
      await sendMail({
        to: user.email,
        subject: 'Réinitialisation de votre mot de passe SamaFacture Pro',
        text: `Bonjour ${user.nom},\n\nVous avez demandé à réinitialiser votre mot de passe. Cliquez sur ce lien (valable 30 minutes) :\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
        html: `<p>Bonjour ${user.nom},</p><p>Vous avez demandé à réinitialiser votre mot de passe. Ce lien est valable 30 minutes :</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`
      });
    }

    res.json(genericMessage);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/reinitialiser-mot-de-passe:
 *   post:
 *     summary: Définit un nouveau mot de passe à partir du jeton reçu par email
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string, description: "Jeton contenu dans le lien de l'email de réinitialisation." }
 *               password: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200: { description: "Mot de passe mis à jour." }
 *       400: { description: "Jeton invalide ou expiré.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.post('/reinitialiser-mot-de-passe', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Lien invalide.' });
    if (password.length < 8) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE reset_token_hash = ? AND reset_token_expires > NOW()',
      [tokenHash]
    );
    const user = rows[0];
    if (!user) return res.status(400).json({ error: 'Ce lien de réinitialisation est invalide ou a expiré.' });

    const hash = await bcrypt.hash(password, 10);
    // Mise à jour conditionnelle atomique : un lien de réinitialisation ne peut être utilisé
    // qu'une seule fois, même si deux requêtes arrivent simultanément. Tous les JWT précédents
    // sont aussi révoqués par l'incrément de token_version.
    const [result] = await pool.query(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ? AND reset_token_hash = ? AND reset_token_expires > NOW()',
      [hash, user.id, tokenHash]
    );
    if (!result.affectedRows) {
      return res.status(400).json({ error: 'Ce lien de réinitialisation est invalide ou a expiré.' });
    }

    res.json({ message: 'Votre mot de passe a été réinitialisé. Vous pouvez maintenant vous connecter.' });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Renvoie l'utilisateur actuellement connecté
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Utilisateur courant.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { user: { $ref: '#/components/schemas/Utilisateur' } } }
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json({ user: sanitizeUser(rows[0]) });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /auth/entreprise:
 *   put:
 *     summary: Met à jour les coordonnées légales et bancaires de l'entreprise, les conditions de règlement et le modèle de facture/devis
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nom: { type: string }
 *               entreprise_nom: { type: string, nullable: true }
 *               entreprise_adresse: { type: string, nullable: true }
 *               entreprise_telephone: { type: string, nullable: true }
 *               entreprise_email: { type: string, nullable: true }
 *               entreprise_ninea: { type: string, nullable: true }
 *               entreprise_rccm: { type: string, nullable: true, maxLength: 80 }
 *               entreprise_site_web: { type: string, nullable: true, maxLength: 190 }
 *               entreprise_banque: { type: string, nullable: true, maxLength: 120 }
 *               entreprise_rib: { type: string, nullable: true, maxLength: 100 }
 *               entreprise_conditions_reglement: { type: string, nullable: true, maxLength: 5000 }
 *               entreprise_mentions_legales: { type: string, nullable: true, maxLength: 2000 }
 *               entreprise_logo: { type: string, nullable: true, description: 'Image en base64 (data URL), 2 Mo maximum.' }
 *               devise: { type: string, example: 'FCFA' }
 *               facture_template: { type: string, enum: [classique, moderne, minimaliste, elegant, corporate, creatif, prestige, heritage, diamant, epure, azur, circuit, platine, atelier, saveurs], description: "Les modèles elegant/corporate/creatif exigent le plan Pro. Les modèles prestige/heritage/diamant/platine exigent le plan Entreprise." }
 *               facture_personnalisation:
 *                 type: object
 *                 nullable: true
 *                 description: "Personnalisation visuelle appliquée par-dessus le modèle choisi. Toutes les clés sont optionnelles ; omettre le champ conserve la personnalisation existante à l'identique."
 *                 properties:
 *                   couleur_principale: { type: string, example: '#1a2b3c', description: 'Couleur hex ou rgb(). Remplace l’accent des totaux.' }
 *                   couleur_secondaire: { type: string, example: '#a1b2c3', description: 'Couleur hex ou rgb(). Colore le tampon de statut (Payée/Non payée/Devis).' }
 *                   couleur_texte: { type: string, example: '#222222', description: 'Couleur hex ou rgb() appliquée globalement au document.' }
 *                   police: { type: string, enum: [defaut, sans, serif, mono] }
 *                   taille_texte: { type: string, enum: [petit, normal, grand] }
 *                   epaisseur_texte: { type: string, enum: [normal, moyen, gras] }
 *                   logo_taille: { type: string, enum: [petit, moyen, grand] }
 *     responses:
 *       200:
 *         description: Profil mis à jour.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { user: { $ref: '#/components/schemas/Utilisateur' } } }
 *       400: { description: "Logo trop volumineux ou format invalide, modèle premium sans plan Pro, ou personnalisation invalide (couleur/police/taille hors des valeurs acceptées).", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.put('/entreprise', requireAuth, async (req, res, next) => {
  try {
    const {
      entreprise_nom, entreprise_logo, entreprise_adresse, entreprise_telephone, entreprise_email,
      entreprise_ninea, entreprise_rccm, entreprise_site_web, entreprise_banque, entreprise_rib,
      entreprise_conditions_reglement, entreprise_mentions_legales,
      devise, facture_template, signature_default, facture_personnalisation
    } = req.body;

    const { error: erreurPerso, cleaned: personnalisationValidee } = validerPersonnalisation(facture_personnalisation);
    if (erreurPerso) {
      return res.status(400).json({ error: erreurPerso });
    }

    if (entreprise_logo) {
      if (entreprise_logo.length > 3 * 1024 * 1024) {
        return res.status(400).json({ error: 'Logo trop volumineux (2 Mo maximum).' });
      }
      if (!isValidImageDataUrl(entreprise_logo)) {
        return res.status(400).json({ error: "Format d'image invalide pour le logo." });
      }
    }

    const [[userRow]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const proActif = isProPlan(userRow?.plan);

    if (signature_default) {
      if (!proActif) {
        return res.status(403).json({ error: 'La signature électronique est réservée au plan Pro. Passez à un plan payant dans Paramètres.', code: 'FONCTIONNALITE_PRO' });
      }
      if (signature_default.length > 2 * 1024 * 1024) {
        return res.status(400).json({ error: 'Signature trop volumineuse.' });
      }
      if (!isValidImageDataUrl(signature_default)) {
        return res.status(400).json({ error: 'Format de signature invalide.' });
      }
    }

    const templatesValides = [
      'classique', 'moderne', 'minimaliste', 'elegant', 'corporate', 'creatif', 'prestige', 'heritage', 'diamant',
      // Lot 2026-08 : epure/azur/circuit/atelier/saveurs sont gratuits comme classique/moderne/minimaliste ;
      // platine est Entreprise, au même titre que prestige/heritage/diamant (voir ENTERPRISE_TEMPLATES).
      'epure', 'azur', 'circuit', 'platine', 'atelier', 'saveurs'
    ];
    let template = templatesValides.includes(facture_template) ? facture_template : 'classique';
    if (PRO_TEMPLATES.includes(template) && !proActif) {
      return res.status(403).json({ error: 'Ce modèle de facture est réservé au plan Pro. Passez à un plan payant dans Paramètres.', code: 'FONCTIONNALITE_PRO' });
    }
    if (ENTERPRISE_TEMPLATES.includes(template) && !isEnterprisePlan(userRow?.plan)) {
      return res.status(403).json({ error: 'Ce modèle de facture est réservé au plan Entreprise. Passez au plan Entreprise dans Paramètres.', code: 'FONCTIONNALITE_ENTREPRISE' });
    }

    const texteOptionnel = (value, fallback, max) => {
      if (value === undefined) return fallback ?? null;
      if (value === null) return null;
      return String(value).trim().slice(0, max) || null;
    };
    await pool.query(
      `UPDATE users SET
        entreprise_nom = ?, entreprise_logo = ?, entreprise_adresse = ?, entreprise_telephone = ?,
        entreprise_email = ?, entreprise_ninea = ?, entreprise_rccm = ?, entreprise_site_web = ?,
        entreprise_banque = ?, entreprise_rib = ?, entreprise_conditions_reglement = ?,
        entreprise_mentions_legales = ?, devise = ?, facture_template = ?, signature_default = ?,
        facture_personnalisation = ?
       WHERE id = ?`,
      [
        entreprise_nom, entreprise_logo || null, entreprise_adresse, entreprise_telephone, entreprise_email,
        entreprise_ninea,
        texteOptionnel(entreprise_rccm, userRow.entreprise_rccm, 80),
        texteOptionnel(entreprise_site_web, userRow.entreprise_site_web, 190),
        texteOptionnel(entreprise_banque, userRow.entreprise_banque, 120),
        texteOptionnel(entreprise_rib, userRow.entreprise_rib, 100),
        texteOptionnel(entreprise_conditions_reglement, userRow.entreprise_conditions_reglement, 5000),
        texteOptionnel(entreprise_mentions_legales, userRow.entreprise_mentions_legales, 2000),
        devise || 'FCFA', template, signature_default || null,
        personnalisationValidee ? JSON.stringify(personnalisationValidee) : null, req.user.id
      ]
    );
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({ user: sanitizeUser(rows[0]) });
  } catch (err) { next(err); }
});

// Change le plan de l'abonnement. En l'absence de passerelle de paiement réelle connectée
// (Wave/Orange Money/PayDunya/Stripe — voir la feuille de route du README), ce changement
// est auto-service et immédiat, pour que vous puissiez tester les fonctionnalités Pro dès
// maintenant. À remplacer par un vrai flux de paiement avant une mise en production commerciale.
/**
 * @openapi
 * /auth/plan:
 *   put:
 *     summary: Change le plan d'abonnement (sélecteur manuel gratuit, utilisé quand aucune passerelle de paiement n'est configurée)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan]
 *             properties: { plan: { type: string, enum: [gratuit, starter, pro, entreprise] } }
 *     responses:
 *       200:
 *         description: Plan mis à jour.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { user: { $ref: '#/components/schemas/Utilisateur' } } }
 */
router.put('/plan', requireAuth, async (req, res, next) => {
  try {
    const { plan } = req.body;
    const plansValides = ['gratuit', 'starter', 'pro', 'entreprise'];
    if (!plansValides.includes(plan)) {
      return res.status(400).json({ error: 'Plan invalide.' });
    }
    await pool.query('UPDATE users SET plan = ? WHERE id = ?', [plan, req.user.id]);
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({ user: sanitizeUser(rows[0]) });
  } catch (err) { next(err); }
});

// Met à jour la photo de profil (image encodée en base64, ou null pour la retirer).
/**
 * @openapi
 * /auth/photo:
 *   put:
 *     summary: Met à jour la photo de profil
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [photo]
 *             properties: { photo: { type: string, description: 'Image en base64 (data URL), 4 Mo maximum.' } }
 *     responses:
 *       200:
 *         description: Photo mise à jour.
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { user: { $ref: '#/components/schemas/Utilisateur' } } }
 *       400: { description: "Image trop volumineuse ou format invalide.", content: { application/json: { schema: { $ref: '#/components/schemas/Erreur' } } } }
 */
router.put('/photo', requireAuth, async (req, res, next) => {
  try {
    const { photo } = req.body;
    if (photo) {
      if (photo.length > 6 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image trop volumineuse (4 Mo maximum).' });
      }
      if (!isValidImageDataUrl(photo)) {
        return res.status(400).json({ error: 'Format d\'image invalide.' });
      }
    }
    await pool.query('UPDATE users SET photo = ? WHERE id = ?', [photo || null, req.user.id]);
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({ user: sanitizeUser(rows[0]) });
  } catch (err) { next(err); }
});

// Réinitialise le tableau de bord : supprime toutes les données transactionnelles
// (clients, produits, factures/devis, lignes, paiements, dépenses) du compte, sans
// supprimer le compte lui-même ni ses informations d'entreprise.
/**
 * @openapi
 * /auth/donnees:
 *   delete:
 *     summary: Supprime définitivement le compte et toutes ses données (clients, factures, produits...)
 *     description: Action irréversible. Supprime en cascade tout ce qui est lié à l'utilisateur (contraintes ON DELETE CASCADE en base).
 *     tags: [Auth]
 *     responses:
 *       200: { description: "Compte et données supprimés." }
 */
router.delete('/donnees', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // L'ordre respecte les dépendances : factures d'abord (les lignes et paiements
    // sont supprimés automatiquement via ON DELETE CASCADE), puis clients, produits, dépenses.
    await conn.query('DELETE FROM factures WHERE user_id = ?', [req.user.id]);
    await conn.query('DELETE FROM clients WHERE user_id = ?', [req.user.id]);
    await conn.query('DELETE FROM produits WHERE user_id = ?', [req.user.id]);
    await conn.query('DELETE FROM depenses WHERE user_id = ?', [req.user.id]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

function sanitizeUser(user) {
  // Retire toutes les colonnes internes/secrètes avant de renvoyer l'utilisateur au frontend —
  // pas seulement password_hash. reset_token_hash/reset_token_expires étaient jusqu'ici renvoyés
  // tels quels sur /auth/me et toutes les routes qui passent par cette fonction (voir
  // AUDIT_PRODUCTION.md §2.2) : même si seul le propriétaire du compte pouvait les lire, envoyer
  // le hash d'un jeton de réinitialisation actif au JavaScript client n'a aucune raison d'être.
  const { password_hash, reset_token_hash, reset_token_expires, token_version, ...rest } = user;
  // La colonne est stockée en JSON texte (voir migration facture_personnalisation) ; on la renvoie
  // au client déjà parsée pour lui éviter un JSON.parse. Une valeur corrompue ne doit jamais faire
  // planter la réponse : on retombe alors sur "pas de personnalisation" (comportement par défaut).
  if (typeof rest.facture_personnalisation === 'string') {
    try {
      rest.facture_personnalisation = JSON.parse(rest.facture_personnalisation);
    } catch {
      rest.facture_personnalisation = null;
    }
  }
  return rest;
}

module.exports = router;
