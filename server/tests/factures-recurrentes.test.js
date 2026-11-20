const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');
const { genererFactureDepuisModele } = require('../routes/factures-recurrentes');
const { localDateString } = require('../utils/local-date');

// Vérifie que la génération automatique d'une facture récurrente calcule exactement les
// mêmes totaux qu'une facture créée manuellement avec les mêmes lignes et la même remise —
// c'était un bug réel avant la phase 5 (TVA calculée sur le HT brut, sans tenir compte de
// la remise, dans le générateur de factures récurrentes).
describe('Factures récurrentes : cohérence des calculs avec la création manuelle', () => {
  let userId, token, clientId;

  before(async () => {
    await setupTestDatabase();
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Récurrentes', email: emailDeTest('recur'), password: 'motdepasse123' , acceptTerms: true});
    userId = inscription.body.user.id;
    token = inscription.body.token;

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client Récurrent' });
    clientId = client.body.client.id;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  test('une facture générée depuis un modèle récurrent avec remise applique la TVA sur la base nette (comme une facture manuelle)', async () => {
    const lignes = [{ designation: 'Abonnement mensuel', quantite: 1, prix_unitaire: 10000, tva: 18 }];

    // Référence : la même facture créée manuellement, pour comparaison directe.
    const manuelle = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', remise: 2000, lignes });

    const modele = await request(app)
      .post('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, libelle: 'Abonnement', frequence: 'mensuelle', remise: 2000, lignes });
    assert.equal(modele.status, 201);

    const generee = await request(app)
      .post(`/api/factures-recurrentes/${modele.body.recurrente.id}/generer`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(generee.status, 201);
    // TVA sur (10000 - 2000) * 18% = 1440, et non 1800 (bug corrigé : avant la phase 5,
    // le générateur aurait calculé la TVA sur les 10000 bruts).
    assert.equal(Number(generee.body.facture.total_tva), 1440);
    assert.equal(Number(generee.body.facture.total_tva), Number(manuelle.body.facture.total_tva),
      'la facture générée automatiquement doit calculer exactement la même TVA que la facture manuelle équivalente');
    assert.equal(Number(generee.body.facture.total), Number(manuelle.body.facture.total));
  });

  test('une facture récurrente reprend les stocks historiques de tous les produits et mémorise PRINCIPAL', async () => {
    // Repartir sans entrepôt : les deux fiches gardent leur stock global historique.
    await pool.query('DELETE FROM pro_entrepots WHERE user_id = ?', [userId]);

    const productA = await request(app).post('/api/produits')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Produit historique A', prix_ht: 2000, tva: 18, stock: 8 });
    assert.equal(productA.status, 201, productA.text);
    const productAId = Number(productA.body.produit.id);

    const productB = await request(app).post('/api/produits')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Produit historique B', prix_ht: 3000, tva: 18, stock: 11 });
    assert.equal(productB.status, 201, productB.text);
    const productBId = Number(productB.body.produit.id);

    const [[warehouseBefore]] = await pool.query(
      'SELECT COUNT(*) AS total FROM pro_entrepots WHERE user_id = ?', [userId]
    );
    assert.equal(Number(warehouseBefore.total), 0, 'aucun entrepôt ne doit être initialisé avant la facture');
    const [stocksBefore] = await pool.query(
      'SELECT id FROM pro_stocks_entrepots WHERE user_id = ?', [userId]
    );
    assert.equal(stocksBefore.length, 0, 'les produits historiques ne sont pas encore ventilés');

    const modele = await request(app).post('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        libelle: 'Abonnement avec reprise multi-produits',
        frequence: 'mensuelle',
        lignes: [{ produit_id: productAId, designation: 'Produit historique A', quantite: 2, prix_unitaire: 2000, tva: 18 }]
      });
    assert.equal(modele.status, 201, modele.text);

    const facture = await request(app)
      .post(`/api/factures-recurrentes/${modele.body.recurrente.id}/generer`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(facture.status, 201, facture.text);

    const [[invoiceRow]] = await pool.query(
      'SELECT entrepot_id FROM factures WHERE id = ? AND user_id = ?',
      [facture.body.facture.id, userId]
    );
    const principalId = Number(invoiceRow.entrepot_id);
    assert.ok(principalId > 0, 'la facture récurrente doit mémoriser son entrepôt de sortie');

    const [productBBeforeBackfill] = await pool.query(
      'SELECT id FROM pro_stocks_entrepots WHERE user_id = ? AND produit_id = ?',
      [userId, productBId]
    );
    assert.equal(productBBeforeBackfill.length, 0,
      'la génération de la facture A ne doit pas prétendre avoir ventilé le produit B');

    // Ces deux endpoints partagent le verrou nommé : le backfill est exécuté une seule fois.
    const [inventory, warehouses] = await Promise.all([
      request(app).get('/api/pro/inventory/stock').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/pro/warehouses').set('Authorization', `Bearer ${token}`)
    ]);
    assert.equal(inventory.status, 200, inventory.text);
    assert.equal(warehouses.status, 200, warehouses.text);
    const principal = warehouses.body.entrepots.find(row => Number(row.par_defaut) === 1);
    assert.ok(principal);
    assert.equal(Number(principal.id), principalId);

    const stockMap = Object.fromEntries(inventory.body.stocks.map(row => [Number(row.produit_id), Number(row.quantite)]));
    assert.equal(stockMap[productAId], 6, 'le produit A reflète la sortie de deux unités');
    assert.equal(stockMap[productBId], 11, 'le produit B historique est repris intégralement');

    const [[marker]] = await pool.query(
      'SELECT backfill_stock_termine FROM pro_entrepots WHERE id = ? AND user_id = ?',
      [principalId, userId]
    );
    assert.equal(Number(marker.backfill_stock_termine), 1, 'le marqueur est posé après la reprise');

    const [ventilatedRows] = await pool.query(
      'SELECT produit_id FROM pro_stocks_entrepots WHERE user_id = ? AND entrepot_id = ? AND produit_id IN (?, ?)',
      [userId, principalId, productAId, productBId]
    );
    assert.equal(ventilatedRows.length, 2, 'une ligne par produit doit être conservée dans PRINCIPAL');

    const repeatedInventory = await request(app).get('/api/pro/inventory/stock')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(repeatedInventory.status, 200, repeatedInventory.text);
    const repeatedMap = Object.fromEntries(repeatedInventory.body.stocks.map(row => [Number(row.produit_id), Number(row.quantite)]));
    assert.equal(repeatedMap[productAId], 6);
    assert.equal(repeatedMap[productBId], 11, 'la seconde lecture ne doit pas doubler les quantités');

    const cancelled = await request(app)
      .put(`/api/factures/${facture.body.facture.id}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'annulee' });
    assert.equal(cancelled.status, 200, cancelled.text);

    const afterCancel = await request(app).get('/api/pro/inventory/stock')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(afterCancel.status, 200, afterCancel.text);
    const afterCancelMap = Object.fromEntries(afterCancel.body.stocks.map(row => [Number(row.produit_id), Number(row.quantite)]));
    assert.equal(afterCancelMap[productAId], 8, 'l’annulation restitue le produit A au magasin mémorisé');
    assert.equal(afterCancelMap[productBId], 11, 'le produit B reste inchangé');
  });

  test("une génération manuelle anticipée ne décale pas la prochaine échéance planifiée", async () => {
    const futureDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const modele = await request(app)
      .post('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        libelle: 'Génération manuelle anticipée',
        frequence: 'mensuelle',
        prochaine_date: futureDate,
        lignes: [{ designation: 'Maintenance', quantite: 1, prix_unitaire: 5000, tva: 18 }]
      });
    assert.equal(modele.status, 201);
    assert.equal(Number(modele.body.recurrente.jour_ancre), Number(futureDate.slice(-2)));

    const generee = await request(app)
      .post(`/api/factures-recurrentes/${modele.body.recurrente.id}/generer`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(generee.status, 201);

    const liste = await request(app)
      .get('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`);
    const updated = liste.body.recurrentes.find(row => row.id === modele.body.recurrente.id);
    assert.ok(updated);
    assert.equal(String(updated.prochaine_date).slice(0, 10), futureDate,
      'la génération manuelle ne doit pas avancer une échéance encore future');
  });

  test("le planificateur ignore un modèle qui n'est plus dû après l'obtention du verrou", async () => {
    const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const modele = await request(app)
      .post('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        libelle: 'Contrôle de l’échéance sous verrou',
        frequence: 'mensuelle',
        prochaine_date: futureDate,
        lignes: [{ designation: 'Service', quantite: 1, prix_unitaire: 5000, tva: 18 }]
      });
    assert.equal(modele.status, 201);

    const facture = await genererFactureDepuisModele(
      modele.body.recurrente.id,
      userId,
      { onlyIfDue: true }
    );
    assert.equal(facture, null, 'le scheduler ne doit pas traiter un modèle encore futur');

    const liste = await request(app)
      .get('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`);
    const updated = liste.body.recurrentes.find(row => row.id === modele.body.recurrente.id);
    assert.equal(Number(updated.factures_generees), 0);
    assert.equal(String(updated.prochaine_date).slice(0, 10), futureDate);
  });

  test("le planificateur respecte la mise en pause même si le modèle était déjà sélectionné", async () => {
    const modele = await request(app)
      .post('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        libelle: 'Modèle mis en pause',
        frequence: 'mensuelle',
        prochaine_date: new Date().toISOString().slice(0, 10),
        lignes: [{ designation: 'Service', quantite: 1, prix_unitaire: 5000, tva: 18 }]
      });
    assert.equal(modele.status, 201);

    const pause = await request(app)
      .put(`/api/factures-recurrentes/${modele.body.recurrente.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actif: false });
    assert.equal(Number(pause.body.recurrente.actif), 0);

    const facture = await genererFactureDepuisModele(
      modele.body.recurrente.id,
      userId,
      { onlyIfDue: true }
    );
    assert.equal(facture, null, 'un modèle mis en pause ne doit pas être généré par le scheduler');

    const liste = await request(app)
      .get('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`);
    const updated = liste.body.recurrentes.find(row => row.id === modele.body.recurrente.id);
    assert.equal(Number(updated.factures_generees), 0);
  });

  test("le scheduler ne génère pas un modèle désactivé après sa sélection initiale", async () => {
    const [[dateDb]] = await pool.query('SELECT CURDATE() AS today');
    const today = String(dateDb.today).slice(0, 10);
    const modele = await request(app)
      .post('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        libelle: 'Modèle mis en pause pendant le scheduler',
        frequence: 'mensuelle',
        prochaine_date: today,
        lignes: [{ designation: 'Service', quantite: 1, prix_unitaire: 5000, tva: 18 }]
      });
    assert.equal(modele.status, 201);

    const pause = await request(app)
      .put(`/api/factures-recurrentes/${modele.body.recurrente.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actif: false });
    assert.equal(pause.status, 200);

    const facture = await genererFactureDepuisModele(
      modele.body.recurrente.id,
      userId,
      { onlyIfDue: true }
    );
    assert.equal(facture, null, 'le scheduler doit respecter la pause après avoir obtenu le verrou');

    const liste = await request(app)
      .get('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`);
    const updated = liste.body.recurrentes.find(row => row.id === modele.body.recurrente.id);
    assert.equal(Number(updated.factures_generees), 0);
    assert.equal(Number(updated.actif), 0);
  });

  test("la première échéance par défaut utilise la date civile du fuseau du compte", async () => {
    const [[account]] = await pool.query(
      'SELECT fuseau_horaire FROM users WHERE id = ?',
      [userId]
    );
    const expectedDate = localDateString(account.fuseau_horaire || 'Africa/Dakar');
    const response = await request(app)
      .post('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        libelle: 'Date initiale selon fuseau du compte',
        frequence: 'mensuelle',
        lignes: [{ designation: 'Service', quantite: 1, prix_unitaire: 5000, tva: 18 }]
      });

    assert.equal(response.status, 201);
    assert.equal(String(response.body.recurrente.prochaine_date).slice(0, 10), expectedDate);
    assert.equal(Number(response.body.recurrente.jour_ancre), Number(expectedDate.slice(-2)));
  });

  test('la création interprète false comme désactivé et rejette les valeurs non booléennes', async () => {
    const disabled = await request(app)
      .post('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        libelle: 'Option email désactivée explicitement',
        envoi_auto_email: 'false',
        lignes: [{ designation: 'Service', quantite: 1, prix_unitaire: 5000, tva: 18 }]
      });

    assert.equal(disabled.status, 201);
    assert.equal(Number(disabled.body.recurrente.envoi_auto_email), 0);

    const invalid = await request(app)
      .post('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        libelle: 'Option email invalide',
        envoi_auto_email: 'off',
        lignes: [{ designation: 'Service', quantite: 1, prix_unitaire: 5000, tva: 18 }]
      });

    assert.equal(invalid.status, 400);
    assert.match(invalid.body.error, /envoi_auto_email doit être un booléen/);
  });

  test('la mise à jour conserve false comme false pour actif et envoi_auto_email', async () => {
    const created = await request(app)
      .post('/api/factures-recurrentes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        client_id: clientId,
        libelle: 'Option email modifiable',
        envoi_auto_email: true,
        lignes: [{ designation: 'Service', quantite: 1, prix_unitaire: 5000, tva: 18 }]
      });
    assert.equal(created.status, 201);

    const updated = await request(app)
      .put(`/api/factures-recurrentes/${created.body.recurrente.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actif: 'false', envoi_auto_email: 'false' });

    assert.equal(updated.status, 200);
    assert.equal(Number(updated.body.recurrente.actif), 0);
    assert.equal(Number(updated.body.recurrente.envoi_auto_email), 0);

    const invalid = await request(app)
      .put(`/api/factures-recurrentes/${created.body.recurrente.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envoi_auto_email: 'off' });

    assert.equal(invalid.status, 400);
    assert.match(invalid.body.error, /envoi_auto_email doit être un booléen/);
  });

  test('générer une facture récurrente inexistante renvoie 404', async () => {
    const res = await request(app)
      .post('/api/factures-recurrentes/999999999/generer')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 404);
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
