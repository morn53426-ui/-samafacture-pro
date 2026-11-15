const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const puppeteer = require('puppeteer');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// GET /api/factures/:id/pdf (génération via Puppeteer, utils/pdf.js) n'était pas testé.
// Nécessite un Chromium installé/téléchargeable (voir npm postinstall de puppeteer) — pas
// exécutable dans un environnement sans accès réseau, mais doit passer en CI/local normal.
describe('Génération PDF de facture', () => {
  let userIdA, tokenA, userIdB, tokenB, factureId;

  before(async () => {
    await setupTestDatabase();
    const a = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur PDF A', email: emailDeTest('pdf-a'), password: 'motdepasse123' , acceptTerms: true});
    userIdA = a.body.user.id;
    tokenA = a.body.token;

    const b = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Testeur PDF B', email: emailDeTest('pdf-b'), password: 'motdepasse123' , acceptTerms: true});
    userIdB = b.body.user.id;
    tokenB = b.body.token;

    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Client PDF' });

    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ client_id: client.body.client.id, type: 'facture', lignes: [{ designation: 'Service', quantite: 1, prix_unitaire: 10000, tva: 18 }] });
    factureId = facture.body.facture.id;
  });

  after(async () => {
    await nettoyerUtilisateur(userIdA);
    await nettoyerUtilisateur(userIdB);
  });

  test('télécharge un vrai PDF pour une facture existante', async () => {
    const res = await request(app)
      .get(`/api/factures/${factureId}/pdf`)
      .set('Authorization', `Bearer ${tokenA}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'] === 'application/pdf' || res.headers['content-type'].startsWith('application/pdf;'), 'le fichier doit être servi en application/pdf');
    assert.match(res.headers['content-disposition'], /^attachment; filename="facture-/);
    // Un fichier PDF valide commence toujours par la signature "%PDF-".
    assert.equal(res.body.slice(0, 5).toString('latin1'), '%PDF-');
  });

  test('les cinq nouveaux modèles produisent chacun un vrai PDF avec Puppeteer', async () => {
    const nouveauxModeles = ['nova', 'nordique', 'luxe', 'tech', 'horizon'];

    for (const modele of nouveauxModeles) {
      await pool.query(
        'UPDATE users SET facture_template = ? WHERE id = ?',
        [modele, userIdA]
      );

      const res = await request(app)
        .get(`/api/factures/${factureId}/pdf`)
        .set('Authorization', `Bearer ${tokenA}`)
        .buffer(true)
        .parse((response, callback) => {
          const chunks = [];
          response.on('data', chunk => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      assert.equal(res.status, 200, modele + ' doit générer une réponse HTTP 200');
      assert.match(res.headers['content-type'] || '', /^application\/pdf(?:;|$)/,
        modele + ' doit renvoyer un fichier PDF');
      assert.equal(res.body.slice(0, 5).toString('latin1'), '%PDF-',
        modele + ' doit produire une signature PDF valide');
      assert.ok(res.body.length > 1500,
        modele + ' ne doit pas produire un PDF vide ou tronqué');
      assert.match(res.body.toString('latin1'), /\/Type\s*\/Page\b/,
        modele + ' doit contenir au moins une page PDF');
    }
  });

  test("l'impression force le thème papier puis restaure le thème utilisateur", async () => {
    const baseUrl = process.env.PDF_BASE_URL;
    assert.ok(baseUrl, 'le serveur HTTP de test doit être démarré');

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
      await page.evaluateOnNewDocument((token, apiBaseUrl) => {
        localStorage.setItem('sf_token', token);
        localStorage.setItem('sf_theme', 'auto');
        window.SAMAFACTURE_API_URL = apiBaseUrl;
      }, tokenA, `${baseUrl}/api`);

      await page.goto(`${baseUrl}/facture-detail.html?id=${factureId}`, {
        waitUntil: 'networkidle0',
        timeout: 20000
      });
      await page.waitForFunction(() => window.__docReady === true, { timeout: 15000 });

      const lireEtatTheme = () => page.evaluate(() => ({
        theme: document.documentElement.getAttribute('data-theme'),
        couleurFondApp: getComputedStyle(document.documentElement).getPropertyValue('--cream').trim(),
        toolbar: getComputedStyle(document.querySelector('.toolbar')).display,
        fondDocument: getComputedStyle(document.querySelector('.invoice-doc')).backgroundColor
      }));

      // En mode système sombre, la page suit d'abord la préférence du navigateur.
      let etat = await lireEtatTheme();
      assert.equal(etat.theme, null);
      assert.equal(etat.couleurFondApp.toLowerCase(), '#0f1420');

      // L'aperçu imprimé doit être clair quel que soit le thème de l'application.
      await page.emulateMediaType('print');
      await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
      etat = await lireEtatTheme();
      assert.equal(etat.theme, 'light');
      assert.equal(etat.couleurFondApp.toLowerCase(), '#f6f4ee');
      assert.equal(etat.toolbar, 'none');
      assert.equal(etat.fondDocument, 'rgb(255, 255, 255)');

      // À la fermeture de l'aperçu, le mode système sombre doit être rétabli.
      await page.emulateMediaType('screen');
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      etat = await lireEtatTheme();
      assert.equal(etat.theme, null);
      assert.equal(etat.couleurFondApp.toLowerCase(), '#0f1420');

      // Le même cycle doit préserver un choix sombre explicite de l'utilisateur.
      await page.evaluate(() => window.SamaTheme.definir('dark'));
      await page.emulateMediaType('print');
      await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
      etat = await lireEtatTheme();
      assert.equal(etat.theme, 'light');
      await page.emulateMediaType('screen');
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      etat = await lireEtatTheme();
      assert.equal(etat.theme, 'dark');
      assert.equal(etat.couleurFondApp.toLowerCase(), '#0f1420');
    } finally {
      await browser.close().catch(() => {});
    }
  });

  test("B ne peut pas télécharger le PDF d'une facture de A (404, pas de fuite de document)", async () => {
    const res = await request(app)
      .get(`/api/factures/${factureId}/pdf`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert.equal(res.status, 404);
  });

  test("un devis (pas une facture) télécharge un PDF nommé 'devis-...'", async () => {
    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nom: 'Client Devis PDF' });
    const devis = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ client_id: client.body.client.id, type: 'devis', lignes: [{ designation: 'Étude', quantite: 1, prix_unitaire: 5000, tva: 18 }] });

    const res = await request(app)
      .get(`/api/factures/${devis.body.facture.id}/pdf`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-disposition'], /^attachment; filename="devis-/);
  });
});

// Fermeture des ressources après les hooks de nettoyage métier de ce fichier.
after(teardownTestEnvironment);
