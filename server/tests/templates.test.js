const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createFactureTemplates } = require('../../public/js/facture-templates.js');

// Test unitaire pur : ne touche ni la base de test ni le serveur HTTP, contrairement aux
// autres fichiers de ce dossier. Il exerce directement le moteur de rendu partagé par
// facture-detail.html et la génération PDF (server/utils/pdf.js), avec de fausses données,
// pour attraper deux régressions précises :
//  1) un modèle présent dans server/routes/auth.js (`templatesValides`) mais absent de
//     RENDERERS ici (l'utilisateur pourrait enregistrer un modèle qui ne s'affiche jamais) ;
//  2) un modèle qui plante ou renvoie du HTML vide/incomplet pour une facture ou un devis.

// Doit rester synchronisé avec `templatesValides` dans server/routes/auth.js. Une divergence
// dans un sens ou dans l'autre fait échouer 'tous les modèles connus du serveur sont rendables'.
const TEMPLATES_ATTENDUS = [
  'classique', 'moderne', 'minimaliste', 'elegant', 'corporate', 'creatif',
  'prestige', 'heritage', 'diamant', 'executive', 'institution', 'signature', 'consolide',
  'epure', 'azur', 'circuit', 'platine', 'atelier', 'saveurs',
  'nova', 'nordique', 'luxe', 'tech', 'horizon',
  'eclipse', 'saphir', 'conseil', 'imperial', 'panorama', 'groupe', 'majeste'
];

describe('Galerie de sélection des modèles (public/parametres.html)', () => {
  test('les cinq nouveaux modèles apparaissent dans la galerie et restent accessibles à tous les plans', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../public/parametres.html'), 'utf8');
    for (const id of ['nova', 'nordique', 'luxe', 'tech', 'horizon']) {
      assert.match(source, new RegExp("id: '" + id + "', name:"), id + ' doit être dans la galerie');
      assert.ok(source.includes('<option value="' + id + '">'), id + ' doit être dans le sélecteur natif');
      assert.match(source, new RegExp("id: '" + id + "'[^\\n]*tier: 'all'"), id + ' doit être disponible sur tous les plans');
    }
  });

  test('présente les trente et un rendus réels et affiche clairement les restrictions de formule', () => {
    const settingsPath = path.resolve(__dirname, '../../public/parametres.html');
    const source = fs.readFileSync(settingsPath, 'utf8');
    const declaration = source.match(/const INVOICE_TEMPLATE_META = \[([\s\S]*?)\n  \];/);

    assert.ok(declaration, 'La page Paramètres doit déclarer son catalogue visuel de modèles.');
    const galleryIds = Array.from(declaration[1].matchAll(/id: '([^']+)'/g), match => match[1]);
    assert.deepEqual([...galleryIds].sort(), [...TEMPLATES_ATTENDUS].sort(),
      'La galerie doit rester synchronisée avec les trente et un modèles rendus par le moteur.');

    assert.match(source, /id="invoice-template-gallery"/,
      'La page doit offrir une zone de galerie dédiée.');
    assert.match(source, /renderer\.renderInvoiceHtml\(/,
      'Les vignettes doivent utiliser le véritable moteur de rendu des factures.');
    assert.match(source, /invoice-template-preview-canvas/,
      'Chaque modèle doit être présenté dans un aperçu visuel.');
    assert.match(source, /data-select-template/,
      'Un modèle disponible doit pouvoir être sélectionné depuis sa vignette.');
    assert.match(source, /aria-pressed/,
      'La sélection doit être annoncée correctement aux technologies d’assistance.');
    for (const id of ['eclipse', 'saphir', 'conseil']) {
      assert.match(source, new RegExp("id: '" + id + "'[^\\n]*tier: 'pro'"), id + ' doit être réservé au plan Pro');
      assert.ok(source.includes('<option value="' + id + '">'), id + ' doit être présent dans le sélecteur natif');
    }
    for (const id of ['imperial', 'panorama', 'groupe', 'majeste']) {
      assert.match(source, new RegExp("id: '" + id + "'[^\\n]*tier: 'enterprise'"), id + ' doit être réservé au plan Entreprise');
      assert.ok(source.includes('<option value="' + id + '">'), id + ' doit être présent dans le sélecteur natif');
    }
    assert.match(source, /PRO_TEMPLATE_IDS = new Set\(\['elegant', 'corporate', 'creatif', 'eclipse', 'saphir', 'conseil'\]\)/,
      'Les modèles Pro doivent être clairement identifiés comme réservés au plan Pro.');
    assert.match(source, /ENTERPRISE_TEMPLATE_IDS = new Set\(\['prestige', 'heritage', 'diamant', 'platine', 'executive', 'institution', 'signature', 'consolide', 'imperial', 'panorama', 'groupe', 'majeste'\]\)/,
      'Les modèles Entreprise doivent être clairement identifiés comme réservés au plan Entreprise.');
    assert.match(source, /invoice-template-native-select/,
      'La valeur choisie dans la galerie doit rester synchronisée avec le champ enregistré.');
  });
});

function helpersDeTest() {
  return {
    escapeHtml: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    formatMontant: (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`,
    formatDate: (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : ''),
    statutBadge: (statut) => `<span class="badge">${statut}</span>`
  };
}

function factureDeTest(overrides = {}) {
  return {
    numero: 'FA-2026-0042',
    client_nom: 'Client Test SARL',
    client_adresse: 'Dakar, Sénégal',
    client_telephone: '+221 77 000 00 00',
    client_email: 'client@test.sn',
    date_emission: '2026-08-01',
    date_echeance: '2026-08-31',
    date_validite: '2026-08-15',
    objet: 'Installation informatique',
    reference_externe: 'BC-2026-014',
    conditions_reglement: 'Acompte de 30 % à la commande.',
    statut: 'en_attente',
    sous_total: 100000,
    total_tva: 18000,
    remise: 5000,
    frais_livraison: 0,
    total: 113000,
    montant_paye: 0,
    commentaires: 'Paiement à 30 jours. Conditions générales de vente disponibles sur demande.',
    mode_paiement: 'Virement bancaire',
    ...overrides
  };
}

function userDeTest(overrides = {}) {
  return {
    nom: 'Utilisateur Test',
    entreprise_nom: 'Entreprise Test',
    entreprise_adresse: 'Dakar, Sénégal',
    entreprise_telephone: '+221 33 000 00 00',
    entreprise_email: 'contact@entreprise-test.sn',
    entreprise_ninea: '123456789',
    entreprise_rccm: 'SN-DKR-2026-B-1234',
    entreprise_site_web: 'https://entreprise-test.sn',
    entreprise_banque: 'Banque de Test',
    entreprise_rib: 'SN00 1111 2222 3333',
    entreprise_conditions_reglement: 'Paiement à 30 jours.',
    entreprise_mentions_legales: 'SARL au capital de 1 000 000 FCFA.',
    entreprise_logo: null,
    signature_default: null,
    ...overrides
  };
}

const lignesDeTest = [
  { designation: 'Prestation de conseil', quantite: 2, prix_unitaire: 40000, tva: 18, total_ligne: 94400 },
  { designation: 'Frais de dossier', quantite: 1, prix_unitaire: 18600, tva: 18, total_ligne: 21948 },
  // Une ligne exonérée garantit que les tests couvrent bien plusieurs taux de TVA.
  { designation: 'Document exonéré', quantite: 1, prix_unitaire: 5000, tva: 0, total_ligne: 5000 }
];

describe('Consultation publique des factures et devis', () => {
  test('la page publique utilise le moteur partagé et la personnalisation enregistrée', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../public/consulter.html'), 'utf8');
    const route = fs.readFileSync(path.resolve(__dirname, '../routes/public.js'), 'utf8');
    assert.match(source, /js\/facture-templates\.js/);
    assert.match(source, /templates\.renderInvoiceHtml\(/);
    assert.match(source, /facture\.facture_personnalisation/);
    assert.match(route, /f\.date_validite/);
    assert.match(route, /f\.devise/);
    assert.match(route, /u\.facture_template/);
  });
});
describe('Modèles de facture (public/js/facture-templates.js)', () => {
  const templates = createFactureTemplates(helpersDeTest());

  test('la liste des modèles connus correspond à templatesValides côté serveur', () => {
    assert.deepEqual(Object.keys(templates.RENDERERS).sort(), [...TEMPLATES_ATTENDUS].sort());
  });

  for (const template of TEMPLATES_ATTENDUS) {
    test(`le modèle "${template}" se rend sans erreur pour une facture`, () => {
      const html = templates.renderInvoiceHtml({
        user: userDeTest(), facture: factureDeTest(), lignes: lignesDeTest,
        isDevis: false, qrCode: 'data:image/png;base64,fake', template
      });
      assert.ok(html && html.length > 200, 'le HTML généré ne doit pas être vide');
      assert.match(html, /FA-2026-0042/, 'le numéro de facture doit apparaître');
      assert.match(html, /Client Test SARL/, 'le nom du client doit apparaître');
      assert.match(html, /Installation informatique/, 'l’objet du document doit apparaître');
      assert.match(html, /BC-2026-014/, 'la référence client doit apparaître');
      assert.match(html, /Prix unitaire HT/, 'le prix unitaire doit être identifié comme HT');
      assert.match(html, /Montant TTC/, 'le total de ligne doit être identifié comme TTC');
      assert.match(html, /Reste à payer/, 'le solde restant dû doit apparaître');
      assert.match(html, /Détail de la TVA par taux/, 'les taux de TVA multiples doivent être détaillés');
      assert.match(html, /SN-DKR-2026-B-1234/, 'le RCCM de l’entreprise doit apparaître');
      assert.match(html, /\+221 33 000 00 00/, 'le téléphone de l’entreprise doit apparaître');
      assert.match(html, /contact@entreprise-test\.sn/, 'l’email de l’entreprise doit apparaître');
      assert.match(html, /Banque de Test/, 'les coordonnées bancaires doivent apparaître');
      assert.match(html, /Acompte de 30 % à la commande/, 'les conditions du document doivent apparaître');
      assert.doesNotMatch(html, /undefined|NaN/, 'aucune valeur non définie ne doit fuiter dans le HTML');
    });

    test(`le modèle "${template}" se rend sans erreur pour un devis (sans logo ni signature)`, () => {
      const html = templates.renderInvoiceHtml({
        user: userDeTest({ entreprise_logo: null, signature_default: null }),
        facture: factureDeTest({ numero: 'DV-2026-0007', statut: 'en_attente' }),
        lignes: lignesDeTest, isDevis: true, qrCode: null, template
      });
      assert.ok(html && html.length > 200);
      assert.match(html, /DV-2026-0007/);
      assert.match(html, /Validité du devis/, 'la date de validité du devis doit apparaître');
      assert.match(html, /Bon pour accord/, 'le devis doit proposer une zone d’acceptation');
      assert.match(html, /Signature et cachet/, 'la zone d’acceptation doit prévoir une signature client');
      assert.doesNotMatch(html, /Reste à payer/, 'un devis ne doit pas afficher un solde à payer');
      assert.doesNotMatch(html, /undefined|NaN/);
    });
  }

  test('un devis conserve sa zone Bon pour accord même sans coordonnées bancaires ou mentions légales', () => {
    const user = userDeTest({
      entreprise_ninea: null, entreprise_rccm: null, entreprise_site_web: null,
      entreprise_banque: null, entreprise_rib: null,
      entreprise_conditions_reglement: null, entreprise_mentions_legales: null
    });
    const quote = factureDeTest({
      numero: 'DV-SANS-OPTIONS',
      date_validite: null,
      objet: null,
      reference_externe: null,
      conditions_reglement: null
    });
    const html = templates.renderInvoiceHtml({
      user, facture: quote, lignes: lignesDeTest,
      isDevis: true, qrCode: null, template: 'classique'
    });
    assert.match(html, /Bon pour accord/);
    assert.match(html, /Signature et cachet/);
    assert.doesNotMatch(html, /undefined|NaN/);
  });

  test('les données personnalisées sont échappées et les compléments optionnels restent facultatifs', () => {
    const html = templates.renderInvoiceHtml({
      user: userDeTest({
        entreprise_rccm: null, entreprise_banque: null, entreprise_rib: null,
        entreprise_conditions_reglement: null, entreprise_mentions_legales: null
      }),
      facture: factureDeTest({
        objet: '<img src=x onerror=alert(1)>',
        reference_externe: null,
        conditions_reglement: null
      }),
      lignes: lignesDeTest, isDevis: false, qrCode: null, template: 'classique'
    });
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(html, /<img src=x onerror/);
    assert.doesNotMatch(html, /undefined|NaN/);
  });

  test('les trente et un modèles distinguent le prix HT, le total TTC et le solde de facture', () => {
    for (const template of TEMPLATES_ATTENDUS) {
      const html = templates.renderInvoiceHtml({
        user: userDeTest(), facture: factureDeTest({ montant_paye: 25000 }), lignes: lignesDeTest,
        isDevis: false, qrCode: null, template
      });
      assert.match(html, /sf-document-table/, template + ' doit utiliser le tableau commun');
      assert.match(html, /Prix unitaire HT/, template + ' doit identifier les prix unitaires HT');
      assert.match(html, /Montant TTC/, template + ' doit identifier le total TTC des lignes');
      assert.match(html, /Sous-total HT/, template + ' doit séparer le sous-total HT');
      assert.match(html, /Déjà réglé/, template + ' doit présenter les sommes reçues');
      assert.match(html, /Paiement partiel/, template + ' doit signaler un règlement partiel');
      assert.doesNotMatch(html, /Non payée/, template + ' ne doit pas qualifier de non payée une facture avec acompte');
      assert.match(html, /Reste à payer/, template + ' doit afficher le solde dû');
      assert.match(html, /Coordonnées de règlement/, template + ' doit présenter les informations bancaires configurées');
      assert.doesNotMatch(html, /undefined|NaN/);
    }
  });

  test('les trente et un modèles génèrent une identité A4 répétable pour les factures et les devis', () => {
    for (const template of TEMPLATES_ATTENDUS) {
      for (const isDevis of [false, true]) {
        const numero = isDevis ? 'DV-IDENTITE-2026-0988' : 'FAC-IDENTITE-2026-0987';
        const css = templates.printPageIdentityCss({
          user: userDeTest({ entreprise_nom: 'SamaFacture Société & Fils' }),
          facture: factureDeTest({ numero }),
          isDevis
        });
        assert.ok(css.includes('@top-left { content: none; border: 0; }'),
          template + ' doit masquer le rappel compact sur la première page.');
        assert.ok(css.includes('@top-right { content: none; border: 0; }'),
          template + ' doit masquer la référence compacte sur la première page.');
          template + ' doit répéter le nom de l’entreprise dans la marge A4.');
        assert.match(css, /@top-right/,
          template + ' doit répéter la référence dans la marge A4.');
        assert.match(css, /@page:first/,
          template + ' doit préserver le grand bandeau principal sur la première page.');
        assert.match(css, /@top-left \\{ content: none; border: 0; \\}/,
          template + ' doit masquer le rappel compact sur la première page.');
        assert.ok(css.includes('"SamaFacture Société & Fils"'),
          template + ' doit inclure le nom de l’entreprise.');
        assert.ok(css.includes(
          '"' + (isDevis ? 'DEVIS' : 'FACTURE') + ' · ' + numero + '"'
        ), template + ' doit inclure le type et le numéro du document.');
        assert.doesNotMatch(css, /undefined|NaN/);
      }
    }
  });

  test('les noms d’entreprise sont échappés comme chaînes CSS et ne peuvent pas injecter une règle @page', () => {
    const css = templates.printPageIdentityCss({
      user: userDeTest({ entreprise_nom: 'Sama" } @page { size: A0; /*\nInjected' }),
      facture: factureDeTest(),
      isDevis: false
    });
    assert.ok(css.includes('"Sama\\" } @page { size: A0; /*\\a Injected"'),
      'Les guillemets et retours à la ligne doivent rester dans une seule chaîne CSS.');
  });

  test('les trente et un modèles identifient clairement les dates de facture', () => {
    for (const template of TEMPLATES_ATTENDUS) {
      const html = templates.renderInvoiceHtml({
        user: userDeTest(),
        facture: factureDeTest({ date_emission: '2026-08-01', date_echeance: '2026-08-31' }),
        lignes: lignesDeTest, isDevis: false, qrCode: null, template
      });
      assert.match(html, /Date d(?:'|’)émission/, template + ' doit nommer la date d’émission');
      assert.match(html, /Échéance/, template + ' doit nommer la date limite de paiement');
      assert.match(html, /31\/08\/2026/, template + ' doit afficher la date d’échéance');
    }
  });

  test('un devis affiche sa date de validité et ne présente jamais une échéance de paiement', () => {
    for (const template of TEMPLATES_ATTENDUS) {
      const html = templates.renderInvoiceHtml({
        user: userDeTest(), facture: factureDeTest({
          numero: 'DV-VALIDITE-2026',
          date_echeance: null,
          date_validite: '2026-08-15',
          conditions_reglement: 'Acompte après acceptation.'
        }), lignes: lignesDeTest,
        isDevis: true, qrCode: null, template
      });
      assert.match(html, /Validité du devis/, template + ' doit nommer correctement la date du devis');
      assert.match(html, /15\/08\/2026/, template + ' doit afficher la date de validité enregistrée');
      assert.doesNotMatch(html, /Échéance/, template + ' ne doit pas parler d’échéance pour un devis');
      assert.match(html, /Bon pour accord/, template + ' doit conserver la zone d’acceptation');
      assert.doesNotMatch(html, /Reste à payer/, template + ' ne doit pas créer de solde de paiement sur un devis');
    }
  });

  test('le solde de paiement est plafonné à zéro pour une facture intégralement réglée', () => {
    const html = templates.renderInvoiceHtml({
      user: userDeTest(),
      facture: factureDeTest({ montant_paye: 150000 }),
      lignes: lignesDeTest, isDevis: false, qrCode: null, template: 'classique'
    });
    assert.match(html, /sf-payment-balance[\s\S]*?0 FCFA/,
      'le solde restant dû ne doit jamais devenir négatif après règlement intégral');
    assert.match(html, /Payée/, 'une facture dont le montant reçu couvre le total doit être estampillée Payée');
  });

  test('un identifiant de modèle inconnu retombe sur le modèle "classique" (comportement déjà existant, non modifié)', () => {
    const html = templates.renderInvoiceHtml({
      user: userDeTest(), facture: factureDeTest(), lignes: lignesDeTest,
      isDevis: false, qrCode: null, template: 'ce-modele-nexiste-pas'
    });
    assert.match(html, /FA-2026-0042/);
  });
});


describe('Impression et génération PDF', () => {
  const pageSource = fs.readFileSync(path.resolve(__dirname, '../../public/facture-detail.html'), 'utf8');
  const pdfSource = fs.readFileSync(path.resolve(__dirname, '../utils/pdf.js'), 'utf8');
  const visualSource = fs.readFileSync(path.resolve(__dirname, 'visual/recette-visuelle.js'), 'utf8');
  const cssSource = fs.readFileSync(path.resolve(__dirname, '../../public/css/style.css'), 'utf8');
  const rendererSource = fs.readFileSync(path.resolve(__dirname, '../../public/js/facture-templates.js'), 'utf8');

  test("l'impression force temporairement la palette papier puis restaure le thème utilisateur", () => {
    assert.match(pageSource, /window\.addEventListener\('beforeprint', preparerThemeImpression\)/);
    assert.match(pageSource, /window\.addEventListener\('afterprint', restaurerThemeApresImpression\)/);
    assert.match(pageSource, /setAttribute\('data-theme', 'light'\)/);
    assert.match(pageSource, /removeAttribute\('data-theme'\)/,
      "Le thème système doit être restauré lorsqu'aucun thème explicite n'était mémorisé.");
    assert.match(pdfSource, /setAttribute\('data-theme', 'light'\)/,
      'La génération PDF serveur doit aussi ignorer le thème sombre mémorisé.');
  });

  test("les polices écran et PDF utilisent les familles réellement chargées", () => {
    assert.match(cssSource, /@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=IBM\+Plex\+Mono/);
    assert.match(cssSource, /--font-display:\s*'IBM Plex Sans', Arial, sans-serif/);
    assert.match(cssSource, /--font-body:\s*'IBM Plex Sans', Arial, sans-serif/);
    assert.match(cssSource, /--font-mono:\s*'IBM Plex Mono', 'Courier New', monospace/);
    assert.match(cssSource, /\.invoice-doc\s*\{[^}]*font-family:\s*var\(--font-body\)/s,
      'Le document doit déclarer explicitement sa famille de texte, sans dépendre de body.');
    assert.match(cssSource, /\.invoice-doc h1,[\s\S]*?font-family:\s*var\(--font-display\)/,
      'Les titres imprimés doivent utiliser explicitement la police display.');
    assert.doesNotMatch(cssSource, /--font-(?:display|body|mono):\s*'(?:Manrope|Inter|JetBrains Mono)'/,
      'Les variables ne doivent pas demander des polices qui ne sont pas chargées.');
  });

  test("la police personnalisée pilote également les titres qui utilisent les variables du modèle", () => {
    const model = createFactureTemplates({
      escapeHtml: (s) => String(s ?? ''),
      formatMontant: (n) => String(n ?? 0) + ' FCFA',
      formatDate: (d) => String(d ?? ''),
      statutBadge: () => '<span class="badge">Test</span>'
    });
    const html = model.renderInvoiceHtml({
      user: { nom: 'Entreprise', entreprise_nom: 'Entreprise' },
      facture: { numero: 'FA-TEST', sous_total: 100, total_tva: 18, total: 118, statut: 'en_attente' },
      lignes: [{ designation: 'Prestation', quantite: 1, prix_unitaire: 100, tva: 18, total_ligne: 118 }],
      isDevis: false,
      template: 'classique',
      personnalisation: { police: 'serif' }
    });
    assert.match(html, /--font-display:Georgia, 'Times New Roman', serif/);
    assert.match(html, /--font-body:Georgia, 'Times New Roman', serif/);
    assert.match(html, /font-family:Georgia, 'Times New Roman', serif/);
    const wrapperOpeningTag = html.slice(0, html.indexOf('>') + 1);
    assert.equal((wrapperOpeningTag.match(/"/g) || []).length, 2,
      'Les piles de polices ne doivent pas casser les guillemets de l’attribut style HTML.');
  });

  test("les micro-libellés des modèles ne descendent pas sous 9 pt à l'impression", () => {
    const fixedRemSizes = Array.from(
      rendererSource.matchAll(/font-size:\s*((?:\d*\.)\d+)rem/g),
      match => match[1]
    );
    const belowPrintMinimum = [...new Set(fixedRemSizes)]
      .filter(size => Number(size) < 0.75);
    assert.ok(belowPrintMinimum.length > 0,
      'Le catalogue doit être audité sur ses petites tailles fixes.');
    for (const size of belowPrintMinimum) {
      assert.ok(cssSource.includes('[style*="font-size:' + size + 'rem"]'),
        'La taille ' + size + 'rem doit être remontée à 9 pt dans le média print.');
    }
    assert.match(cssSource, /\.invoice-doc \[style\*="font-size:[^"]+"\]\s*\{\s*font-size:\s*9pt !important;/s,
      'Les mentions secondaires ciblées doivent être lisibles dans les PDF.');
  });

  test("l'impression A4 utilise une seule marge, une taille lisible et une pagination ciblée", () => {
    assert.match(pageSource, /@page\s*\{\s*size:\s*A4 portrait;\s*margin:\s*12mm 12mm 14mm;/);
    assert.match(pageSource, /padding:\s*0 !important/);
    assert.match(cssSource, /@media print[\s\S]*?\.invoice-doc[\s\S]*?font-size:\s*10pt !important/);
    assert.match(cssSource, /font-size:\s*9pt !important/);
    assert.match(cssSource, /\.invoice-doc \.sf-document-table thead\s*\{\s*display:\s*table-header-group !important;/);
    assert.doesNotMatch(cssSource, /\.invoice-doc \.grid,\s*\.invoice-doc \.sf-totals/,
      'Les grilles ordinaires ne doivent plus être forcées à rester indivisibles sur une page.');
    assert.doesNotMatch(pdfSource, /margin:\s*\{\s*top:/,
      'Puppeteer ne doit pas redéfinir des marges déjà fixées par @page.');
    assert.doesNotMatch(visualSource, /margin:\s*\{\s*top:/,
      'La recette PDF visuelle ne doit pas redéfinir les marges déjà fixées par @page.');
    assert.match(pdfSource, /preferCSSPageSize:\s*true/);
    assert.match(visualSource, /preferCSSPageSize:\s*true/);
    assert.match(rendererSource, /class="sf-doc-footer"/,
      'Le pied de facture doit rester groupé lors des sauts de page.');
  });

  test('le téléchargement laisse au navigateur le temps de lire le fichier PDF', () => {
    assert.match(pageSource, /setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 60_000\)/);
    assert.match(pageSource, /if \(!blob\.size\)/,
      'Un fichier vide ne doit pas être présenté comme un téléchargement réussi.');
  });
});
