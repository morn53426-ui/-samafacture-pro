const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment
} = require('./setup');

describe('Protection de l’historique client', () => {
  let userId;
  let token;
  let userIdB;

  before(async () => {
    await setupTestDatabase();
    const registration = await request(app)
      .post('/api/auth/register')
      .send({
        nom: 'Compte historique clients',
        email: emailDeTest('client-history-protection'),
        password: 'motdepasse123',
        acceptTerms: true
      });
    assert.equal(registration.status, 201, registration.text);
    userId = registration.body.user.id;
    token = registration.body.token;
    await pool.query("UPDATE users SET plan = 'pro' WHERE id = ?", [userId]);

    const registrationB = await request(app)
      .post('/api/auth/register')
      .send({
        nom: 'Compte référence inter-entreprise',
        email: emailDeTest('client-history-cross-tenant'),
        password: 'motdepasse123',
        acceptTerms: true
      });
    assert.equal(registrationB.status, 201, registrationB.text);
    userIdB = registrationB.body.user.id;
  });

  after(async () => {
    await nettoyerUtilisateur(userIdB);
    await nettoyerUtilisateur(userId);
  });

  async function createClient(nom) {
    const response = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom });
    assert.equal(response.status, 201, response.text);
    return response.body.client;
  }

  test('un client avec facture et paiement ne peut être supprimé; historique conservé', async () => {
    const client = await createClient('Client avec historique financier');
    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: client.id, type: 'facture', lignes: [{ designation: 'Prestation', quantite: 1, prix_unitaire: 1000, tva: 0 }] });
    assert.equal(facture.status, 201, facture.text);

    const payment = await request(app)
      .post(`/api/factures/${facture.body.facture.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: 500, methode: 'Espèces' });
    assert.equal(payment.status, 201, payment.text);

    const deletion = await request(app)
      .delete(`/api/clients/${client.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(deletion.status, 409, deletion.text);
    assert.equal(deletion.body.code, 'CLIENT_HISTORIQUE_PROTEGE');

    const [[storedClient]] = await pool.query('SELECT id FROM clients WHERE id = ? AND user_id = ?', [client.id, userId]);
    const [[storedInvoice]] = await pool.query('SELECT id, montant_paye FROM factures WHERE id = ? AND user_id = ?', [facture.body.facture.id, userId]);
    const [[storedPayments]] = await pool.query('SELECT COUNT(*) AS n FROM paiements WHERE user_id = ? AND facture_id = ?', [userId, facture.body.facture.id]);
    assert.ok(storedClient, 'le client doit rester présent');
    assert.ok(storedInvoice, 'la facture doit rester présente');
    assert.equal(Number(storedInvoice.montant_paye), 500);
    assert.equal(Number(storedPayments.n), 1, 'le paiement doit rester présent');
  });

  test('un client ayant une activité CRM ne peut être supprimé', async () => {
    const client = await createClient('Client avec activité CRM');
    await pool.query(
      "INSERT INTO pro_crm_activities (user_id, client_id, acteur_user_id, type, titre, description, statut) VALUES (?, ?, ?, 'note', 'Historique à conserver', 'Note CRM de test', 'terminee')",
      [userId, client.id, userId]
    );

    const deletion = await request(app)
      .delete(`/api/clients/${client.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(deletion.status, 409, deletion.text);
    assert.equal(deletion.body.code, 'CLIENT_HISTORIQUE_PROTEGE');
    const [[stored]] = await pool.query('SELECT id FROM clients WHERE id = ? AND user_id = ?', [client.id, userId]);
    const [[activities]] = await pool.query('SELECT COUNT(*) AS n FROM pro_crm_activities WHERE user_id = ? AND client_id = ?', [userId, client.id]);
    assert.ok(stored, 'le client doit rester présent');
    assert.equal(Number(activities.n), 1, 'l’activité CRM doit rester présente');
  });

  test('un client avec modèle de facture récurrente ne peut être supprimé', async () => {
    const client = await createClient('Client facture récurrente');
    const [created] = await pool.query(
      `INSERT INTO factures_recurrentes (user_id, client_id, libelle, frequence, prochaine_date, lignes_json)
       VALUES (?, ?, 'Modèle récurrent de test', 'mensuelle', '2026-11-30', '[]')`,
      [userId, client.id]
    );
    const deletion = await request(app)
      .delete(`/api/clients/${client.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(deletion.status, 409, deletion.text);
    assert.equal(deletion.body.code, 'CLIENT_HISTORIQUE_PROTEGE');
    const [[storedClient]] = await pool.query('SELECT id FROM clients WHERE id = ? AND user_id = ?', [client.id, userId]);
    const [[template]] = await pool.query('SELECT id FROM factures_recurrentes WHERE id = ? AND client_id = ?', [created.insertId, client.id]);
    assert.ok(storedClient, 'client conservé');
    assert.ok(template, 'modèle récurrent conservé');
  });

  test('un client avec commande professionnelle ne peut être supprimé', async () => {
    const client = await createClient('Client commande');
    const [created] = await pool.query(
      `INSERT INTO pro_commandes (user_id, client_id, numero, statut, date_commande, lignes_json)
       VALUES (?, ?, 'TEST-CLIENT-HISTORY-001', 'brouillon', '2026-11-22', '[]')`,
      [userId, client.id]
    );
    const deletion = await request(app)
      .delete(`/api/clients/${client.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(deletion.status, 409, deletion.text);
    assert.equal(deletion.body.code, 'CLIENT_HISTORIQUE_PROTEGE');
    const [[storedClient]] = await pool.query('SELECT id FROM clients WHERE id = ? AND user_id = ?', [client.id, userId]);
    const [[order]] = await pool.query('SELECT id FROM pro_commandes WHERE id = ? AND client_id = ?', [created.insertId, client.id]);
    assert.ok(storedClient, 'client conservé');
    assert.ok(order, 'commande conservée');
  });

  test('une référence CRM cross-tenant empêche la cascade et conserve les données', async () => {
    const client = await createClient('Client référence cross-tenant');
    const [activity] = await pool.query(
      `INSERT INTO pro_crm_activities
       (user_id, client_id, acteur_user_id, type, titre, description, statut)
       VALUES (?, ?, ?, 'note', 'Référence inter-entreprise', 'Test de garde de cascade', 'terminee')`,
      [userIdB, client.id, userIdB]
    );
    const deletion = await request(app)
      .delete(`/api/clients/${client.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(deletion.status, 409, deletion.text);
    assert.equal(deletion.body.code, 'CLIENT_HISTORIQUE_PROTEGE');
    const [[storedClient]] = await pool.query('SELECT id FROM clients WHERE id = ? AND user_id = ?', [client.id, userId]);
    const [[storedActivity]] = await pool.query(
      'SELECT id, user_id, client_id FROM pro_crm_activities WHERE id = ?',
      [activity.insertId]
    );
    assert.ok(storedClient, 'client conservé');
    assert.equal(Number(storedActivity.user_id), Number(userIdB), 'référence de l’autre entreprise conservée');
    assert.equal(Number(storedActivity.client_id), Number(client.id), 'lien client conservé');
  });

  test('un client sans historique reste supprimable', async () => {
    const client = await createClient('Client sans historique');
    const deletion = await request(app)
      .delete(`/api/clients/${client.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(deletion.status, 200, deletion.text);
    const [[stored]] = await pool.query('SELECT id FROM clients WHERE id = ? AND user_id = ?', [client.id, userId]);
    assert.equal(stored, undefined);
  });
});

after(teardownTestEnvironment);
