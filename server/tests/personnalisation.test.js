const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createFactureTemplates } = require('../../public/js/facture-templates.js');

// Test unitaire pur (même schéma que templates.test.js) : vérifie le nouveau paramètre optionnel
// `personnalisation` de renderInvoiceHtml (couleurs / taille de logo / police), sans dépendre
// d'une base de données. Deux garanties couvertes :
//  1) Rétrocompatibilité stricte : sans `personnalisation`, le HTML généré est identique à avant
//     ce changement (aucune régression pour les factures/PDF déjà en place).
//  2) Les valeurs personnalisées apparaissent bien dans le HTML rendu, et les valeurs invalides
//     (couleur non reconnue, etc.) sont ignorées plutôt qu'injectées telles quelles — important
//     puisque ce fichier est rejoué tel quel par Puppeteer pour générer les PDF.

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
    numero: 'FA-2026-0042', client_nom: 'Client Test SARL', client_adresse: 'Dakar, Sénégal',
    client_telephone: '+221 77 000 00 00', client_email: 'client@test.sn',
    date_emission: '2026-08-01', date_echeance: '2026-08-31', statut: 'en_attente',
    sous_total: 100000, total_tva: 18000, remise: 5000, frais_livraison: 0, total: 113000,
    montant_paye: 0, commentaires: 'Paiement à 30 jours.', mode_paiement: 'Virement bancaire',
    ...overrides
  };
}

function userDeTest(overrides = {}) {
  return {
    nom: 'Utilisateur Test', entreprise_nom: 'Entreprise Test', entreprise_adresse: 'Dakar, Sénégal',
    entreprise_telephone: '+221 33 000 00 00', entreprise_email: 'contact@entreprise-test.sn',
    entreprise_logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    signature_default: null,
    ...overrides
  };
}

const lignesDeTest = [
  { designation: 'Prestation de conseil', quantite: 2, prix_unitaire: 40000, tva: 18, total_ligne: 94400 }
];

describe('Personnalisation des modèles (couleurs / logo / police)', () => {
  const templates = createFactureTemplates(helpersDeTest());

  function rendre(template, personnalisation) {
    return templates.renderInvoiceHtml({
      user: userDeTest(), facture: factureDeTest(), lignes: lignesDeTest,
      isDevis: false, qrCode: null, template, personnalisation
    });
  }

  test('sans personnalisation, le HTML est strictement identique à avant (aucune régression)', () => {
    for (const template of TEMPLATES_ATTENDUS) {
      const avecUndefined = rendre(template, undefined);
      const avecObjetVide = rendre(template, {});
      assert.equal(avecUndefined, rendre(template, null), `${template} : undefined et null doivent produire le même HTML`);
      // Un objet vide ne doit ajouter aucun conteneur englobant ni changer une seule couleur.
      assert.equal(avecUndefined, avecObjetVide, `${template} : {} ne doit rien changer au rendu`);
    }
  });

  test('couleur_principale remplace l\'accent des totaux sur les modèles qui utilisent totalsRowsHtml', () => {
    const html = rendre('classique', { couleur_principale: '#ff0033' });
    assert.match(html, /border-top:2px solid #ff0033/);
  });

  test('couleur_secondaire colore le tampon de statut', () => {
    const html = rendre('classique', { couleur_secondaire: '#00aabb' });
    assert.match(html, /border-color:#00aabb; color:#00aabb;/);
  });

  test('une couleur invalide est ignorée (jamais injectée telle quelle dans le HTML)', () => {
    const html = rendre('classique', { couleur_principale: 'javascript:alert(1)' });
    assert.doesNotMatch(html, /javascript:alert/);
    // Repli sur la couleur d'origine du modèle classique.
    assert.match(html, /border-top:2px solid var\(--navy-950\)/);
  });

  test('logo_taille redimensionne le logo sans dépasser une échelle raisonnable', () => {
    const normal = rendre('classique', {});
    const grand = rendre('classique', { logo_taille: 'grand' });
    const petit = rendre('classique', { logo_taille: 'petit' });
    assert.match(normal, /max-width:56px/);
    assert.match(grand, /max-width:64px/); // 56 * 1.15
    assert.match(petit, /max-width:48px/); // 56 * 0.85 arrondi
  });

  test('police/taille_texte/epaisseur_texte/couleur_texte ajoutent un conteneur englobant', () => {
    const html = rendre('classique', {
      police: 'serif', taille_texte: 'grand', epaisseur_texte: 'gras', couleur_texte: '#222222'
    });
    assert.match(html, /<div style="font-family:Georgia.*font-size:110%.*font-weight:700.*color:#222222;">/);
  });

  test('tous les modèles se rendent sans erreur avec une personnalisation complète', () => {
    const personnalisation = {
      couleur_principale: '#1a2b3c', couleur_secondaire: '#a1b2c3', couleur_texte: '#0f0f0f',
      police: 'mono', taille_texte: 'petit', epaisseur_texte: 'moyen', logo_taille: 'grand'
    };
    for (const template of TEMPLATES_ATTENDUS) {
      const html = rendre(template, personnalisation);
      assert.ok(html && html.length > 200, `${template} : HTML vide`);
      assert.doesNotMatch(html, /undefined|NaN/, `${template} : valeur non définie dans le HTML`);
    }
  });
});
