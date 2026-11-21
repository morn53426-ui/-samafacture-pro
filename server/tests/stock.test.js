const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// Le stock d'un produit doit se décompter automatiquement à la facturation (jamais pour un
// devis), et se restituer symétriquement en cas d'annulation ou de suppression — fonctionnalité
// absente à l'origine, ajoutée avec ces tests.
describe('Décompte et restitution automatique du stock', () => {
  let userId, token, clientId, produitId;

  before(async () => {
    await setupTestDatabase();
    const inscription = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur Stock', email: emailDeTest('stock'), password: 'motdepasse123' , acceptTerms: true});
    userId = inscription.body.user.id;
    token = inscription.body.token;

    // Cette suite valide le routage du stock, pas le quota mensuel du plan Gratuit.
    // Le compte éphémère utilise l'offre Starter, qui retire uniquement ce plafond.
    const [planUpdate] = await require('./setup').pool.query(
      "UPDATE users SET plan = 'starter' WHERE id = ?",
      [userId]
    );
    assert.equal(planUpdate.affectedRows, 1, 'le compte de test doit être placé en Starter');

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client Stock' });
    clientId = client.body.client.id;
  });

  after(async () => {
    await nettoyerUtilisateur(userId);
  });

  async function stockActuel() {
    const res = await request(app).get('/api/produits').set('Authorization', `Bearer ${token}`);
    return res.body.produits.find(p => p.id === produitId).stock;
  }

  test('créer une facture décompte le stock du produit lié', async () => {
    const produit = await request(app)
      .post('/api/produits')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Chaise', prix_ht: 5000, tva: 18, stock: 20 });
    produitId = produit.body.produit.id;

    await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Chaise', quantite: 3, prix_unitaire: 5000, tva: 18, produit_id: produitId }] });

    assert.equal(await stockActuel(), 17);
  });


  test('une vente et son annulation utilisent uniquement l’entrepôt principal', async () => {
    const [warehouseRows] = await require('./setup').pool.query(
      'SELECT id, code, nom FROM pro_entrepots WHERE user_id = ? ORDER BY par_defaut DESC, id',
      [userId]
    );
    const principal = warehouseRows.find(w => w.code === 'PRINCIPAL');
    assert.ok(principal, 'le magasin principal doit être initialisé par la première facture');

    const secondary = await request(app)
      .post('/api/pro/warehouses')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'TEST-SECOND', nom: 'Entrepôt secondaire test' });
    assert.equal(secondary.status, 201, secondary.text);
    const seeded = await request(app)
      .post('/api/pro/inventory/adjustments')
      .set('Authorization', `Bearer ${token}`)
      .send({ produit_id: produitId, entrepot_id: secondary.body.id, quantite: 10, motif: 'Stock secondaire de test' });
    // L'endpoint d'ajustement applique une variation à un stock existant et retourne
    // un résultat de commande (200), contrairement à la création de l'entrepôt (201).
    assert.equal(seeded.status, 200, seeded.text);
    assert.equal(seeded.body.success, true, seeded.text);
    assert.equal(Number(seeded.body.stock_entrepot), 10, seeded.text);

    async function balances(){
      const [rows] = await require('./setup').pool.query(
        'SELECT entrepot_id, quantite FROM pro_stocks_entrepots WHERE user_id = ? AND produit_id = ?',
        [userId, produitId]
      );
      return Object.fromEntries(rows.map(row=>[Number(row.entrepot_id),Number(row.quantite)]));
    }
    const before=await balances();
    const invoice=await request(app).post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({client_id:clientId,type:'facture',lignes:[{designation:'Chaise',quantite:2,prix_unitaire:5000,tva:18,produit_id:produitId}]});
    assert.equal(invoice.status,201,invoice.text);
    const afterSale=await balances();
    assert.equal(afterSale[principal.id],before[principal.id]-2,'la vente doit sortir du magasin principal');
    assert.equal(afterSale[secondary.body.id],before[secondary.body.id],'la vente ne doit pas toucher l’entrepôt secondaire');
    assert.equal(await stockActuel(),afterSale[principal.id]+afterSale[secondary.body.id],'le stock catalogue doit rester la somme des entrepôts');

    const cancel=await request(app).put(`/api/factures/${invoice.body.facture.id}/statut`)
      .set('Authorization', `Bearer ${token}`).send({statut:'annulee'});
    assert.equal(cancel.status,200,cancel.text);
    const afterCancel=await balances();
    assert.equal(afterCancel[principal.id],before[principal.id],'l’annulation restitue le stock dans le magasin principal');
    assert.equal(afterCancel[secondary.body.id],before[secondary.body.id],'l’annulation ne touche pas l’entrepôt secondaire');
  });

  test('créer un devis (pas une facture) ne touche jamais le stock', async () => {
    const avant = await stockActuel();
    await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'devis', lignes: [{ designation: 'Chaise', quantite: 5, prix_unitaire: 5000, tva: 18, produit_id: produitId }] });
    assert.equal(await stockActuel(), avant);
  });

  test('annuler une facture restitue le stock, la ré-activer le redécompte', async () => {
    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Chaise', quantite: 2, prix_unitaire: 5000, tva: 18, produit_id: produitId }] });
    const avant = await stockActuel();

    await request(app)
      .put(`/api/factures/${facture.body.facture.id}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'annulee' });
    assert.equal(await stockActuel(), avant + 2, 'annuler doit restituer les 2 unités');

    await request(app)
      .put(`/api/factures/${facture.body.facture.id}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'en_attente' });
    assert.equal(await stockActuel(), avant, 'réactiver doit redécompter les 2 unités');
  });

  test('supprimer une facture active restitue le stock ; supprimer une facture déjà annulée ne le restitue pas deux fois', async () => {
    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Chaise', quantite: 4, prix_unitaire: 5000, tva: 18, produit_id: produitId }] });
    const avant = await stockActuel();

    await request(app)
      .delete(`/api/factures/${facture.body.facture.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(await stockActuel(), avant + 4);

    // Facture annulée puis supprimée : le stock avait déjà été restitué à l'annulation,
    // la suppression ne doit pas le restituer une seconde fois.
    const facture2 = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Chaise', quantite: 1, prix_unitaire: 5000, tva: 18, produit_id: produitId }] });
    await request(app)
      .put(`/api/factures/${facture2.body.facture.id}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'annulee' });
    const apresAnnulation = await stockActuel();

    await request(app)
      .delete(`/api/factures/${facture2.body.facture.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(await stockActuel(), apresAnnulation, 'pas de restitution en double');
  });

  test('supprimer le client restitue aussi le stock de ses factures actives', async () => {
    const client2 = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client à supprimer' });

    await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_id: client2.body.client.id, type: 'facture', lignes: [{ designation: 'Chaise', quantite: 6, prix_unitaire: 5000, tva: 18, produit_id: produitId }] });
    const avant = await stockActuel();

    await request(app)
      .delete(`/api/clients/${client2.body.client.id}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(await stockActuel(), avant + 6);
  });
  test('une facture débite l’entrepôt choisi et restitue au même endroit à chaque transition', async () => {
    const product = await request(app).post('/api/produits')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Produit facturé depuis un dépôt secondaire', prix_ht: 1000, tva: 18, stock: 10 });
    assert.equal(product.status, 201, product.text);
    const selectedProductId = Number(product.body.produit.id);

    const warehousesResponse = await request(app).get('/api/pro/warehouses')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(warehousesResponse.status, 200, warehousesResponse.text);
    const mainWarehouse = warehousesResponse.body.entrepots.find(item => Number(item.par_defaut) === 1);
    assert.ok(mainWarehouse, 'le magasin principal doit exister');

    const secondaryResponse = await request(app).post('/api/pro/warehouses')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'FACTURE-SECONDAIRE', nom: 'Dépôt secondaire facturation' });
    assert.equal(secondaryResponse.status, 201, secondaryResponse.text);
    const secondaryWarehouseId = Number(secondaryResponse.body.id);

    // Simule une ancienne fiche catalogue : stock global présent, mais pas encore ventilé par entrepôt.
    await pool.query(
      'DELETE FROM pro_stocks_entrepots WHERE user_id = ? AND produit_id = ?',
      [userId, selectedProductId]
    );
    assert.equal(await pool.query('SELECT stock FROM produits WHERE id = ? AND user_id = ?', [selectedProductId, userId]).then(([rows]) => Number(rows[0].stock)), 10);

    const foreignRegistration = await request(app).post('/api/auth/register')
      .send({ nom: 'Autre société', email: emailDeTest('stock-warehouse-foreign'), password: 'motdepasse123', acceptTerms: true });
    assert.equal(foreignRegistration.status, 201, foreignRegistration.text);
    const foreignUserId = foreignRegistration.body.user.id;
    const foreignToken = foreignRegistration.body.token;
    try {
      const foreignWarehouses = await request(app).get('/api/pro/warehouses')
        .set('Authorization', `Bearer ${foreignToken}`);
      assert.equal(foreignWarehouses.status, 200);
      const foreignWarehouseId = Number(foreignWarehouses.body.entrepots.find(item => Number(item.par_defaut) === 1).id);

      const balances = async () => {
        const [rows] = await pool.query(
          'SELECT entrepot_id, quantite FROM pro_stocks_entrepots WHERE user_id = ? AND produit_id = ?',
          [userId, selectedProductId]
        );
        return Object.fromEntries(rows.map(row => [Number(row.entrepot_id), Number(row.quantite)]));
      };
      const storedTotal = async () => {
        const [rows] = await pool.query('SELECT stock FROM produits WHERE id = ? AND user_id = ?', [selectedProductId, userId]);
        return Number(rows[0].stock);
      };

      const invalidWarehouseInvoice = await request(app).post('/api/factures')
        .set('Authorization', `Bearer ${token}`)
        .send({
          client_id: clientId, type: 'facture', entrepot_id: foreignWarehouseId,
          lignes: [{ designation: 'Produit refusé', produit_id: selectedProductId, quantite: 1, prix_unitaire: 1000, tva: 18 }]
        });
      assert.equal(invalidWarehouseInvoice.status, 400, invalidWarehouseInvoice.text);
      assert.equal(await storedTotal(), 10, 'un entrepôt d’une autre entreprise ne doit pas modifier le stock');

      let currentBalances = await balances();
      assert.equal(currentBalances[Number(mainWarehouse.id)], undefined, 'le stock historique n’est pas encore ventilé avant la première vente');
      assert.equal(currentBalances[secondaryWarehouseId], undefined, 'aucun dépôt secondaire ne reçoit une copie du stock global');

      const invoiceResponse = await request(app).post('/api/factures')
        .set('Authorization', `Bearer ${token}`)
        .send({
          client_id: clientId, type: 'facture', entrepot_id: secondaryWarehouseId,
          lignes: [{ designation: 'Produit facturé', produit_id: selectedProductId, quantite: 3, prix_unitaire: 1000, tva: 18 }]
        });
      assert.equal(invoiceResponse.status, 201, invoiceResponse.text);
      const invoiceId = Number(invoiceResponse.body.facture.id);
      assert.equal(Number(invoiceResponse.body.facture.entrepot_id), secondaryWarehouseId);
      currentBalances = await balances();
      assert.equal(currentBalances[Number(mainWarehouse.id)], 10);
      assert.equal(currentBalances[secondaryWarehouseId], -3, 'la sortie est enregistrée dans le dépôt sélectionné');
      assert.equal(await storedTotal(), 7, 'le stock catalogue reste la somme des entrepôts');

      const cancelled = await request(app).put(`/api/factures/${invoiceId}/statut`)
        .set('Authorization', `Bearer ${token}`).send({ statut: 'annulee' });
      assert.equal(cancelled.status, 200, cancelled.text);
      currentBalances = await balances();
      assert.equal(currentBalances[Number(mainWarehouse.id)], 10);
      assert.equal(currentBalances[secondaryWarehouseId], 0, 'l’annulation restitue dans le dépôt de sortie d’origine');
      assert.equal(await storedTotal(), 10);

      const reactivated = await request(app).put(`/api/factures/${invoiceId}/statut`)
        .set('Authorization', `Bearer ${token}`).send({ statut: 'en_attente' });
      assert.equal(reactivated.status, 200, reactivated.text);
      currentBalances = await balances();
      assert.equal(currentBalances[secondaryWarehouseId], -3, 'la réactivation redébite le même dépôt');
      assert.equal(await storedTotal(), 7);

      const deleted = await request(app).delete(`/api/factures/${invoiceId}`)
        .set('Authorization', `Bearer ${token}`);
      assert.equal(deleted.status, 200, deleted.text);
      currentBalances = await balances();
      assert.equal(currentBalances[Number(mainWarehouse.id)], 10);
      assert.equal(currentBalances[secondaryWarehouseId], 0, 'la suppression restitue dans le dépôt mémorisé');
      assert.equal(await storedTotal(), 10);

      const concurrentInvoice = await request(app).post('/api/factures')
        .set('Authorization', `Bearer ${token}`)
        .send({
          client_id: clientId, type: 'facture', entrepot_id: secondaryWarehouseId,
          lignes: [{ designation: 'Sortie concurrente', produit_id: selectedProductId, quantite: 1, prix_unitaire: 1000, tva: 18 }]
        });
      assert.equal(concurrentInvoice.status, 201, concurrentInvoice.text);
      const concurrentId = Number(concurrentInvoice.body.facture.id);
      const [deleteResponse, cancelResponse] = await Promise.all([
        request(app).delete(`/api/factures/${concurrentId}`).set('Authorization', `Bearer ${token}`),
        request(app).put(`/api/factures/${concurrentId}/statut`).set('Authorization', `Bearer ${token}`).send({ statut: 'annulee' })
      ]);
      assert.equal(deleteResponse.status, 200, deleteResponse.text);
      assert.ok([200, 404].includes(cancelResponse.status),
        'annulation concurrente : elle réussit avant la suppression ou trouve la facture déjà supprimée');
      currentBalances = await balances();
      assert.equal(currentBalances[Number(mainWarehouse.id)], 10);
      assert.equal(currentBalances[secondaryWarehouseId], 0,
        'une suppression et une annulation concurrentes ne doivent restituer le stock qu’une fois');
      assert.equal(await storedTotal(), 10);

      const quoteResponse = await request(app).post('/api/factures')
        .set('Authorization', `Bearer ${token}`)
        .send({
          client_id: clientId, type: 'devis',
          lignes: [{ designation: 'Produit du devis', produit_id: selectedProductId, quantite: 2, prix_unitaire: 1000, tva: 18 }]
        });
      assert.equal(quoteResponse.status, 201, quoteResponse.text);
      assert.equal(await storedTotal(), 10, 'un devis ne débite aucun entrepôt');
      const transformed = await request(app).post(`/api/factures/${quoteResponse.body.facture.id}/transformer-en-facture`)
        .set('Authorization', `Bearer ${token}`).send({ entrepot_id: secondaryWarehouseId });
      assert.equal(transformed.status, 200, transformed.text);
      assert.equal(Number(transformed.body.facture.entrepot_id), secondaryWarehouseId);
      currentBalances = await balances();
      assert.equal(currentBalances[secondaryWarehouseId], -2, 'la transformation débite le dépôt choisi');
      const cancelTransformed = await request(app).put(`/api/factures/${quoteResponse.body.facture.id}/statut`)
        .set('Authorization', `Bearer ${token}`).send({ statut: 'annulee' });
      assert.equal(cancelTransformed.status, 200, cancelTransformed.text);
      currentBalances = await balances();
      assert.equal(currentBalances[secondaryWarehouseId], 0, 'la facture transformée restitue au dépôt mémorisé');

      const original = await request(app).post('/api/factures')
        .set('Authorization', `Bearer ${token}`)
        .send({
          client_id: clientId, type: 'facture', entrepot_id: secondaryWarehouseId,
          lignes: [{ designation: 'Produit à dupliquer', produit_id: selectedProductId, quantite: 1, prix_unitaire: 1000, tva: 18 }]
        });
      assert.equal(original.status, 201, original.text);
      const duplicate = await request(app).post(`/api/factures/${original.body.facture.id}/dupliquer`)
        .set('Authorization', `Bearer ${token}`).send({});
      assert.equal(duplicate.status, 201, duplicate.text);
      assert.equal(Number(duplicate.body.facture.entrepot_id), secondaryWarehouseId);
      currentBalances = await balances();
      assert.equal(currentBalances[secondaryWarehouseId], -2, 'la duplication d’une facture débite le même dépôt');
      const deleteDuplicate = await request(app).delete(`/api/factures/${duplicate.body.facture.id}`)
        .set('Authorization', `Bearer ${token}`);
      const deleteOriginal = await request(app).delete(`/api/factures/${original.body.facture.id}`)
        .set('Authorization', `Bearer ${token}`);
      assert.equal(deleteDuplicate.status, 200);
      assert.equal(deleteOriginal.status, 200);
      currentBalances = await balances();
      assert.equal(currentBalances[secondaryWarehouseId], 0);
      assert.equal(await storedTotal(), 10);
    } finally {
      await nettoyerUtilisateur(foreignUserId);
    }
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
