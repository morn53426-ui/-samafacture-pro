const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

describe('Authentification', () => {
  let userId;
  const email = emailDeTest('auth');
  const password = 'motdepasse123';
  let currentPassword = password;

  before(async () => {
    await setupTestDatabase();
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  test('inscription avec des informations valides crée un compte et renvoie un jeton', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Utilisateur Test', email, password, entreprise_nom: 'Boutique Test', acceptTerms: true });

    assert.equal(res.status, 201);
    assert.ok(res.body.token, 'un jeton JWT doit être renvoyé');
    assert.equal(res.body.user.email, email);
    assert.equal(res.body.user.password_hash, undefined, 'le mot de passe ne doit jamais être renvoyé');
    assert.equal(res.body.user.reset_token_hash, undefined, 'le hash de réinitialisation ne doit jamais être renvoyé');
    assert.equal(res.body.user.reset_token_expires, undefined, 'la date d’expiration interne ne doit jamais être renvoyée');
    userId = res.body.user.id;
  });

  test("l'inscription sans acceptation des documents est refusée", async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Sans Consentement', email: emailDeTest('sans-accord'), password, acceptTerms: false });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /accepter les conditions/i);
  });

  test("l'inscription avec un email déjà utilisé est refusée", async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Autre Utilisateur', email, password: 'autremotdepasse', acceptTerms: true });

    assert.equal(res.status, 409);
  });

  test('un mot de passe trop court est refusé à l\'inscription', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Test', email: emailDeTest('court'), password: '123', acceptTerms: true });

    assert.equal(res.status, 400);
  });

  test("l'acceptation des documents est enregistrée avec leurs versions", async () => {
    const [rows] = await require('../config/db').pool.query(
      'SELECT terms_accepted_at, terms_version, privacy_version FROM users WHERE email = ?',
      [email]
    );
    assert.ok(rows[0].terms_accepted_at);
    assert.equal(rows[0].terms_version, '2026-11-13');
    assert.equal(rows[0].privacy_version, '2026-11-13');
  });

  test('la connexion avec les bons identifiants réussit', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  test("la réinitialisation du mot de passe révoque les sessions déjà ouvertes (token_version)", async () => {
    const connexion = await request(app).post('/api/auth/login').send({ email, password });
    const ancienToken = connexion.body.token;
    assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${ancienToken}`)).status, 200);

    const { pool } = require('../config/db');
    const { incrementerTokenVersion } = require('../utils/session');
    await incrementerTokenVersion(pool, userId); // même appel que la réinitialisation de mot de passe

    const apres = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${ancienToken}`);
    assert.equal(apres.status, 401, "l'ancien jeton doit être refusé après révocation");

    const reconnexion = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(reconnexion.status, 200);
    assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${reconnexion.body.token}`)).status, 200,
      'un nouveau jeton (nouvelle version) doit fonctionner');
  });

  test('un utilisateur ne peut pas attribuer lui-même un plan Starter, Pro ou Entreprise', async () => {
    const connexion = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(connexion.status, 200);
    const token = connexion.body.token;

    for (const plan of ['starter', 'pro', 'entreprise']) {
      const res = await request(app)
        .put('/api/auth/plan')
        .set('Authorization', `Bearer ${token}`)
        .send({ plan });
      assert.equal(res.status, 403, `le plan ${plan} doit exiger un paiement confirmé`);
      assert.equal(res.body.code, 'PAIEMENT_REQUIS');
    }

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.plan, 'gratuit');
  });

  test('le changement vers un plan inconnu est refusé', async () => {
    const connexion = await request(app).post('/api/auth/login').send({ email, password });
    const res = await request(app)
      .put('/api/auth/plan')
      .set('Authorization', `Bearer ${connexion.body.token}`)
      .send({ plan: 'enterprise-premium' });
    assert.equal(res.status, 400);
  });

  test('la connexion avec un mauvais mot de passe échoue', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'mauvais-mot-de-passe' });
    assert.equal(res.status, 401);
  });

  test('la connexion avec un email inconnu échoue (sans révéler que le compte n\'existe pas)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: emailDeTest('inconnu'), password: 'peu importe' });
    assert.equal(res.status, 401);
  });

  test('accéder à une route protégée sans jeton est refusé', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  test('accéder à une route protégée avec un jeton invalide est refusé', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer un-jeton-invalide');
    assert.equal(res.status, 401);
  });

  test('accéder à /api/auth/me avec un jeton valide renvoie le bon utilisateur', async () => {
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, email);
  });

  test('les réponses login et auth/me masquent les secrets de réinitialisation sans les effacer de la base', async () => {
    const markerHash = 'a'.repeat(64);
    const { pool } = require('../config/db');
    await pool.query(
      'UPDATE users SET reset_token_hash = ?, reset_token_expires = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id = ?',
      [markerHash, userId]
    );

    const connexion = await request(app).post('/api/auth/login').send({ email, password: currentPassword });
    assert.equal(connexion.status, 200, connexion.text);
    const profil = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer ' + connexion.body.token);
    assert.equal(profil.status, 200, profil.text);

    for (const [route, user] of [
      ['/api/auth/login', connexion.body.user],
      ['/api/auth/me', profil.body.user]
    ]) {
      assert.ok(user, route + ' doit renvoyer le profil utilisateur.');
      assert.equal(user.password_hash, undefined, route + ' ne doit pas exposer password_hash.');
      assert.equal(user.reset_token_hash, undefined, route + ' ne doit pas exposer reset_token_hash.');
      assert.equal(user.reset_token_expires, undefined, route + ' ne doit pas exposer reset_token_expires.');
    }

    const [[stored]] = await pool.query(
      'SELECT reset_token_hash FROM users WHERE id = ?',
      [userId]
    );
    assert.equal(stored.reset_token_hash, markerHash,
      'la lecture du profil ne doit pas invalider ni supprimer le hash stocké.');
  });

  test('les informations légales et bancaires de l’entreprise sont enregistrées et conservées', async () => {
    const login = await request(app).post('/api/auth/login').send({ email, password });
    const token = login.body.token;
    const payload = {
      entreprise_nom: 'Entreprise Test',
      entreprise_adresse: 'Dakar',
      entreprise_telephone: '+221 77 000 00 00',
      entreprise_email: 'contact@test.sn',
      entreprise_ninea: '123456789',
      entreprise_rccm: 'SN-DKR-2026-B-1234',
      entreprise_site_web: 'https://entreprise-test.sn',
      entreprise_banque: 'Banque Test',
      entreprise_rib: 'SN00 1111 2222 3333',
      entreprise_conditions_reglement: 'Paiement à 30 jours.',
      entreprise_mentions_legales: 'SARL au capital de 1 000 000 FCFA.',
      devise: 'FCFA',
      facture_template: 'classique'
    };

    const saved = await request(app)
      .put('/api/auth/entreprise')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    assert.equal(saved.status, 200, saved.text);
    assert.equal(saved.body.user.entreprise_rccm, payload.entreprise_rccm);
    assert.equal(saved.body.user.entreprise_site_web, payload.entreprise_site_web);
    assert.equal(saved.body.user.entreprise_banque, payload.entreprise_banque);
    assert.equal(saved.body.user.entreprise_rib, payload.entreprise_rib);
    assert.equal(saved.body.user.entreprise_conditions_reglement, payload.entreprise_conditions_reglement);
    assert.equal(saved.body.user.entreprise_mentions_legales, payload.entreprise_mentions_legales);

    // Un ancien client peut encore envoyer le payload historique sans ces nouvelles propriétés :
    // les réglages ajoutés ne doivent pas être effacés lors d'une sauvegarde du profil.
    const legacy = { ...payload };
    delete legacy.entreprise_rccm;
    delete legacy.entreprise_site_web;
    delete legacy.entreprise_banque;
    delete legacy.entreprise_rib;
    delete legacy.entreprise_conditions_reglement;
    delete legacy.entreprise_mentions_legales;
    const savedAgain = await request(app)
      .put('/api/auth/entreprise')
      .set('Authorization', `Bearer ${token}`)
      .send(legacy);
    assert.equal(savedAgain.status, 200, savedAgain.text);
    assert.equal(savedAgain.body.user.entreprise_rccm, payload.entreprise_rccm);
    assert.equal(savedAgain.body.user.entreprise_rib, payload.entreprise_rib);
  });

  test('un lien de réinitialisation ne peut être utilisé qu’une fois, même en concurrence', async () => {
    const crypto = require('node:crypto');
    const { pool } = require('../config/db');
    const connexion = await request(app).post('/api/auth/login').send({ email, password: currentPassword });
    assert.equal(connexion.status, 200);
    const ancienToken = connexion.body.token;
    assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${ancienToken}`)).status, 200);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await pool.query(
      'UPDATE users SET reset_token_hash = ?, reset_token_expires = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id = ?',
      [tokenHash, userId]
    );

    const attempts = await Promise.all([
      request(app).post('/api/auth/reinitialiser-mot-de-passe').send({ token: rawToken, password: 'nouveau-mot-de-passe-A' }),
      request(app).post('/api/auth/reinitialiser-mot-de-passe').send({ token: rawToken, password: 'nouveau-mot-de-passe-B' })
    ]);
    assert.equal(attempts.filter(res => res.status === 200).length, 1,
      'une seule requête concurrente doit consommer le lien');
    assert.equal(attempts.filter(res => res.status === 400).length, 1,
      'la seconde requête doit voir le lien déjà consommé');

    const afterReset = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${ancienToken}`);
    assert.equal(afterReset.status, 401, 'les anciennes sessions sont révoquées par la même mise à jour atomique');

    currentPassword = attempts[0].status === 200 ? 'nouveau-mot-de-passe-A' : 'nouveau-mot-de-passe-B';
    const reconnexion = await request(app).post('/api/auth/login').send({ email, password: currentPassword });
    assert.equal(reconnexion.status, 200, reconnexion.text);
    assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${reconnexion.body.token}`)).status, 200);
  });

  test('la réinitialisation protège un événement de contrepassation même si la facture liée est un devis', async () => {
    const { pool } = require('../config/db');
    const registration = await request(app)
      .post('/api/auth/register')
      .send({
        nom: 'Compte événement comptable',
        email: emailDeTest('reset-event'),
        password,
        entreprise_nom: 'Société événement comptable',
        acceptTerms: true
      });
    assert.equal(registration.status, 201, registration.text);
    const resetUserId = registration.body.user.id;

    try {
      const [clientResult] = await pool.query(
        'INSERT INTO clients (user_id, nom) VALUES (?, ?)',
        [resetUserId, 'Client événement comptable']
      );
      const [invoiceResult] = await pool.query(
        'INSERT INTO factures (user_id, client_id, numero, type, date_emission) VALUES (?, ?, ?, ?, CURRENT_DATE)',
        [resetUserId, clientResult.insertId, 'RESET-EVENT-' + resetUserId, 'devis']
      );
      // Depuis le schéma v22, facture_id est conservé comme référence d'audit
      // sans FK vers factures : l'événement doit rester protégé même si la
      // facture n'est plus un document émis et même si le lien est orphelin.
      const [eventResult] = await pool.query(
        'INSERT INTO pro_compta_facture_events (user_id, facture_id, transition, previous_ecriture_id) VALUES (?, ?, ?, ?)',
        [resetUserId, invoiceResult.insertId, 'annulation', 987654]
      );

      const reset = await request(app)
        .delete('/api/auth/donnees')
        .set('Authorization', 'Bearer ' + registration.body.token);
      assert.equal(reset.status, 409, reset.text);
      assert.equal(reset.body.code, 'RESET_HISTORIQUE_PROTEGE');
      assert.match(reset.body.error, /contrepassation/i);

      const [[event]] = await pool.query(
        'SELECT COUNT(*) AS total FROM pro_compta_facture_events WHERE user_id = ? AND id = ?',
        [resetUserId, eventResult.insertId]
      );
      const [[invoice]] = await pool.query(
        'SELECT COUNT(*) AS total FROM factures WHERE user_id = ? AND id = ?',
        [resetUserId, invoiceResult.insertId]
      );
      assert.equal(Number(event.total), 1, 'l’événement de contrepassation doit rester présent');
      assert.equal(Number(invoice.total), 1, 'le devis référencé doit rester présent après le refus');
    } finally {
      await nettoyerUtilisateur(resetUserId);
    }
  });

  test('la réinitialisation autorise les brouillons et conserve le compte et ses paramètres', async () => {
    const { pool } = require('../config/db');
    const registration = await request(app)
      .post('/api/auth/register')
      .send({
        nom: 'Compte reset sans historique',
        email: emailDeTest('reset-drafts'),
        password,
        entreprise_nom: 'Société à conserver',
        acceptTerms: true
      });
    assert.equal(registration.status, 201, registration.text);
    const resetUserId = registration.body.user.id;

    try {
      const [clientResult] = await pool.query(
        'INSERT INTO clients (user_id, nom) VALUES (?, ?)',
        [resetUserId, 'Client brouillon']
      );
      await pool.query(
        'INSERT INTO produits (user_id, nom) VALUES (?, ?)',
        [resetUserId, 'Produit sans mouvement']
      );
      await pool.query(
        'INSERT INTO factures (user_id, client_id, numero, type, date_emission) VALUES (?, ?, ?, ?, CURRENT_DATE)',
        [resetUserId, clientResult.insertId, 'RESET-DRAFT-' + resetUserId, 'devis']
      );
      await pool.query(
        'INSERT INTO depenses (user_id, libelle, montant, date_depense) VALUES (?, ?, ?, CURRENT_DATE)',
        [resetUserId, 'Dépense non comptabilisée', 1250]
      );

      const reset = await request(app)
        .delete('/api/auth/donnees')
        .set('Authorization', 'Bearer ' + registration.body.token);
      assert.equal(reset.status, 200, reset.text);
      assert.equal(reset.body.success, true);

      const [[account]] = await pool.query(
        'SELECT id, entreprise_nom FROM users WHERE id = ?',
        [resetUserId]
      );
      assert.equal(Number(account.id), resetUserId);
      assert.equal(account.entreprise_nom, 'Société à conserver');

      for (const table of ['clients', 'produits', 'factures', 'depenses']) {
        const [[count]] = await pool.query(
          `SELECT COUNT(*) AS total FROM ${table} WHERE user_id = ?`,
          [resetUserId]
        );
        assert.equal(Number(count.total), 0, 'les données non historiques de ' + table + ' doivent être réinitialisées');
      }
    } finally {
      await nettoyerUtilisateur(resetUserId);
    }
  });

  test('la réinitialisation refuse de supprimer une facture émise et conserve les données liées', async () => {
    const { pool } = require('../config/db');
    const connexion = await request(app).post('/api/auth/login').send({ email, password: currentPassword });
    assert.equal(connexion.status, 200, connexion.text);
    const token = connexion.body.token;

    const [clientResult] = await pool.query(
      'INSERT INTO clients (user_id, nom) VALUES (?, ?)',
      [userId, 'Client historique reset guard']
    );
    const clientId = clientResult.insertId;
    const numero = 'RESET-GUARD-' + userId;
    const [invoiceResult] = await pool.query(
      'INSERT INTO factures (user_id, client_id, numero, type, date_emission) VALUES (?, ?, ?, ?, CURRENT_DATE)',
      [userId, clientId, numero, 'facture']
    );
    const factureId = invoiceResult.insertId;

    const reset = await request(app)
      .delete('/api/auth/donnees')
      .set('Authorization', 'Bearer ' + token);
    assert.equal(reset.status, 409, reset.text);
    assert.equal(reset.body.code, 'RESET_HISTORIQUE_PROTEGE');

    const [[facture]] = await pool.query(
      'SELECT COUNT(*) AS total FROM factures WHERE user_id = ? AND id = ?',
      [userId, factureId]
    );
    const [[client]] = await pool.query(
      'SELECT COUNT(*) AS total FROM clients WHERE user_id = ? AND id = ?',
      [userId, clientId]
    );
    assert.equal(Number(facture.total), 1, 'la facture émise doit rester présente après le refus');
    assert.equal(Number(client.total), 1, 'le client lié doit rester présent après le refus');
  });

  test('la déconnexion invalide aussi le jeton Bearer courant', async () => {
    const connexion = await request(app).post('/api/auth/login').send({ email, password: currentPassword });
    assert.equal(connexion.status, 200, connexion.text);
    const token = connexion.body.token;

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(logout.status, 204, logout.text);

    const ancienneSession = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(ancienneSession.status, 401, 'le jeton doit être refusé après logout');

    const nouvelleConnexion = await request(app).post('/api/auth/login').send({ email, password: currentPassword });
    assert.equal(nouvelleConnexion.status, 200);
    assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${nouvelleConnexion.body.token}`)).status, 200);
  });
});


// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
