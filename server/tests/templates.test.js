const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
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
  'prestige', 'heritage', 'diamant', 'epure', 'azur', 'circuit', 'platine', 'atelier', 'saveurs'
];

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
    entreprise_logo: null,
    signature_default: null,
    ...overrides
  };
}

const lignesDeTest = [
  { designation: 'Prestation de conseil', quantite: 2, prix_unitaire: 40000, tva: 18, total_ligne: 94400 },
  { designation: 'Frais de dossier', quantite: 1, prix_unitaire: 18600, tva: 18, total_ligne: 21948 }
];

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
      assert.doesNotMatch(html, /undefined|NaN/);
    });
  }

  test('un identifiant de modèle inconnu retombe sur le modèle "classique" (comportement déjà existant, non modifié)', () => {
    const html = templates.renderInvoiceHtml({
      user: userDeTest(), facture: factureDeTest(), lignes: lignesDeTest,
      isDevis: false, qrCode: null, template: 'ce-modele-nexiste-pas'
    });
    assert.match(html, /FA-2026-0042/);
  });
});
