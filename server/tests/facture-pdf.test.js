const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const puppeteer = require('puppeteer');
const { app, pool, setupTestDatabase, emailDeTest, nettoyerUtilisateur, teardownTestEnvironment } = require('./setup');

// GET /api/factures/:id/pdf (génération via Puppeteer, utils/pdf.js) n'était pas testé.
// Nécessite un Chromium installé/téléchargeable (voir npm postinstall de puppeteer) — pas
// exécutable dans un environnement sans accès réseau, mais doit passer en CI/local normal.
const TOUS_LES_MODELES_FACTURE = [
  'classique', 'moderne', 'minimaliste', 'elegant', 'corporate', 'creatif',
  'prestige', 'heritage', 'diamant', 'executive', 'institution', 'signature', 'consolide',
  'epure', 'azur', 'circuit', 'platine', 'atelier', 'saveurs',
  'nova', 'nordique', 'luxe', 'tech', 'horizon',
  'eclipse', 'saphir', 'conseil', 'imperial', 'panorama', 'groupe', 'majeste'
];

describe('Génération PDF de facture', () => {
  let userIdA, tokenA, userIdB, tokenB, factureId, clientId;

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
    clientId = client.body.client.id;

    const facture = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ client_id: clientId, type: 'facture', lignes: [{ designation: 'Service', quantite: 1, prix_unitaire: 10000, tva: 18 }] });
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

  test('les trente et un modèles produisent un vrai PDF A4 avec Puppeteer', async () => {
    for (const modele of TOUS_LES_MODELES_FACTURE) {
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
      const pdfLatin1 = res.body.toString('latin1');
      assert.match(pdfLatin1, /\/Type\s*\/Page\b/,
        modele + ' doit contenir au moins une page PDF');
      const mediaBox = pdfLatin1.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
      assert.ok(mediaBox, modele + ' doit déclarer une zone de page PDF.');
      assert.ok(Math.abs(Number(mediaBox[1]) - 595.28) < 1.5 &&
        Math.abs(Number(mediaBox[2]) - 841.89) < 1.5,
        modele + ' doit être au vrai format A4 portrait ; MediaBox=' + mediaBox.slice(1).join(' × '));
      const pageCount = (pdfLatin1.match(/\/Type\s*\/Page\b/g) || []).length;
      assert.ok(pageCount >= 1 && pageCount <= 2,
        modele + ' ne doit pas créer de pagination excessive pour une facture simple (pages=' + pageCount + ')');
      const nomsPolicesPdf = Array.from(
        pdfLatin1.matchAll(/\/(?:BaseFont|FontName)\s*\/([^\s/]+)/g),
        match => match[1]
      );
      const sansIntegree = nomsPolicesPdf.some(name => /IBMPlexSans/i.test(name));
      if (!sansIntegree) {
        // Conserver le vrai PDF fautif dans l'artefact de diagnostic CI pour analyser
        // les ressources de police avec pdffonts/PDFium, sans affaiblir l'assertion.
        const diagnosticDir = path.resolve(__dirname, 'diagnostics');
        fs.mkdirSync(diagnosticDir, { recursive: true });
        fs.writeFileSync(path.join(diagnosticDir, 'police-manquante-' + modele + '.pdf'), res.body);
      }
      assert.ok(sansIntegree,
        modele + ' doit intégrer IBM Plex Sans dans le vrai PDF, polices trouvées : ' + nomsPolicesPdf.join(', '));
      assert.ok(nomsPolicesPdf.some(name => /IBMPlexMono/i.test(name)),
        modele + ' doit intégrer IBM Plex Mono dans le vrai PDF, polices trouvées : ' + nomsPolicesPdf.join(', '));
    }
  });

  test('les trente et un modèles produisent un vrai PDF A4 pour un devis', async () => {
    const devis = await request(app)
      .post('/api/factures')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        client_id: clientId,
        type: 'devis',
        date_validite: '2026-12-15',
        lignes: [{ designation: 'Prestation de conseil', quantite: 1, prix_unitaire: 10000, tva: 18 }]
      });
    assert.equal(devis.status, 201, devis.text);

    for (const modele of TOUS_LES_MODELES_FACTURE) {
      await pool.query(
        'UPDATE users SET facture_template = ? WHERE id = ?',
        [modele, userIdA]
      );

      const res = await request(app)
        .get(`/api/factures/${devis.body.facture.id}/pdf`)
        .set('Authorization', `Bearer ${tokenA}`)
        .buffer(true)
        .parse((response, callback) => {
          const chunks = [];
          response.on('data', chunk => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      assert.equal(res.status, 200, modele + ' doit générer un PDF de devis en HTTP 200');
      assert.match(res.headers['content-type'] || '', /^application\/pdf(?:;|$)/,
        modele + ' doit renvoyer un fichier PDF de devis');
      assert.match(res.headers['content-disposition'] || '', /^attachment; filename="devis-/,
        modele + ' doit nommer le téléchargement comme un devis');
      assert.equal(res.body.slice(0, 5).toString('latin1'), '%PDF-',
        modele + ' doit produire une signature PDF valide');
      assert.ok(res.body.length > 1500,
        modele + ' ne doit pas produire un PDF de devis vide ou tronqué');

      const pdfLatin1 = res.body.toString('latin1');
      const mediaBox = pdfLatin1.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
      assert.ok(mediaBox, modele + ' doit déclarer une zone de page PDF.');
      assert.ok(Math.abs(Number(mediaBox[1]) - 595.28) < 1.5 &&
        Math.abs(Number(mediaBox[2]) - 841.89) < 1.5,
        modele + ' doit être au vrai format A4 portrait ; MediaBox=' + mediaBox.slice(1).join(' × '));

      const pageCount = (pdfLatin1.match(/\/Type\s*\/Page\b/g) || []).length;
      assert.ok(pageCount >= 1 && pageCount <= 2,
        modele + ' ne doit pas créer une pagination excessive pour un devis simple (pages=' + pageCount + ')');

      const fontNames = Array.from(
        pdfLatin1.matchAll(/\/(?:BaseFont|FontName)\s*\/([^\s/]+)/g),
        match => match[1]
      );
      assert.ok(fontNames.some(name => /IBMPlexSans/i.test(name)),
        modele + ' doit intégrer IBM Plex Sans au PDF du devis, polices trouvées : ' + fontNames.join(', '));
      assert.ok(fontNames.some(name => /IBMPlexMono/i.test(name)),
        modele + ' doit intégrer IBM Plex Mono au PDF du devis, polices trouvées : ' + fontNames.join(', '));
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
      await page.evaluate(() => document.fonts && document.fonts.ready);

      const typographie = await page.evaluate(() => {
        const documentNode = document.querySelector('.invoice-doc');
        const headingNode = document.querySelector('.invoice-doc h1, .invoice-doc h2, .invoice-doc h3') || documentNode;
        const tableNode = document.querySelector('.invoice-doc .sf-doc-description') ||
          document.querySelector('.invoice-doc .sf-document-table td') || documentNode;
        return {
          documentFont: getComputedStyle(documentNode).fontFamily,
          headingFont: getComputedStyle(headingNode).fontFamily,
          tableFont: getComputedStyle(tableNode).fontFamily,
          fontSize: getComputedStyle(documentNode).fontSize,
          loadedFontFaces: document.fonts
            ? Array.from(document.fonts)
              .filter(face => face.status === 'loaded')
              .map(face => face.family.replace(/^["']|["']$/g, ''))
            : []
        };
      });
      assert.match(typographie.documentFont, /IBM Plex Sans/);
      assert.match(typographie.headingFont, /IBM Plex Sans/);
      assert.match(typographie.tableFont, /IBM Plex Sans/);
      assert.ok(typographie.loadedFontFaces.includes('IBM Plex Sans'),
        'IBM Plex Sans doit réellement être chargé, pas seulement déclaré en CSS.');
      assert.ok(typographie.loadedFontFaces.includes('IBM Plex Mono'),
        'IBM Plex Mono doit réellement être chargé pour les montants et références.');

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
      const printMetrics = await page.evaluate(() => ({
        paddingLeft: getComputedStyle(document.querySelector('.invoice-doc')).paddingLeft,
        paddingRight: getComputedStyle(document.querySelector('.invoice-doc')).paddingRight,
        fontSize: getComputedStyle(document.querySelector('.invoice-doc')).fontSize,
        tableFontSize: getComputedStyle(document.querySelector('.sf-document-table td')).fontSize
      }));
      assert.equal(printMetrics.paddingLeft, '0px',
        'Les marges A4 de @page ne doivent pas être doublées par un padding de 40 px.');
      assert.equal(printMetrics.paddingRight, '0px');
      assert.ok(Math.abs(parseFloat(printMetrics.fontSize) - 13.3333) < 0.2,
        'Le texte courant doit être imprimé à 10 pt minimum : ' + printMetrics.fontSize);
      assert.ok(Math.abs(parseFloat(printMetrics.tableFontSize) - 12) < 0.2,
        'Les lignes du tableau doivent être imprimées à 9 pt minimum : ' + printMetrics.tableFontSize);

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
