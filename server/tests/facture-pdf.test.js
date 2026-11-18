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

  test('les trente et un modèles produisent chacun un vrai PDF A4 avec Puppeteer', async () => {
    const modeles = [
      'classique', 'moderne', 'minimaliste', 'elegant', 'corporate', 'creatif',
      'prestige', 'heritage', 'diamant', 'executive', 'institution', 'signature', 'consolide',
      'epure', 'azur', 'circuit', 'platine', 'atelier', 'saveurs',
      'nova', 'nordique', 'luxe', 'tech', 'horizon',
      'eclipse', 'saphir', 'conseil', 'imperial', 'panorama', 'groupe', 'majeste'
    ];

    for (const modele of modeles) {
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
      const pdfSource = res.body.toString('latin1');
      assert.match(pdfSource, /\/Type\s*\/Page\b/,
        modele + ' doit contenir au moins une page PDF');
      const mediaBox = pdfSource.match(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/);
      assert.ok(mediaBox, modele + ' doit déclarer une zone de page PDF.');
      const widthPt = Number(mediaBox[3]) - Number(mediaBox[1]);
      const heightPt = Number(mediaBox[4]) - Number(mediaBox[2]);
      assert.ok(Math.abs(widthPt - 595.28) <= 2 && Math.abs(heightPt - 841.89) <= 2,
        modele + ' doit produire un PDF A4 portrait (' + widthPt.toFixed(2) + ' × ' + heightPt.toFixed(2) + ' pt).');
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
      const mediaSession = await page.createCDPSession();
      const appliquerMedia = (media) => mediaSession.send('Emulation.setEmulatedMedia', {
        media,
        features: [{ name: 'prefers-color-scheme', value: 'dark' }]
      });
      await appliquerMedia('screen');
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
        prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
        couleurFondApp: getComputedStyle(document.documentElement).getPropertyValue('--cream').trim(),
        toolbar: getComputedStyle(document.querySelector('.toolbar')).display,
        fondDocument: getComputedStyle(document.querySelector('.invoice-doc')).backgroundColor
      }));

      // En mode système sombre, la page suit la préférence du navigateur.
      let etat = await lireEtatTheme();
      assert.equal(etat.theme, null);
      assert.equal(etat.prefersDark, true);
      const couleurSystemeSombre = etat.couleurFondApp;

      // La palette claire de référence est lue depuis le vrai CSS, sans figer ses hexadécimaux.
      await page.evaluate(() => window.SamaTheme.definir('light'));
      const couleurPaletteClaire = (await lireEtatTheme()).couleurFondApp;
      assert.notEqual(couleurSystemeSombre, couleurPaletteClaire,
        'le navigateur doit réellement appliquer deux palettes distinctes');
      await page.evaluate(() => window.SamaTheme.definir('auto'));

      // L'aperçu imprimé doit reprendre exactement la palette claire de l'application.
      await appliquerMedia('print');
      await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
      etat = await lireEtatTheme();
      assert.equal(etat.theme, 'light');
      assert.equal(etat.couleurFondApp, couleurPaletteClaire);
      assert.equal(etat.toolbar, 'none');
      assert.equal(etat.fondDocument, 'rgb(255, 254, 252)', 'le fond papier doit rester blanc cassé en impression');

      // À la fermeture de l'aperçu, le mode système sombre doit être rétabli.
      await appliquerMedia('screen');
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      etat = await lireEtatTheme();
      assert.equal(etat.theme, null);
      assert.equal(etat.prefersDark, true);
      assert.equal(etat.couleurFondApp, couleurSystemeSombre);

      // Le même cycle doit préserver un choix sombre explicite de l'utilisateur.
      await page.evaluate(() => window.SamaTheme.definir('dark'));
      const couleurThemeSombreManuel = (await lireEtatTheme()).couleurFondApp;
      assert.notEqual(couleurThemeSombreManuel, couleurPaletteClaire);
      await appliquerMedia('print');
      await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
      etat = await lireEtatTheme();
      assert.equal(etat.theme, 'light');
      assert.equal(etat.couleurFondApp, couleurPaletteClaire);
      await appliquerMedia('screen');
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      etat = await lireEtatTheme();
      assert.equal(etat.theme, 'dark');
      assert.equal(etat.prefersDark, true);
      assert.equal(etat.couleurFondApp, couleurThemeSombreManuel);
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

  test('un devis volumineux ne repousse pas conditions et acceptation sur une page isolée', async () => {
    const client = await request(app)
      .post('/api/clients')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({ nom: 'Client Devis Pagination' });
    const lignes = Array.from({ length: 28 }, (_, index) => ({
      designation: 'Lot de prestation et fournitures prévu au devis — ' +
        String(index + 1).padStart(2, '0') +
        ' — Départements et services régionaux de gestion commerciale',
      quantite: index % 5 === 0 ? 2 : 1,
      prix_unitaire: 10000 + index * 250,
      tva: index % 4 === 0 ? 0 : 18
    }));
    const devis = await request(app)
      .post('/api/factures')
      .set('Authorization', 'Bearer ' + tokenA)
      .send({
        client_id: client.body.client.id,
        type: 'devis',
        objet: 'Proposition commerciale détaillée et conditions de réalisation',
        date_validite: '2026-12-17',
        conditions_reglement: 'Offre valable 30 jours. Exécution après accord du client et validation du calendrier.',
        lignes
      });
    assert.equal(devis.status, 201, devis.text);

    const res = await request(app)
      .get('/api/factures/' + devis.body.facture.id + '/pdf')
      .set('Authorization', 'Bearer ' + tokenA)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.slice(0, 5).toString('latin1'), '%PDF-');
    const pageCount = (res.body.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
    assert.ok(pageCount > 0, 'le PDF doit contenir au moins une page');
    assert.ok(pageCount <= 3,
      'les conditions et l’acceptation doivent suivre les totaux sans créer une quatrième page isolée (pages=' + pageCount + ')');
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
