const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// /api/rapports (ventes, comptabilité, export Excel) n'était couvert par aucun test jusqu'ici.
describe('Rapports', () => {
  let userId, token, clientId;

  before(async () => {
    await setupTestDatabase();
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Rapports', email: emailDeTest('rapports'), password: 'motdepasse123' , acceptTerms: true});
    userId = inscription.body.user.id;
    token = inscription.body.token;

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client Rapports' });
    clientId = client.body.client.id;

    // Une facture connue (TVA 18%, total = 2360) pour vérifier des chiffres exacts.
    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Prestation', quantite: 1, prix_unitaire: 2000, tva: 18 }] });
    await request(app)
      .post(`/api/factures/${facture.body.facture.id}/paiements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ montant: 2360, methode: 'Espèces' });

    await request(app)
      .post('/api/depenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ libelle: 'Fournitures bureau', montant: 500, categorie: 'Bureau' });
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  test('GET /rapports/ventes regroupe par mois par défaut', async () => {
    const res = await request(app).get('/api/rapports/ventes').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.group_by, 'month');
    assert.ok(Array.isArray(res.body.rows));
    const totalVentes = res.body.rows.reduce((s, r) => s + Number(r.total), 0);
    assert.equal(totalVentes, 2360);
  });

  test('GET /rapports/ventes?group_by=client regroupe par client', async () => {
    const res = await request(app)
      .get('/api/rapports/ventes?group_by=client')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.rows.length, 1);
    assert.equal(res.body.rows[0].label, 'Client Rapports');
    assert.equal(Number(res.body.rows[0].total), 2360);
  });

  test('GET /rapports/comptabilite calcule recettes, dépenses, bénéfice et TVA collectée', async () => {
    const res = await request(app).get('/api/rapports/comptabilite').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(Number(res.body.recettes), 2360, 'recettes = montant_paye des factures');
    assert.equal(Number(res.body.depenses), 500);
    assert.equal(Number(res.body.benefice), 2360 - 500);
    assert.equal(Number(res.body.tva_collectee), 360, '18% de 2000');
    assert.ok(res.body.depenses_par_categorie.some(c => c.categorie === 'Bureau'));
  });

  test('GET /rapports/export-excel est refusé (403) sur le plan gratuit', async () => {
    const res = await request(app)
      .get('/api/rapports/export-excel')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'FONCTIONNALITE_PRO');
  });

  test('GET /rapports/export-excel renvoie un classeur .xlsx pour un compte plan Pro', async () => {
    await pool.query("UPDATE users SET plan = 'pro' WHERE id = ?", [userId]);
    const res = await request(app)
      .get('/api/rapports/export-excel')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', chunk => chunks.push(Buffer.from(chunk)));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
        response.on('error', callback);
      });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.match(res.headers['content-disposition'] || '', /\.xlsx"?$/);
    assert.ok(Number(res.headers['content-length']) > 0, 'le fichier généré ne doit pas être vide');

    assert.ok(Buffer.isBuffer(res.body), 'la réponse .xlsx doit être un Buffer binaire');
    const workbook = new (require('exceljs').Workbook)();
    await workbook.xlsx.load(Buffer.from(res.body));
    assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Ventes', 'Dépenses']);
    assert.equal(workbook.getWorksheet('Ventes').getCell('A1').value, 'Période / Client');
    assert.equal(workbook.getWorksheet('Dépenses').getCell('A1').value, 'Libellé');
    assert.equal(Number(workbook.getWorksheet('Dépenses').getCell('D2').value), 500);
  });

  test('un utilisateur B ne voit jamais les ventes/dépenses de A dans ses rapports', async () => {
    const b = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Rapports B', email: emailDeTest('rapports-b'), password: 'motdepasse123' , acceptTerms: true});
    const res = await request(app).get('/api/rapports/comptabilite').set('Authorization', `Bearer ${b.body.token}`);
    assert.equal(Number(res.body.recettes), 0);
    assert.equal(Number(res.body.depenses), 0);
    await nettoyerUtilisateur(b.body.user.id);
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
