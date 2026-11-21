// Modèles de facture — extrait de facture-detail.html pour être réutilisé tel quel par la
// génération de PDF côté serveur (Puppeteer charge cette même page en headless, donc ce
// fichier tourne dans les deux cas dans un vrai navigateur : aucune réécriture nécessaire).
//
// `createFactureTemplates(helpers)` reçoit { escapeHtml, formatMontant, formatDate, statutBadge }
// (déjà disponibles globalement via js/api.js) plutôt que de les redéfinir ici.
function createFactureTemplates(helpers) {
  const { escapeHtml, formatMontant, formatDate, statutBadge } = helpers;

  // --- Personnalisation (couleurs / logo / police) --------------------------------------------
  // Objet optionnel `personnalisation` reçu par chaque renderXxx (voir renderInvoiceHtml en bas de
  // fichier). Absent ou vide => rendu strictement identique à avant (rétrocompatible avec
  // server/utils/pdf.js et les appels existants qui ne le passent pas encore).
  // Clés reconnues (toutes optionnelles) :
  //   couleur_principale : couleur d'accent — remplace la couleur de filet/bordure des totaux sur
  //     les 12 modèles qui utilisent totalsRowsHtml (les 3 modèles à bloc de totaux entièrement
  //     illustré — Créatif, Prestige — gardent leur propre palette, cf. RAPPORT_MODELES.md ; le
  //     tableau détaillé et les bandeaux propres à chaque modèle ne sont volontairement pas
  //     recolorés, pour ne pas casser l'identité visuelle travaillée modèle par modèle).
  //   couleur_secondaire : couleur du tampon "Payée / Non payée / Devis" (footerHtml).
  //   couleur_texte, police, taille_texte, epaisseur_texte : appliqués globalement via un
  //     conteneur englobant (n'écrasent pas les couleurs/tailles déjà fixées explicitement par un
  //     modèle, ex. les libellés en var(--ink-soft)).
  //   logo_taille : 'petit' | 'moyen' | 'grand' — redimensionne le logo proportionnellement à la
  //     taille prévue par chaque modèle, sans jamais dépasser son cadre (évite tout débordement).
  // Couleurs attendues au format hex (#rgb/#rrggbb) ou rgb()/rgba() — toute autre valeur est
  // ignorée silencieusement par sanitizeCssColor plutôt qu'injectée dans le HTML (ce fichier est
  // rejoué tel quel par Puppeteer pour la génération PDF).
  // Échelles volontairement resserrées : certains modèles logent le logo dans un cadre de taille
  // fixe (cercle, carré blanc...) sans `overflow:hidden` — un facteur trop grand le ferait déborder
  // visuellement de son cadre.
  const LOGO_ECHELLES = { petit: 0.85, moyen: 1, grand: 1.15 };

  // Polices proposées : uniquement des piles "web-safe" (aucun fichier de police à charger côté
  // Puppeteer pour la génération PDF, donc rendu garanti identique à l'écran et sur le PDF).
  const POLICES_AUTORISEES = {
    defaut: null,
    sans: 'Arial, Helvetica, sans-serif',
    serif: "Georgia, 'Times New Roman', serif",
    mono: "'Courier New', Courier, monospace"
  };
  const TAILLES_TEXTE = { petit: '92%', normal: '100%', grand: '110%' };
  const EPAISSEURS_TEXTE = { normal: '400', moyen: '500', gras: '700' };

  // Une valeur de couleur ne quitte cette fonction que si elle ressemble strictement à une couleur
  // CSS (hex ou rgb/rgba) : ce fichier est rejoué tel quel par Puppeteer pour générer les PDF, donc
  // toute valeur non reconnue est ignorée plutôt qu'injectée dans un attribut style="".
  function sanitizeCssColor(valeur) {
    if (typeof valeur !== 'string') return null;
    const v = valeur.trim();
    if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(v)) return v;
    if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)$/.test(v)) return v;
    return null;
  }

  /** Couleur d'accent (bordures de totaux, filets...). Repli sur la couleur propre au modèle. */
  function accentColor(personnalisation, fallback) {
    const c = personnalisation && sanitizeCssColor(personnalisation.couleur_principale);
    return c || fallback;
  }

  /** Couleur secondaire (tampon "Payée"/"Non payée"...). Repli : pas de couleur = classe CSS d'origine. */
  function secondaryColor(personnalisation, fallback) {
    const c = personnalisation && sanitizeCssColor(personnalisation.couleur_secondaire);
    return c || fallback;
  }

  // Enveloppe le HTML d'un modèle dans un conteneur qui porte la police, la taille de texte,
  // l'épaisseur et la couleur de texte par défaut choisies par l'utilisateur. N'affecte que les
  // éléments qui n'imposent pas déjà leur propre couleur/police inline (la plupart des libellés de
  // statut et des accents propres à chaque modèle restent inchangés, par conception).
  function wrapPersonnalisation(html, personnalisation) {
    if (!personnalisation) return html;
    const decls = [];
    const police = POLICES_AUTORISEES[personnalisation.police];
    if (police) {
      // Les modèles utilisent parfois var(--font-display) dans leurs titres inline.
      // Poser les variables sur le conteneur fait suivre le choix de police à ces titres
      // comme au texte courant, au lieu de ne changer que les éléments qui héritent.
      decls.push(`--font-display:${police}`);
      decls.push(`--font-body:${police}`);
      decls.push(`font-family:${police}`);
    }
    const taille = TAILLES_TEXTE[personnalisation.taille_texte];
    if (taille) decls.push(`font-size:${taille}`);
    const epaisseur = EPAISSEURS_TEXTE[personnalisation.epaisseur_texte];
    if (epaisseur) decls.push(`font-weight:${epaisseur}`);
    const couleurTexte = sanitizeCssColor(personnalisation.couleur_texte);
    if (couleurTexte) decls.push(`color:${couleurTexte}`);
    if (!decls.length) return html;
    return `<div style="${decls.join('; ')};">${html}</div>`;
  }

  function qrCodeHtml(qrCode, size) {
    if (!qrCode) return '';
    return `
      <div style="text-align:center; flex-shrink:0;">
        <img src="${qrCode}" alt="QR code de vérification" style="width:${size}px; height:${size}px;" />
        <div style="font-size:0.6rem; color:var(--ink-soft); margin-top:2px;">Scanner pour vérifier</div>
      </div>
    `;
  }

  function signatureHtml(user, maxWidth) {
    return user.signature_default
      ? `<div style="margin-top:10px;"><img src="${escapeHtml(user.signature_default)}" alt="Signature" style="max-width:${maxWidth}px; max-height:70px; object-fit:contain;" /></div>`
      : '';
  }

  function logoHtml(user, maxSize, personnalisation) {
    if (!user.entreprise_logo) return '';
    // Échelle relative à la taille prévue par le modèle (jamais une valeur absolue) : le logo
    // reste toujours à l'intérieur du cadre que chaque modèle lui a réservé.
    const echelle = LOGO_ECHELLES[personnalisation && personnalisation.logo_taille] || 1;
    const taille = Math.round(maxSize * echelle);
    return `<img src="${escapeHtml(user.entreprise_logo)}" alt="Logo" style="max-width:${taille}px; max-height:${taille}px; object-fit:contain;" />`;
  }

  function lignesRowsHtml(lignes) {
    return (Array.isArray(lignes) ? lignes : []).map(l => `
      <tr class="sf-document-line">
        <td class="sf-doc-description" data-label="Désignation">${escapeHtml(l.designation || '')}</td>
        <td class="mono sf-doc-qty" data-label="Quantité">${escapeHtml(l.quantite ?? '')}</td>
        <td class="mono sf-doc-unit-price" data-label="Prix unitaire HT">${formatMontant(Number(l.prix_unitaire) || 0)}</td>
        <td class="mono sf-doc-tax-rate" data-label="TVA">${escapeHtml(l.tva ?? 0)}%</td>
        <td class="mono sf-doc-line-total" data-label="Montant TTC">${formatMontant(Number(l.total_ligne) || 0)}</td>
      </tr>
    `).join('');
  }

  function totalsRowsHtml(facture, borderColor, personnalisation) {
    const accent = accentColor(personnalisation, borderColor);
    const discount = Math.max(0, Number(facture.remise) || 0);
    const delivery = Math.max(0, Number(facture.frais_livraison) || 0);
    return `
      <div class="sf-totals">
        <div class="sf-total-row"><span>Sous-total HT</span><span class="mono">${formatMontant(facture.sous_total)}</span></div>
        ${discount > 0 ? `<div class="sf-total-row"><span>Remise</span><span class="mono">− ${formatMontant(discount)}</span></div>` : ''}
        ${delivery > 0 ? `<div class="sf-total-row"><span>Frais de livraison</span><span class="mono">${formatMontant(delivery)}</span></div>` : ''}
        <div class="sf-total-row"><span>TVA</span><span class="mono">${formatMontant(facture.total_tva)}</span></div>
        <div class="sf-total-row sf-total-grand" style="border-top:2px solid ${accent};">
          <span>Total TTC</span><strong class="mono">${formatMontant(facture.total)}</strong>
        </div>
      </div>
    `;
  }

  function clientBlockHtml(facture) {
    return `
      <div style="font-weight:700;">${escapeHtml(facture.client_nom)}</div>
      <div style="color:var(--ink-soft); font-size:0.85rem;">
        ${escapeHtml(facture.client_adresse)}<br/>
        ${escapeHtml(facture.client_telephone)} ${facture.client_email ? '· ' + escapeHtml(facture.client_email) : ''}
      </div>
    `;
  }

  function paymentStampLabel(facture, isDevis) {
    if (isDevis) return 'Devis';
    const total = Math.max(0, Number(facture.total) || 0);
    const paid = Math.max(0, Number(facture.montant_paye) || 0);
    if (facture.statut === 'payee' || (total > 0 && paid >= total)) return 'Payée';
    return paid > 0 ? 'Paiement partiel' : 'Non payée';
  }

  function footerHtml(user, facture, isDevis, stampClass, qrCode, personnalisation, extraClass = '') {
    return `
      <div class="sf-doc-footer${extraClass ? ' ' + extraClass : ''}" style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:40px; gap:16px;">
        <div style="max-width:55%; color:var(--ink-soft); font-size:0.85rem;">
          ${facture.commentaires ? `<div>${escapeHtml(facture.commentaires)}</div>` : ''}
          ${facture.mode_paiement ? `<div style="margin-top:6px;">Mode de paiement : ${escapeHtml(facture.mode_paiement)}</div>` : ''}
          ${signatureHtml(user, 180)}
        </div>
        <div style="display:flex; align-items:flex-end; gap:14px;">
          ${qrCodeHtml(qrCode, 64)}
          <div class="stamp ${stampClass}"${secondaryColor(personnalisation, null) ? ` style="border-color:${secondaryColor(personnalisation, null)}; color:${secondaryColor(personnalisation, null)};"` : ''}>
            ${paymentStampLabel(facture, isDevis)}
          </div>
        </div>
      </div>
    `;
  }

  // --- Modèle Classique : sobre, en-tête neutre, identique à la présentation d'origine ---
  function renderClassique(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div class="head">
        <div style="display:flex; align-items:center; gap:14px;">
          ${logoHtml(user, 56, personnalisation)}
          <div>
            <h2 style="margin-bottom:2px;">${escapeHtml(user.entreprise_nom || user.nom)}</h2>
            <div style="color:var(--ink-soft); font-size:0.85rem;">
              ${escapeHtml(user.entreprise_adresse)}<br/>
              ${escapeHtml(user.entreprise_telephone)} ${user.entreprise_email ? '· ' + escapeHtml(user.entreprise_email) : ''}
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <h1 style="margin-bottom:2px;">${isDevis ? 'DEVIS' : 'FACTURE'}</h1>
          <div class="mono" style="color:var(--ink-soft);">${escapeHtml(facture.numero)}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:24px;">
        <div>
          <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--ink-soft); margin-bottom:6px;">Facturé à</div>
          ${clientBlockHtml(facture)}
        </div>
        <div style="text-align:right;">
          <div><span style="color:var(--ink-soft);">Date d'émission :</span> ${formatDate(facture.date_emission)}</div>
          <div><span style="color:var(--ink-soft);">Échéance :</span> ${formatDate(facture.date_echeance)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table>
        <thead><tr><th>Désignation</th><th>Qté</th><th>Prix U.</th><th>TVA</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div style="width:280px;">${totalsRowsHtml(facture, 'var(--navy-950)', personnalisation)}</div>
      </div>

      ${footerHtml(user, facture, isDevis, paymentStampLabel(facture, isDevis) === 'Payée' ? '' : 'stamp-clay', qrCode, personnalisation)}
    `;
  }

  // --- Modèle Moderne : bandeau de couleur, logo mis en avant ---
  function renderModerne(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div style="margin:-40px -40px 28px; padding:32px 40px; background:linear-gradient(135deg, var(--navy-950), var(--emerald)); color:#fff; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:16px;">
          ${user.entreprise_logo ? `<div style="width:64px; height:64px; background:#fff; border-radius:12px; display:flex; align-items:center; justify-content:center; padding:6px;">${logoHtml(user, 52, personnalisation)}</div>` : ''}
          <div>
            <div style="font-family:var(--font-display); font-weight:700; font-size:1.3rem;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
            <div style="font-size:0.82rem; opacity:0.85;">
              ${escapeHtml(user.entreprise_adresse)} ${user.entreprise_telephone ? '· ' + escapeHtml(user.entreprise_telephone) : ''}
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:var(--font-display); font-weight:800; font-size:1.5rem; letter-spacing:0.04em;">${isDevis ? 'DEVIS' : 'FACTURE'}</div>
          <div class="mono" style="opacity:0.85;">${escapeHtml(facture.numero)}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:24px;">
        <div>
          <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--emerald); font-weight:700; margin-bottom:6px;">Facturé à</div>
          ${clientBlockHtml(facture)}
        </div>
        <div style="text-align:right;">
          <div><span style="color:var(--ink-soft);">Date d'émission :</span> ${formatDate(facture.date_emission)}</div>
          <div><span style="color:var(--ink-soft);">Échéance :</span> ${formatDate(facture.date_echeance)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table style="border-radius:10px; overflow:hidden;">
        <thead><tr><th>Désignation</th><th>Qté</th><th>Prix U.</th><th>TVA</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div style="width:290px; background:var(--emerald-light); border-radius:10px; padding:14px 18px;">${totalsRowsHtml(facture, 'var(--emerald)', personnalisation)}</div>
      </div>

      ${footerHtml(user, facture, isDevis, paymentStampLabel(facture, isDevis) === 'Payée' ? '' : 'stamp-clay', qrCode, personnalisation)}
    `;
  }

  // --- Modèle Minimaliste : noir et blanc, épuré, sans couleurs ---
  function renderMinimaliste(user, facture, lignes, isDevis, qrCode, personnalisation) {
    const statutLabel = !isDevis && paymentStampLabel(facture, false) === 'Paiement partiel' ? 'Paiement partiel' : ({ payee: 'Payée', en_attente: 'En attente', en_retard: 'En retard', annulee: 'Annulée' }[facture.statut] || facture.statut);
    return `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #111; padding-bottom:18px; margin-bottom:26px;">
        <div style="display:flex; align-items:center; gap:12px;">
          ${logoHtml(user, 40, personnalisation)}
          <div>
            <div style="font-family:var(--font-display); font-weight:700; font-size:1rem;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
            <div style="color:#555; font-size:0.78rem;">${escapeHtml(user.entreprise_adresse)}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:var(--font-display); font-weight:700; letter-spacing:0.1em; font-size:0.95rem;">${isDevis ? 'DEVIS' : 'FACTURE'} · ${escapeHtml(facture.numero)}</div>
          <div style="color:#555; font-size:0.78rem; margin-top:2px;">Date d’émission : ${formatDate(facture.date_emission)} — ${statutLabel}</div>
        </div>
      </div>

      <div style="margin-bottom:22px;">
        <div style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.08em; color:#777; margin-bottom:4px;">Facturé à</div>
        <div style="font-weight:600;">${escapeHtml(facture.client_nom)}</div>
        <div style="color:#555; font-size:0.82rem;">${escapeHtml(facture.client_adresse)}</div>
      </div>

      <table style="font-size:0.88rem;">
        <thead><tr style="border-bottom:1px solid #111;"><th style="background:none; color:#111;">Désignation</th><th style="background:none; color:#111;">Qté</th><th style="background:none; color:#111;">Prix U.</th><th style="background:none; color:#111;">TVA</th><th style="background:none; color:#111; text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div style="width:260px;">${totalsRowsHtml(facture, '#111', personnalisation)}</div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:40px; padding-top:14px; border-top:1px solid #ccc; gap:16px;">
        <div style="color:#555; font-size:0.8rem;">
          ${facture.commentaires ? `<div>${escapeHtml(facture.commentaires)}</div>` : ''}
          ${facture.mode_paiement ? `<div style="margin-top:4px;">Mode de paiement : ${escapeHtml(facture.mode_paiement)}</div>` : ''}
          ${signatureHtml(user, 150)}
        </div>
        ${qrCodeHtml(qrCode, 56)}
      </div>
    `;
  }

  // --- Modèle Élégant : centré, filets dorés, typographie soignée façon maison de luxe ---
  function renderElegant(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div style="text-align:center; padding-bottom:22px; margin-bottom:26px; border-bottom: 1px solid var(--gold);">
        ${user.entreprise_logo ? `<div style="margin-bottom:10px;">${logoHtml(user, 50, personnalisation)}</div>` : ''}
        <div style="font-family:var(--font-display); font-weight:700; font-size:1.25rem; letter-spacing:0.04em;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
        <div style="color:var(--ink-soft); font-size:0.8rem; margin-top:4px;">
          ${escapeHtml(user.entreprise_adresse)} ${user.entreprise_telephone ? '· ' + escapeHtml(user.entreprise_telephone) : ''}
        </div>
        <div style="margin-top:14px; display:inline-block; padding:6px 22px; border-top:1px solid var(--gold); border-bottom:1px solid var(--gold);">
          <span style="font-family:var(--font-display); letter-spacing:0.15em; font-size:0.85rem; color:#8a5a10;">${isDevis ? 'DEVIS' : 'FACTURE'} N° ${escapeHtml(facture.numero)}</span>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:24px;">
        <div style="text-align:left;">
          <div style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.1em; color:#8a5a10; margin-bottom:6px;">Facturé à</div>
          ${clientBlockHtml(facture)}
        </div>
        <div style="text-align:right;">
          <div><span style="color:var(--ink-soft);">Date d’émission :</span> ${formatDate(facture.date_emission)}</div>
          <div><span style="color:var(--ink-soft);">Échéance</span> ${formatDate(facture.date_echeance)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table>
        <thead><tr><th style="background:var(--gold); color:var(--navy-950);">Désignation</th><th style="background:var(--gold); color:var(--navy-950);">Qté</th><th style="background:var(--gold); color:var(--navy-950);">Prix U.</th><th style="background:var(--gold); color:var(--navy-950);">TVA</th><th style="background:var(--gold); color:var(--navy-950); text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div style="width:280px;">${totalsRowsHtml(facture, 'var(--gold)', personnalisation)}</div>
      </div>

      ${footerHtml(user, facture, isDevis, paymentStampLabel(facture, isDevis) === 'Payée' ? '' : 'stamp-clay', qrCode, personnalisation)}
    `;
  }

  // --- Modèle Corporate : mise en page structurée en blocs, très "entreprise" ---
  function renderCorporate(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div style="display:flex; gap:0; margin:-40px -40px 26px;">
        <div style="background:var(--navy-950); color:#fff; padding:26px 32px; flex:1; display:flex; align-items:center; gap:14px;">
          ${user.entreprise_logo ? `<div style="width:52px; height:52px; background:#fff; border-radius:8px; display:flex; align-items:center; justify-content:center; padding:5px; flex-shrink:0;">${logoHtml(user, 42, personnalisation)}</div>` : ''}
          <div>
            <div style="font-family:var(--font-display); font-weight:700; font-size:1.1rem;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
            <div style="font-size:0.78rem; opacity:0.8;">${escapeHtml(user.entreprise_adresse)}</div>
          </div>
        </div>
        <div style="background:var(--navy-800); color:#fff; padding:26px 32px; text-align:right; min-width:220px;">
          <div style="font-family:var(--font-display); font-weight:800; font-size:1.15rem;">${isDevis ? 'DEVIS' : 'FACTURE'}</div>
          <div class="mono" style="font-size:0.82rem; opacity:0.85;">${escapeHtml(facture.numero)}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0; border:1px solid var(--line); border-radius:10px; overflow:hidden; margin-bottom:24px;">
        <div style="padding:14px 16px; border-right:1px solid var(--line);">
          <div style="font-size:0.68rem; text-transform:uppercase; color:var(--ink-soft); margin-bottom:4px;">Client</div>
          <div style="font-weight:700; font-size:0.9rem;">${escapeHtml(facture.client_nom)}</div>
        </div>
        <div style="padding:14px 16px; border-right:1px solid var(--line);">
          <div style="font-size:0.68rem; text-transform:uppercase; color:var(--ink-soft); margin-bottom:4px;">Émission / Échéance</div>
          <div style="font-size:0.85rem;">${formatDate(facture.date_emission)} → ${formatDate(facture.date_echeance)}</div>
        </div>
        <div style="padding:14px 16px;">
          <div style="font-size:0.68rem; text-transform:uppercase; color:var(--ink-soft); margin-bottom:4px;">Statut</div>
          ${!isDevis && paymentStampLabel(facture, false) === 'Paiement partiel' ? '<span class="badge">Paiement partiel</span>' : statutBadge(facture.statut)}
        </div>
      </div>

      <table>
        <thead><tr><th>Désignation</th><th>Qté</th><th>Prix U.</th><th>TVA</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:space-between; margin-top:18px; gap:20px;">
        <div style="flex:1; color:var(--ink-soft); font-size:0.85rem;">
          ${facture.commentaires ? `<div><strong style="color:var(--navy-900);">Notes :</strong> ${escapeHtml(facture.commentaires)}</div>` : ''}
          ${facture.mode_paiement ? `<div style="margin-top:6px;"><strong style="color:var(--navy-900);">Paiement :</strong> ${escapeHtml(facture.mode_paiement)}</div>` : ''}
          ${signatureHtml(user, 180)}
        </div>
        <div style="width:280px; border:1px solid var(--line); border-radius:10px; padding:14px 18px;">${totalsRowsHtml(facture, 'var(--navy-950)', personnalisation)}</div>
      </div>
    `;
  }

  // --- Modèle Créatif : coloré, formes arrondies, adapté artisans/créateurs ---
  function renderCreatif(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:26px;">
        <div style="display:flex; align-items:center; gap:14px;">
          ${user.entreprise_logo ? `<div style="width:60px; height:60px; border-radius:50%; overflow:hidden; border:3px solid var(--gold); display:flex; align-items:center; justify-content:center;">${logoHtml(user, 54, personnalisation)}</div>` : ''}
          <div>
            <div style="font-family:var(--font-display); font-weight:800; font-size:1.2rem; color:var(--emerald);">${escapeHtml(user.entreprise_nom || user.nom)}</div>
            <div style="color:var(--ink-soft); font-size:0.82rem;">${escapeHtml(user.entreprise_adresse)}</div>
          </div>
        </div>
        <div style="background:var(--gold); color:var(--navy-950); padding:10px 20px; border-radius:999px; text-align:center;">
          <div style="font-family:var(--font-display); font-weight:800; font-size:0.95rem;">${isDevis ? '✨ DEVIS' : '🧾 FACTURE'}</div>
          <div class="mono" style="font-size:0.76rem;">${escapeHtml(facture.numero)}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:22px;">
        <div style="background:var(--emerald-light); border-radius:14px; padding:14px 18px;">
          <div style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--emerald); font-weight:700; margin-bottom:6px;">🙋 Facturé à</div>
          ${clientBlockHtml(facture)}
        </div>
        <div style="background:var(--gold-light); border-radius:14px; padding:14px 18px; text-align:right;">
          <div>📅 ${formatDate(facture.date_emission)} → ${formatDate(facture.date_echeance)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table style="border-radius:14px; overflow:hidden;">
        <thead><tr><th style="background:var(--emerald);">Désignation</th><th style="background:var(--emerald);">Qté</th><th style="background:var(--emerald);">Prix U.</th><th style="background:var(--emerald);">TVA</th><th style="background:var(--emerald); text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div class="sf-total-panel-dark" style="width:290px; background:var(--navy-950); color:#fff; border-radius:14px; padding:14px 18px;">
          ${totalsRowsHtml(facture, 'var(--gold)', personnalisation)}
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:36px;">
        <div style="max-width:60%; color:var(--ink-soft); font-size:0.85rem;">
          ${facture.commentaires ? `<div>💬 ${escapeHtml(facture.commentaires)}</div>` : ''}
          ${facture.mode_paiement ? `<div style="margin-top:6px;">💳 ${escapeHtml(facture.mode_paiement)}</div>` : ''}
          ${signatureHtml(user, 180)}
        </div>
        <div class="stamp" style="border-color:var(--emerald); color:var(--emerald); transform:rotate(6deg);">
          ${paymentStampLabel(facture, isDevis)}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // Modèles Entreprise — dorés, sobres, haut de gamme (réservés au plan Entreprise,
  // voir server/utils/plans.js ENTERPRISE_TEMPLATES et la vérification dans
  // server/routes/auth.js). Réutilisent les mêmes helpers que les 6 modèles
  // ci-dessus (logoHtml, clientBlockHtml, totalsRowsHtml, footerHtml...) pour rester
  // cohérents avec eux et bénéficier des mêmes futures évolutions (QR code, signature...).
  // =========================================================================

  // --- Modèle Prestige : bandeau noir/or plein cadre, typographie large, total encadré or ---
  function renderPrestige(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div style="margin:-40px -40px 30px; padding:36px 40px; background:var(--navy-950); border-bottom:3px solid var(--gold); display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:16px;">
          ${user.entreprise_logo
            ? `<div style="width:58px; height:58px; background:#fff; border-radius:6px; display:flex; align-items:center; justify-content:center; padding:6px; border:1px solid var(--gold); flex-shrink:0;">${logoHtml(user, 46, personnalisation)}</div>`
            : `<div style="width:58px; height:58px; border:1px solid var(--gold); border-radius:6px; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:800; font-size:1.3rem; color:var(--gold); flex-shrink:0;">${escapeHtml((user.entreprise_nom || user.nom || '?').charAt(0).toUpperCase())}</div>`}
          <div>
            <div style="font-family:var(--font-display); font-weight:700; font-size:1.2rem; color:#fff; letter-spacing:0.02em;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
            <div style="font-size:0.78rem; color:var(--gold); letter-spacing:0.03em; margin-top:2px;">
              ${escapeHtml(user.entreprise_adresse)} ${user.entreprise_telephone ? '· ' + escapeHtml(user.entreprise_telephone) : ''}
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:var(--font-display); font-weight:800; font-size:1.1rem; letter-spacing:0.18em; color:var(--gold);">${isDevis ? 'DEVIS' : 'FACTURE'}</div>
          <div class="mono" style="color:#fff; opacity:0.75; font-size:0.8rem; margin-top:3px;">${escapeHtml(facture.numero)}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:24px;">
        <div>
          <div style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.1em; color:#8a5a10; font-weight:700; margin-bottom:6px;">Facturé à</div>
          ${clientBlockHtml(facture)}
        </div>
        <div style="text-align:right;">
          <div><span style="color:var(--ink-soft);">Date d'émission :</span> ${formatDate(facture.date_emission)}</div>
          <div><span style="color:var(--ink-soft);">Échéance :</span> ${formatDate(facture.date_echeance)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table>
        <thead><tr><th style="background:var(--navy-950); color:var(--gold);">Désignation</th><th style="background:var(--navy-950); color:var(--gold);">Qté</th><th style="background:var(--navy-950); color:var(--gold);">Prix U.</th><th style="background:var(--navy-950); color:var(--gold);">TVA</th><th style="background:var(--navy-950); color:var(--gold); text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div class="sf-total-panel-dark" style="width:290px; background:var(--navy-950); border:1px solid var(--gold); border-radius:8px; padding:14px 18px; color:#fff;">
          ${totalsRowsHtml(facture, 'var(--gold)', personnalisation)}
        </div>
      </div>

      ${footerHtml(user, facture, isDevis, paymentStampLabel(facture, isDevis) === 'Payée' ? '' : 'stamp-clay', qrCode, personnalisation)}
    `;
  }

  // --- Modèle Héritage : cadre à double filet or, présentation centrée façon papier à en-tête ---
  function renderHeritage(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div style="margin:-8px -8px 26px; padding:8px; border:1px solid var(--gold);">
        <div style="border:1px solid var(--gold); padding:26px 30px; text-align:center;">
          ${user.entreprise_logo
            ? `<div style="margin-bottom:10px;">${logoHtml(user, 48, personnalisation)}</div>`
            : `<div style="width:54px; height:54px; margin:0 auto 10px; border-radius:50%; border:1px solid var(--gold); display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:700; font-size:1.15rem; color:var(--gold);">${escapeHtml((user.entreprise_nom || user.nom || '?').charAt(0).toUpperCase())}</div>`}
          <div style="font-family:var(--font-display); font-weight:700; font-size:1.15rem; letter-spacing:0.05em;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
          <div style="color:var(--ink-soft); font-size:0.78rem; margin-top:4px;">
            ${escapeHtml(user.entreprise_adresse)} ${user.entreprise_telephone ? '· ' + escapeHtml(user.entreprise_telephone) : ''}
          </div>
          <div style="margin-top:14px; font-family:var(--font-display); letter-spacing:0.2em; font-size:0.78rem; color:#8a5a10;">${isDevis ? 'DEVIS' : 'FACTURE'} N° ${escapeHtml(facture.numero)}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:24px;">
        <div>
          <div style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.1em; color:#8a5a10; margin-bottom:6px;">Facturé à</div>
          ${clientBlockHtml(facture)}
        </div>
        <div style="text-align:right;">
          <div><span style="color:var(--ink-soft);">Date d’émission :</span> ${formatDate(facture.date_emission)}</div>
          <div><span style="color:var(--ink-soft);">Échéance</span> ${formatDate(facture.date_echeance)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table>
        <thead><tr><th style="background:#fff; color:var(--navy-950); border-bottom:2px solid var(--gold);">Désignation</th><th style="background:#fff; color:var(--navy-950); border-bottom:2px solid var(--gold);">Qté</th><th style="background:#fff; color:var(--navy-950); border-bottom:2px solid var(--gold);">Prix U.</th><th style="background:#fff; color:var(--navy-950); border-bottom:2px solid var(--gold);">TVA</th><th style="background:#fff; color:var(--navy-950); border-bottom:2px solid var(--gold); text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div style="width:280px;">${totalsRowsHtml(facture, 'var(--gold)', personnalisation)}</div>
      </div>

      ${footerHtml(user, facture, isDevis, paymentStampLabel(facture, isDevis) === 'Payée' ? '' : 'stamp-clay', qrCode, personnalisation)}
    `;
  }

  // --- Modèle Diamant : ultra-épuré, filets or fins, aucun aplat de couleur ---
  function renderDiamant(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:20px; margin-bottom:28px; border-bottom:1px solid var(--gold);">
        <div style="display:flex; align-items:center; gap:12px;">
          ${logoHtml(user, 44, personnalisation)}
          <div>
            <div style="font-family:var(--font-display); font-weight:600; font-size:1.05rem; letter-spacing:0.02em;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
            <div style="color:var(--ink-soft); font-size:0.78rem; margin-top:2px;">${escapeHtml(user.entreprise_adresse)}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:var(--font-display); font-weight:600; letter-spacing:0.2em; font-size:0.85rem; color:#8a5a10;">◆ ${isDevis ? 'DEVIS' : 'FACTURE'}</div>
          <div class="mono" style="color:var(--ink-soft); font-size:0.78rem; margin-top:2px;">${escapeHtml(facture.numero)}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:26px;">
        <div>
          <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.12em; color:#8a5a10; margin-bottom:6px;">◆ Facturé à</div>
          ${clientBlockHtml(facture)}
        </div>
        <div style="text-align:right;">
          <div><span style="color:var(--ink-soft);">Date d'émission :</span> ${formatDate(facture.date_emission)}</div>
          <div><span style="color:var(--ink-soft);">Échéance :</span> ${formatDate(facture.date_echeance)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table>
        <thead><tr><th style="background:#fff; color:var(--navy-950); border-bottom:1px solid var(--gold); font-weight:600;">Désignation</th><th style="background:#fff; color:var(--navy-950); border-bottom:1px solid var(--gold); font-weight:600;">Qté</th><th style="background:#fff; color:var(--navy-950); border-bottom:1px solid var(--gold); font-weight:600;">Prix U.</th><th style="background:#fff; color:var(--navy-950); border-bottom:1px solid var(--gold); font-weight:600;">TVA</th><th style="background:#fff; color:var(--navy-950); border-bottom:1px solid var(--gold); font-weight:600; text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:20px;">
        <div style="width:270px;">${totalsRowsHtml(facture, 'var(--gold)', personnalisation)}</div>
      </div>

      ${footerHtml(user, facture, isDevis, paymentStampLabel(facture, isDevis) === 'Payée' ? '' : 'stamp-clay', qrCode, personnalisation)}
    `;
  }

  // =========================================================================
  // Nouveaux modèles (lot 2026-08) — même principe de réutilisation des helpers
  // ci-dessus (logoHtml, clientBlockHtml, lignesRowsHtml, totalsRowsHtml,
  // footerHtml, qrCodeHtml, signatureHtml) que les 9 modèles existants, pour
  // rester cohérents avec eux (impression A4, multi-page, dark mode) sans
  // dupliquer de logique. Voir RAPPORT_MODELES.md pour le détail de l'ajout.
  // =========================================================================

  // --- Modèle Épuré : grande typographie, colonnes strictes, cadre de signature
  // client et conditions générales (réutilise facture.commentaires) ---
  function renderEpure(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div style="display:flex; justify-content:space-between; align-items:flex-end; padding-bottom:24px; margin-bottom:30px; border-bottom:3px solid #111;">
        <div style="display:flex; align-items:center; gap:14px;">
          ${logoHtml(user, 46, personnalisation)}
          <div>
            <div style="font-weight:700; font-size:1rem;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
            <div style="color:var(--ink-soft); font-size:0.8rem; margin-top:2px;">
              ${escapeHtml(user.entreprise_adresse)} ${user.entreprise_telephone ? '· ' + escapeHtml(user.entreprise_telephone) : ''}
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:var(--font-display); font-weight:800; font-size:2.1rem; letter-spacing:0.02em; line-height:1;">${isDevis ? 'DEVIS' : 'FACTURE'}</div>
          <div class="mono" style="color:var(--ink-soft); margin-top:4px;">${escapeHtml(facture.numero)}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:26px;">
        <div>
          <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--ink-soft); margin-bottom:6px;">Facturé à</div>
          ${clientBlockHtml(facture)}
        </div>
        <div style="text-align:right;">
          <div><span style="color:var(--ink-soft);">Date d'émission :</span> ${formatDate(facture.date_emission)}</div>
          <div><span style="color:var(--ink-soft);">Échéance :</span> ${formatDate(facture.date_echeance)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table>
        <thead><tr><th style="background:#fff; color:#111; border-bottom:2px solid #111;">Désignation</th><th style="background:#fff; color:#111; border-bottom:2px solid #111;">Qté</th><th style="background:#fff; color:#111; border-bottom:2px solid #111;">Prix U.</th><th style="background:#fff; color:#111; border-bottom:2px solid #111;">TVA</th><th style="background:#fff; color:#111; border-bottom:2px solid #111; text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div style="width:280px;">${totalsRowsHtml(facture, '#111', personnalisation)}</div>
      </div>

      ${facture.commentaires ? `
      <div style="margin-top:30px; padding-top:14px; border-top:1px solid #ddd;">
        <div style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--ink-soft); margin-bottom:6px;">Conditions générales</div>
        <div style="color:var(--ink-soft); font-size:0.82rem;">${escapeHtml(facture.commentaires)}</div>
      </div>` : ''}

      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:36px; gap:20px;">
        <div style="width:220px; border-top:1px solid #111; padding-top:6px; text-align:center; color:var(--ink-soft); font-size:0.76rem;">
          Signature du client
        </div>
        <div style="display:flex; align-items:flex-end; gap:14px;">
          ${qrCodeHtml(qrCode, 60)}
          <div class="stamp ${paymentStampLabel(facture, isDevis) === 'Payée' ? '' : 'stamp-clay'}">
            ${paymentStampLabel(facture, isDevis)}
          </div>
        </div>
      </div>
    `;
  }

  // --- Modèle Azur : formes géométriques bleues en en-tête, totaux mis en valeur ---
  function renderAzur(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div style="position:relative; overflow:hidden; margin:-40px -40px 30px; padding:30px 40px; background:var(--navy-900);">
        <div style="position:absolute; top:-30px; right:-30px; width:160px; height:160px; background:var(--navy-700); border-radius:50%; opacity:0.5;"></div>
        <div style="position:absolute; bottom:-50px; right:60px; width:110px; height:110px; background:var(--emerald); transform:rotate(20deg); opacity:0.3;"></div>
        <div style="position:relative; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:14px;">
            ${user.entreprise_logo ? `<div style="width:56px; height:56px; background:#fff; border-radius:10px; display:flex; align-items:center; justify-content:center; padding:6px;">${logoHtml(user, 44, personnalisation)}</div>` : ''}
            <div>
              <div style="font-family:var(--font-display); font-weight:700; font-size:1.15rem; color:#fff;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
              <div style="font-size:0.8rem; color:rgba(255,255,255,0.75);">${escapeHtml(user.entreprise_adresse)}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:var(--font-display); font-weight:800; font-size:1.3rem; color:#fff; letter-spacing:0.05em;">${isDevis ? 'DEVIS' : 'FACTURE'}</div>
            <div class="mono" style="color:rgba(255,255,255,0.75);">${escapeHtml(facture.numero)}</div>
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:24px;">
        <div>
          <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--navy-700); font-weight:700; margin-bottom:6px;">Facturé à</div>
          ${clientBlockHtml(facture)}
        </div>
        <div style="text-align:right;">
          <div><span style="color:var(--ink-soft);">Date d'émission :</span> ${formatDate(facture.date_emission)}</div>
          <div><span style="color:var(--ink-soft);">Échéance :</span> ${formatDate(facture.date_echeance)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table>
        <thead><tr><th style="background:var(--navy-900);">Désignation</th><th style="background:var(--navy-900);">Qté</th><th style="background:var(--navy-900);">Prix U.</th><th style="background:var(--navy-900);">TVA</th><th style="background:var(--navy-900); text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div style="width:290px; background:var(--navy-950); color:#fff; border-radius:10px; padding:16px 20px;">
          <div style="display:flex; justify-content:space-between; padding:5px 0; opacity:0.8;"><span>Sous-total HT</span><span class="mono">${formatMontant(facture.sous_total)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:5px 0; opacity:0.8;"><span>Frais de livraison</span><span class="mono">${formatMontant(facture.frais_livraison)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:5px 0; opacity:0.8;"><span>TVA</span><span class="mono">${formatMontant(facture.total_tva)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:5px 0; opacity:0.8;"><span>Remise</span><span class="mono">- ${formatMontant(facture.remise)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:10px 0; border-top:1px solid rgba(255,255,255,0.25); font-weight:700; font-size:1.15rem; color:var(--emerald);"><span>Total TTC</span><span class="mono">${formatMontant(facture.total)}</span></div>
        </div>
      </div>

      ${footerHtml(user, facture, isDevis, paymentStampLabel(facture, isDevis) === 'Payée' ? '' : 'stamp-clay', qrCode, personnalisation)}
    `;
  }

  // --- Modèle Circuit : vert dynamique, motif technologique — pensé pour les entreprises IT ---
  function renderCircuit(user, facture, lignes, isDevis, qrCode, personnalisation) {
    const dotGrid = 'background-image: radial-gradient(circle, rgba(14,169,128,0.22) 1px, transparent 1px); background-size: 14px 14px;';
    return `
      <div style="position:relative; margin:-40px -40px 30px; padding:30px 40px; background:#0B1F1A; ${dotGrid}">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:14px;">
            ${user.entreprise_logo ? `<div style="width:52px; height:52px; background:#0f2a22; border:1px solid var(--emerald); border-radius:8px; display:flex; align-items:center; justify-content:center; padding:6px;">${logoHtml(user, 40, personnalisation)}</div>` : ''}
            <div>
              <div style="font-family:var(--font-display); font-weight:700; font-size:1.1rem; color:#fff;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
              <div style="font-size:0.78rem; color:var(--emerald);">${escapeHtml(user.entreprise_adresse)}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div class="mono" style="font-weight:800; font-size:1.1rem; color:var(--emerald); letter-spacing:0.06em;">&lt;${isDevis ? 'DEVIS' : 'FACTURE'}/&gt;</div>
            <div class="mono" style="color:rgba(255,255,255,0.6); font-size:0.78rem;">${escapeHtml(facture.numero)}</div>
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:24px;">
        <div>
          <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--emerald); font-weight:700; margin-bottom:6px;">Facturé à</div>
          ${clientBlockHtml(facture)}
        </div>
        <div style="text-align:right;">
          <div><span style="color:var(--ink-soft);">Date d'émission :</span> ${formatDate(facture.date_emission)}</div>
          <div><span style="color:var(--ink-soft);">Échéance :</span> ${formatDate(facture.date_echeance)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table>
        <thead><tr><th style="background:#0B1F1A; color:var(--emerald);">Désignation</th><th style="background:#0B1F1A; color:var(--emerald);">Qté</th><th style="background:#0B1F1A; color:var(--emerald);">Prix U.</th><th style="background:#0B1F1A; color:var(--emerald);">TVA</th><th style="background:#0B1F1A; color:var(--emerald); text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div style="width:280px;">${totalsRowsHtml(facture, 'var(--emerald)', personnalisation)}</div>
      </div>

      ${footerHtml(user, facture, isDevis, paymentStampLabel(facture, isDevis) === 'Payée' ? '' : 'stamp-clay', qrCode, personnalisation)}
    `;
  }

  // --- Modèle Platine : logo mis en avant, QR de vérification et signature numérique en
  // évidence — modèle "exclusif" réservé au plan Entreprise (voir plans.js ENTERPRISE_TEMPLATES) ---
  function renderPlatine(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div class="sf-platine-header" style="text-align:center; padding-bottom:24px; margin-bottom:28px; border-bottom:1px solid #C7CBD6;">
        ${user.entreprise_logo ? `<div style="margin-bottom:12px;">${logoHtml(user, 72, personnalisation)}</div>` : ''}
        <div style="font-family:var(--font-display); font-weight:700; font-size:1.3rem; letter-spacing:0.03em;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
        <div style="color:var(--ink-soft); font-size:0.8rem; margin-top:4px;">
          ${escapeHtml(user.entreprise_adresse)} ${user.entreprise_telephone ? '· ' + escapeHtml(user.entreprise_telephone) : ''}
        </div>
        <div style="margin-top:16px; display:inline-block; padding:8px 26px; background:var(--navy-950); border-radius:999px;">
          <span style="font-family:var(--font-display); letter-spacing:0.18em; font-size:0.82rem; color:#fff;">${isDevis ? 'DEVIS' : 'FACTURE'} N° ${escapeHtml(facture.numero)}</span>
        </div>
      </div>

      <div class="grid grid-2 sf-platine-meta" style="margin-bottom:24px;">
        <div>
          <div style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.1em; color:var(--ink-soft); margin-bottom:6px;">Facturé à</div>
          ${clientBlockHtml(facture)}
        </div>
        <div style="text-align:right;">
          <div><span style="color:var(--ink-soft);">Date d’émission :</span> ${formatDate(facture.date_emission)}</div>
          <div><span style="color:var(--ink-soft);">Échéance</span> ${formatDate(facture.date_echeance)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table>
        <thead><tr><th>Désignation</th><th>Qté</th><th>Prix U.</th><th>TVA</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div class="sf-platine-totals" style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div style="width:290px; border:1px solid var(--navy-950); border-radius:10px; padding:14px 18px;">${totalsRowsHtml(facture, 'var(--navy-950)', personnalisation)}</div>
      </div>

      <div class="sf-platine-footer" style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:40px; gap:16px;">
        <div style="max-width:50%; color:var(--ink-soft); font-size:0.85rem;">
          ${facture.commentaires ? `<div>${escapeHtml(facture.commentaires)}</div>` : ''}
          ${facture.mode_paiement ? `<div style="margin-top:6px;">Mode de paiement : ${escapeHtml(facture.mode_paiement)}</div>` : ''}
          ${user.signature_default ? `<div style="margin-top:10px;"><div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--ink-soft);">Signature numérique</div>${signatureHtml(user, 180)}</div>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
          ${qrCodeHtml(qrCode, 78)}
          <div class="stamp ${paymentStampLabel(facture, isDevis) === 'Payée' ? '' : 'stamp-clay'}">
            ${paymentStampLabel(facture, isDevis)}
          </div>
        </div>
      </div>
    `;
  }

  // --- Modèle Atelier : tons terre/orange robustes — pensé pour artisans et BTP ---
  function renderAtelier(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:26px; padding-bottom:20px; border-bottom:4px solid #C1622B;">
        <div style="display:flex; align-items:center; gap:14px;">
          ${user.entreprise_logo ? `<div style="width:58px; height:58px; border-radius:8px; overflow:hidden; border:2px solid #C1622B; display:flex; align-items:center; justify-content:center;">${logoHtml(user, 50, personnalisation)}</div>` : ''}
          <div>
            <div style="font-family:var(--font-display); font-weight:800; font-size:1.15rem; color:#8A3F16;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
            <div style="color:var(--ink-soft); font-size:0.82rem;">${escapeHtml(user.entreprise_adresse)} ${user.entreprise_telephone ? '· ' + escapeHtml(user.entreprise_telephone) : ''}</div>
          </div>
        </div>
        <div style="background:#C1622B; color:#fff; padding:10px 20px; border-radius:8px; text-align:center;">
          <div style="font-family:var(--font-display); font-weight:800; font-size:0.95rem;">${isDevis ? 'DEVIS' : 'FACTURE'}</div>
          <div class="mono" style="font-size:0.78rem; opacity:0.9;">${escapeHtml(facture.numero)}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:22px;">
        <div>
          <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:#8A3F16; font-weight:700; margin-bottom:6px;">Chantier / Client</div>
          ${clientBlockHtml(facture)}
        </div>
        <div style="text-align:right;">
          <div><span style="color:var(--ink-soft);">Date d'émission :</span> ${formatDate(facture.date_emission)}</div>
          <div><span style="color:var(--ink-soft);">Échéance :</span> ${formatDate(facture.date_echeance)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table>
        <thead><tr><th style="background:#8A3F16;">Désignation</th><th style="background:#8A3F16;">Qté</th><th style="background:#8A3F16;">Prix U.</th><th style="background:#8A3F16;">TVA</th><th style="background:#8A3F16; text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div style="width:280px; border:2px solid #C1622B; border-radius:8px; padding:14px 18px;">${totalsRowsHtml(facture, '#8A3F16', personnalisation)}</div>
      </div>

      ${footerHtml(user, facture, isDevis, paymentStampLabel(facture, isDevis) === 'Payée' ? '' : 'stamp-clay', qrCode, personnalisation)}
    `;
  }

  // --- Modèle Saveurs : chaleureux, présentation façon ticket — pensé pour restaurants et commerces ---
  function renderSaveurs(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div style="text-align:center; margin-bottom:24px; padding-bottom:18px; border-bottom:2px dashed var(--clay);">
        ${logoHtml(user, 48, personnalisation)}
        <div style="font-family:var(--font-display); font-weight:800; font-size:1.2rem; margin-top:8px; color:var(--clay);">${escapeHtml(user.entreprise_nom || user.nom)}</div>
        <div style="color:var(--ink-soft); font-size:0.8rem; margin-top:2px;">${escapeHtml(user.entreprise_adresse)} ${user.entreprise_telephone ? '· ' + escapeHtml(user.entreprise_telephone) : ''}</div>
        <div style="margin-top:10px; font-family:var(--font-display); letter-spacing:0.08em; font-size:0.85rem;">${isDevis ? 'DEVIS' : 'FACTURE'} N° ${escapeHtml(facture.numero)}</div>
      </div>

      <div class="grid grid-2" style="margin-bottom:20px;">
        <div>
          <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--clay); font-weight:700; margin-bottom:6px;">Client</div>
          ${clientBlockHtml(facture)}
        </div>
        <div style="text-align:right;">
          <div>Date d’émission : ${formatDate(facture.date_emission)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table style="font-size:0.88rem;">
        <thead><tr><th style="background:var(--clay-light); color:var(--ink);">Désignation</th><th style="background:var(--clay-light); color:var(--ink);">Qté</th><th style="background:var(--clay-light); color:var(--ink);">Prix U.</th><th style="background:var(--clay-light); color:var(--ink);">TVA</th><th style="background:var(--clay-light); color:var(--ink); text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div style="width:270px; border-top:2px dashed var(--clay); padding-top:10px;">${totalsRowsHtml(facture, 'var(--clay)', personnalisation)}</div>
      </div>

      ${footerHtml(user, facture, isDevis, paymentStampLabel(facture, isDevis) === 'Payée' ? '' : 'stamp-clay', qrCode, personnalisation)}
    `;
  }

  function documentMetaHtml(facture, isDevis, includeDates = false, user = null, renderedHtml = '', template = '') {
    const fields = [];
    if (facture.objet) fields.push(['Objet', escapeHtml(facture.objet)]);
    if (facture.reference_externe) fields.push(['Référence client / commande', escapeHtml(facture.reference_externe)]);
    if (includeDates) {
      // Les modèles Minimaliste et Saveurs ont déjà la date d'émission dans leur en-tête ;
      // on ne complète que la date qui leur manquait pour éviter les doublons visuels.
      fields.push([isDevis ? 'Validité du devis' : 'Échéance de paiement', formatDate(isDevis ? facture.date_validite : facture.date_echeance)]);
    }
    // Certains modèles privilégient un en-tête graphique plus compact. Les coordonnées
    // manquantes sont ajoutées ici, sans dupliquer celles déjà présentes dans l'en-tête.
    const rendered = String(renderedHtml || '');
    if (user?.entreprise_telephone) {
      const phone = escapeHtml(user.entreprise_telephone);
      if (!rendered.includes(phone)) fields.push(['Téléphone de l’entreprise', phone]);
    }
    if (user?.entreprise_email) {
      const email = escapeHtml(user.entreprise_email);
      if (!rendered.includes(email)) fields.push(['Email de l’entreprise', email]);
    }
    if (!fields.length) return '';
    const variantClass = template === 'consolide' ? ' sf-doc-meta-consolide' : template === 'signature' ? ' sf-doc-meta-signature' : template === 'platine' ? ' sf-doc-meta-platine' : '';
    return `
      <section class="sf-doc-meta${variantClass}" aria-label="Informations du document">
        ${fields.map(([label, value]) => `
          <div class="sf-doc-meta-item">
            <div class="sf-doc-meta-label">${label}</div>
            <div class="sf-doc-meta-value">${value}</div>
          </div>
        `).join('')}
      </section>
    `;
  }

  function taxBreakdownHtml(facture, lignes) {
    if (!Array.isArray(lignes) || lignes.length < 2) return '';
    const subtotal = Math.max(0, Number(facture.sous_total) || 0);
    const discount = Math.min(Math.max(0, Number(facture.remise) || 0), subtotal);
    const groups = new Map();
    for (const line of lignes) {
      const rate = Number(line.tva) || 0;
      const base = Math.max(0, (Number(line.quantite) || 0) * (Number(line.prix_unitaire) || 0));
      const netBase = subtotal > 0 ? base - discount * (base / subtotal) : base;
      const group = groups.get(rate) || { base: 0, tax: 0 };
      group.base += netBase;
      group.tax += netBase * rate / 100;
      groups.set(rate, group);
    }
    if (groups.size < 2) return '';
    const rows = [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([rate, values]) => `
      <div class="sf-doc-tax-row">
        <span>TVA ${rate}% <span class="sf-doc-tax-base">· base ${formatMontant(Math.round(values.base * 100) / 100)}</span></span>
        <strong class="mono">${formatMontant(Math.round(values.tax * 100) / 100)}</strong>
      </div>
    `).join('');
    return `
      <section class="sf-doc-tax" aria-label="Détail de la TVA par taux">
        <div class="sf-doc-tax-title">Détail de la TVA par taux</div>
        ${rows}
        <div class="sf-doc-tax-total"><span>Total TVA</span><strong class="mono">${formatMontant(facture.total_tva)}</strong></div>
      </section>
    `;
  }

  function documentSupplementHtml(user, facture, isDevis, template = '') {
    const total = Math.max(0, Number(facture.total) || 0);
    const paid = Math.min(total, Math.max(0, Number(facture.montant_paye) || 0));
    const remaining = Math.max(0, total - paid);
    const terms = facture.conditions_reglement || user.entreprise_conditions_reglement || '';
    const bankDetails = [
      user.entreprise_banque ? ['Banque', escapeHtml(user.entreprise_banque)] : null,
      user.entreprise_rib ? ['RIB / IBAN / compte', escapeHtml(user.entreprise_rib)] : null
    ].filter(Boolean);
    const legalDetails = [
      user.entreprise_ninea ? 'NINEA : ' + escapeHtml(user.entreprise_ninea) : null,
      user.entreprise_rccm ? 'RCCM : ' + escapeHtml(user.entreprise_rccm) : null,
      user.entreprise_telephone ? 'Tél. : ' + escapeHtml(user.entreprise_telephone) : null,
      user.entreprise_email ? 'Email : ' + escapeHtml(user.entreprise_email) : null,
      user.entreprise_site_web ? escapeHtml(user.entreprise_site_web) : null
    ].filter(Boolean);
    const legalMentions = user.entreprise_mentions_legales
      ? escapeHtml(user.entreprise_mentions_legales).replace(/\r?\n/g, '<br/>')
      : '';

    const variantClass = template === 'consolide' ? ' sf-doc-extras-consolide' : template === 'signature' ? ' sf-doc-extras-signature' : template === 'platine' ? ' sf-doc-extras-platine' : '';
    return `
      <div class="sf-doc-extras${variantClass}">
        ${!isDevis ? `
          <section class="sf-extra-panel sf-payment-summary" aria-label="Situation du règlement">
            <div class="sf-payment-metric">
              <span class="sf-extra-title">Déjà réglé</span>
              <strong class="sf-payment-value">${formatMontant(paid)}</strong>
            </div>
            <div class="sf-payment-metric sf-payment-balance">
              <span class="sf-extra-title">Reste à payer</span>
              <strong class="sf-payment-value">${formatMontant(remaining)}</strong>
            </div>
          </section>
        ` : ''}
        ${terms ? `
          <section class="sf-extra-panel">
            <div class="sf-extra-title">${isDevis ? 'Conditions et validité de l’offre' : 'Conditions de règlement'}</div>
            <div class="sf-extra-body">${escapeHtml(terms).replace(/\r?\n/g, '<br/>')}</div>
          </section>
        ` : ''}
        ${bankDetails.length ? `
          <section class="sf-extra-panel">
            <div class="sf-extra-title">Coordonnées de règlement</div>
            <div class="sf-bank-grid">
              ${bankDetails.map(([label, value]) => `<div class="sf-bank-item"><span>${label}</span><strong>${value}</strong></div>`).join('')}
            </div>
          </section>
        ` : ''}
        ${isDevis ? `
          <section class="sf-extra-panel sf-acceptance-panel">
            <div class="sf-extra-title">Bon pour accord — acceptation du devis</div>
            <p class="sf-acceptance-copy">Je confirme accepter le contenu, les quantités, les prix et les conditions indiqués dans le présent devis.</p>
            <div class="sf-acceptance-grid">
              <div class="sf-sign-field"><span class="sf-sign-label">Nom et fonction</span><span class="sf-sign-line"></span></div>
              <div class="sf-sign-field"><span class="sf-sign-label">Date</span><span class="sf-sign-line"></span></div>
              <div class="sf-sign-field"><span class="sf-sign-label">Signature et cachet</span><span class="sf-sign-line"></span></div>
            </div>
          </section>
        ` : ''}
        ${legalDetails.length || legalMentions ? `
          <section class="sf-doc-legal">
            ${legalDetails.length ? `<div>${legalDetails.join(' · ')}</div>` : ''}
            ${legalMentions ? `<div class="sf-doc-legal-mentions">${legalMentions}</div>` : ''}
          </section>
        ` : ''}
      </div>
    `;
  }


  // --- Collection Entreprise : quatre mises en page exclusives supplémentaires. ---
  // Les données, calculs, blocs TVA et mentions restent communs aux autres modèles.

  function renderExecutive(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div class="sf-executive-header" style="margin:-40px -40px 28px; padding:28px 40px 25px; background:#172840; border-bottom:4px solid #C8A96B; color:#fff; display:flex; justify-content:space-between; align-items:center; gap:18px;">
        <div style="display:flex; align-items:center; gap:15px; min-width:0;">
          ${user.entreprise_logo ? `<div style="width:58px;height:58px;display:grid;place-items:center;padding:5px;border-radius:8px;background:#fff;">${logoHtml(user,48,personnalisation)}</div>` : ''}
          <div><div style="font-family:var(--font-display);font-size:1.14rem;font-weight:800;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
            <div style="margin-top:5px;color:#C8D2DF;font-size:.76rem;">${escapeHtml(user.entreprise_adresse || '')}</div>
            <div style="color:#C8D2DF;font-size:.72rem;">${escapeHtml(user.entreprise_telephone || '')} ${user.entreprise_email ? '· ' + escapeHtml(user.entreprise_email) : ''}</div></div>
        </div>
        <div style="text-align:right;flex:0 0 auto;"><div style="color:#D9BF8A;font-size:.65rem;font-weight:800;letter-spacing:.2em;">SÉRIE EXÉCUTIVE</div>
          <div style="margin-top:7px;font-family:var(--font-display);font-size:1.42rem;font-weight:800;letter-spacing:.08em;">${isDevis ? 'DEVIS' : 'FACTURE'}</div>
          <div style="margin-top:3px;color:#DCE4EF;font-size:.78rem;">N° ${escapeHtml(facture.numero)}</div></div>
      </div>
      <div class="sf-executive-meta" style="display:grid;grid-template-columns:1.15fr .85fr;gap:18px;margin-bottom:25px;">
        <div class="sf-executive-recipient" style="padding:15px 17px;border-left:3px solid #C8A96B;background:#F6F7F9;">
          <div style="color:#7A8492;font-size:.66rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase;margin-bottom:8px;">Destinataire</div>${clientBlockHtml(facture)}
        </div>
        <div class="sf-executive-references" style="padding:14px 16px;border:1px solid #E1E5EA;border-radius:8px;">
          <div style="color:#7A8492;font-size:.66rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase;margin-bottom:8px;">Références du document</div>
          <div style="font-size:.8rem;line-height:1.9;"><span style="color:#7A8492;">Date d’émission</span> ${formatDate(facture.date_emission)}</div>
          <div style="font-size:.8rem;line-height:1.9;"><span style="color:#7A8492;">${isDevis ? 'Validité du devis' : 'Échéance de paiement'}</span> ${formatDate(isDevis ? facture.date_validite : facture.date_echeance)}</div>
          <div style="margin-top:7px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>
      <table><thead><tr><th style="background:#172840;color:#fff;">Désignation</th><th style="background:#172840;color:#fff;">Qté</th><th style="background:#172840;color:#fff;">Prix U.</th><th style="background:#172840;color:#fff;">TVA</th><th style="background:#172840;color:#fff;text-align:right;">Total</th></tr></thead><tbody>${lignesRowsHtml(lignes)}</tbody></table>
      <div class="sf-executive-totals" style="display:flex;justify-content:flex-end;margin-top:20px;"><div style="width:300px;padding:15px 18px;border-top:3px solid #C8A96B;background:#F5F6F8;">${totalsRowsHtml(facture,'#172840',personnalisation)}</div></div>
      ${footerHtml(user,facture,isDevis,paymentStampLabel(facture,isDevis)==='Payée'?'':'stamp-clay',qrCode,personnalisation)}
    `;
  }

  function renderInstitution(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div style="padding-bottom:20px;margin-bottom:24px;border-top:5px solid #315A78;border-bottom:1px solid #C9D4DE;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:19px 0 16px;">
          <div style="display:flex;align-items:center;gap:13px;min-width:0;">${user.entreprise_logo ? `<div style="width:54px;height:54px;display:grid;place-items:center;">${logoHtml(user,48,personnalisation)}</div>` : ''}
            <div><div style="font-family:var(--font-display);font-size:1.04rem;font-weight:800;color:#24465F;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
              <div style="margin-top:4px;color:#66798A;font-size:.76rem;">${escapeHtml(user.entreprise_adresse || '')}</div>
              <div style="color:#66798A;font-size:.72rem;">${escapeHtml(user.entreprise_telephone || '')} ${user.entreprise_email ? '· ' + escapeHtml(user.entreprise_email) : ''}</div></div>
          </div>
          <div style="min-width:145px;text-align:right;"><div style="color:#315A78;font-size:.64rem;font-weight:800;letter-spacing:.16em;">DOCUMENT COMMERCIAL</div>
            <div style="margin-top:7px;color:#203C54;font-family:var(--font-display);font-size:1.28rem;font-weight:800;">${isDevis ? 'DEVIS' : 'FACTURE'}</div>
            <div style="font-size:.76rem;color:#66798A;">${escapeHtml(facture.numero)}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid #DCE3E9;">
          <div style="padding:10px 12px;border-right:1px solid #DCE3E9;"><div style="color:#718293;font-size:.62rem;text-transform:uppercase;">Date d’émission</div><strong style="display:block;margin-top:3px;color:#263F55;font-size:.78rem;">${formatDate(facture.date_emission)}</strong></div>
          <div style="padding:10px 12px;border-right:1px solid #DCE3E9;"><div style="color:#718293;font-size:.62rem;text-transform:uppercase;">${isDevis ? 'Validité' : 'Échéance'}</div><strong style="display:block;margin-top:3px;color:#263F55;font-size:.78rem;">${formatDate(isDevis ? facture.date_validite : facture.date_echeance)}</strong></div>
          <div style="padding:10px 12px;"><div style="color:#718293;font-size:.62rem;text-transform:uppercase;">Statut</div><div style="margin-top:3px;">${statutBadge(facture.statut)}</div></div>
        </div>
      </div>
      <div style="margin-bottom:23px;padding:14px 17px;border:1px solid #DCE3E9;border-radius:4px;"><div style="color:#315A78;font-size:.66rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase;margin-bottom:7px;">À l’attention de</div>${clientBlockHtml(facture)}</div>
      <table><thead><tr><th style="background:#315A78;color:#fff;">Désignation</th><th style="background:#315A78;color:#fff;">Qté</th><th style="background:#315A78;color:#fff;">Prix U.</th><th style="background:#315A78;color:#fff;">TVA</th><th style="background:#315A78;color:#fff;text-align:right;">Total</th></tr></thead><tbody>${lignesRowsHtml(lignes)}</tbody></table>
      <div style="display:flex;justify-content:flex-end;margin-top:20px;"><div style="width:285px;padding:14px 16px;border:1px solid #CAD5DF;border-top:3px solid #315A78;background:#F7F9FB;">${totalsRowsHtml(facture,'#315A78',personnalisation)}</div></div>
      ${footerHtml(user,facture,isDevis,paymentStampLabel(facture,isDevis)==='Payée'?'':'stamp-clay',qrCode,personnalisation)}
    `;
  }

  function renderSignature(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div class="sf-signature-header" style="margin:-40px -40px 28px;padding:27px 40px 24px;border-top:7px solid #174D46;background:#F4F6F1;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;">
          <div style="max-width:65%;"><div style="color:#9A7B4F;font-size:.64rem;font-weight:800;letter-spacing:.2em;">SÉLECTION SIGNATURE</div>
            <div style="margin-top:8px;color:#173D38;font-family:var(--font-display);font-size:1.48rem;font-weight:800;letter-spacing:-.035em;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
            <div style="margin-top:5px;color:#64756F;font-size:.76rem;line-height:1.55;">${escapeHtml(user.entreprise_adresse || '')}<br/>${escapeHtml(user.entreprise_telephone || '')} ${user.entreprise_email ? '· ' + escapeHtml(user.entreprise_email) : ''}</div></div>
          <div style="width:76px;height:76px;display:grid;place-items:center;padding:7px;border:1px solid #C7B18A;border-radius:50%;background:#fff;">${logoHtml(user,58,personnalisation)}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:15px;margin-top:21px;padding-top:14px;border-top:1px solid #D8DED6;">
          <div style="color:#174D46;font-family:var(--font-display);font-size:1.15rem;font-weight:800;letter-spacing:.12em;">${isDevis ? 'PROPOSITION' : 'FACTURE'}</div>
          <div style="color:#9A7B4F;font-size:.75rem;font-weight:800;letter-spacing:.1em;">N° ${escapeHtml(facture.numero)}</div>
        </div>
      </div>
      <div class="sf-signature-meta" style="display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-bottom:25px;">
        <div class="sf-signature-recipient"><div style="color:#9A7B4F;font-size:.64rem;font-weight:800;letter-spacing:.15em;text-transform:uppercase;margin-bottom:8px;">Destinataire</div>${clientBlockHtml(facture)}</div>
        <div class="sf-signature-references" style="padding:12px 15px;border-left:2px solid #C7B18A;background:#F8F8F5;font-size:.8rem;line-height:1.9;">
          <div><span style="color:#718078;">Date d’émission :</span> ${formatDate(facture.date_emission)}</div>
          <div><span style="color:#718078;">${isDevis ? 'Validité du devis :' : 'Échéance de paiement :'}</span> ${formatDate(isDevis ? facture.date_validite : facture.date_echeance)}</div>
          <div style="margin-top:5px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>
      <table><thead><tr><th style="background:#174D46;color:#fff;">Désignation</th><th style="background:#174D46;color:#fff;">Qté</th><th style="background:#174D46;color:#fff;">Prix U.</th><th style="background:#174D46;color:#fff;">TVA</th><th style="background:#174D46;color:#fff;text-align:right;">Total</th></tr></thead><tbody>${lignesRowsHtml(lignes)}</tbody></table>
      <div class="sf-signature-totals" style="display:flex;justify-content:flex-end;margin-top:20px;"><div style="width:295px;padding:14px 17px;border-top:2px solid #C7B18A;background:#F5F6F1;">${totalsRowsHtml(facture,'#174D46',personnalisation)}</div></div>
      ${footerHtml(user,facture,isDevis,paymentStampLabel(facture,isDevis)==='Payée'?'':'stamp-clay',qrCode,personnalisation,'sf-signature-footer')}
    `;
  }

  function renderConsolide(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div class="sf-consolide-header" style="margin:-40px -40px 27px;padding:25px 40px 23px;background:#202E43;color:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;">
          <div><div style="color:#A9B8CA;font-size:.62rem;font-weight:800;letter-spacing:.2em;">ESPACE FINANCE & GESTION</div>
            <div style="margin-top:7px;font-family:var(--font-display);font-size:1.22rem;font-weight:800;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
            <div style="margin-top:4px;color:#C6D0DD;font-size:.74rem;">${escapeHtml(user.entreprise_adresse || '')}</div></div>
          <div style="text-align:right;">${user.entreprise_logo ? `<div style="margin-bottom:8px;">${logoHtml(user,45,personnalisation)}</div>` : ''}
            <div style="color:#D8BF8D;font-size:.65rem;font-weight:800;letter-spacing:.16em;">${isDevis ? 'DEVIS' : 'FACTURE'}</div>
            <div style="margin-top:4px;font-size:.86rem;font-weight:700;">${escapeHtml(facture.numero)}</div></div>
        </div>
      </div>
      <div class="sf-consolide-meta" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:23px;">
        <div style="padding:10px;border:1px solid #DCE2E9;background:#F7F8FA;"><div style="color:#7A8797;font-size:.59rem;font-weight:800;letter-spacing:.08em;">ÉMISSION</div><strong style="display:block;margin-top:5px;color:#24364D;font-size:.72rem;">${formatDate(facture.date_emission)}</strong></div>
        <div style="padding:10px;border:1px solid #DCE2E9;background:#F7F8FA;"><div style="color:#7A8797;font-size:.59rem;font-weight:800;letter-spacing:.08em;">${isDevis ? 'VALIDITÉ' : 'ÉCHÉANCE'}</div><strong style="display:block;margin-top:5px;color:#24364D;font-size:.72rem;">${formatDate(isDevis ? facture.date_validite : facture.date_echeance)}</strong></div>
        <div style="padding:10px;border:1px solid #DCE2E9;background:#F7F8FA;"><div style="color:#7A8797;font-size:.59rem;font-weight:800;letter-spacing:.08em;">CLIENT</div><strong style="display:block;margin-top:5px;color:#24364D;font-size:.72rem;">${escapeHtml(facture.client_nom)}</strong></div>
        <div style="padding:10px;border:1px solid #DCE2E9;background:#F7F8FA;"><div style="color:#7A8797;font-size:.59rem;font-weight:800;letter-spacing:.08em;">STATUT</div><div style="margin-top:4px;">${statutBadge(facture.statut)}</div></div>
      </div>
      <div class="sf-consolide-client" style="margin-bottom:22px;padding:13px 16px;border-left:3px solid #5C789A;background:#F4F6F8;"><div style="color:#6C7D91;font-size:.64rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px;">Coordonnées du client</div>${clientBlockHtml(facture)}</div>
      <table><thead><tr><th style="background:#202E43;color:#fff;">Désignation</th><th style="background:#202E43;color:#fff;">Qté</th><th style="background:#202E43;color:#fff;">Prix U.</th><th style="background:#202E43;color:#fff;">TVA</th><th style="background:#202E43;color:#fff;text-align:right;">Total</th></tr></thead><tbody>${lignesRowsHtml(lignes)}</tbody></table>
      <div class="sf-consolide-totals" style="display:flex;justify-content:flex-end;margin-top:19px;"><div style="width:300px;padding:14px 17px;border:1px solid #C9D2DE;border-radius:7px;background:#F7F8FA;">${totalsRowsHtml(facture,'#202E43',personnalisation)}</div></div>
      ${footerHtml(user,facture,isDevis,paymentStampLabel(facture,isDevis)==='Payée'?'':'stamp-clay',qrCode,personnalisation,'sf-consolide-footer')}
    `;
  }

  // --- Nouveaux modèles : cinq compositions distinctes, compatibles facture et devis ---

  function renderNova(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return [
      '<div style="margin:-40px -40px 25px;padding:27px 40px 24px;background:#142B3B;color:#fff;border-bottom:5px solid #20B89A;">',
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:18px;">',
          '<div style="display:flex;align-items:center;gap:14px;min-width:0;">' + logoHtml(user,58,personnalisation) +
            '<div><div style="font-size:1.2rem;font-weight:800;letter-spacing:-.02em;">' + escapeHtml(user.entreprise_nom || user.nom) + '</div>' +
            '<div style="margin-top:5px;color:#C6D8DF;font-size:.76rem;line-height:1.6;">' + escapeHtml(user.entreprise_adresse || '') + '<br/>' + escapeHtml(user.entreprise_telephone || '') + (user.entreprise_email ? ' · ' + escapeHtml(user.entreprise_email) : '') + '</div></div>',
          '</div>',
          '<div style="text-align:right;flex-shrink:0;"><div style="color:#70E0C7;font-size:.62rem;font-weight:800;letter-spacing:.2em;">NOVA / DOCUMENT</div>' +
            '<div style="margin-top:5px;font-size:1.35rem;font-weight:850;letter-spacing:.04em;">' + (isDevis ? 'DEVIS' : 'FACTURE') + '</div>' +
            '<div style="margin-top:4px;color:#C6D8DF;font-size:.78rem;">' + escapeHtml(facture.numero) + '</div></div>',
        '</div>',
      '</div>',
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:23px;">',
        '<div style="padding:14px 16px;border:1px solid #D8E6E6;border-left:4px solid #20B89A;border-radius:7px;background:#F5FBF9;"><div style="color:#16866E;font-size:.65rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin-bottom:7px;">Facturé à</div>' + clientBlockHtml(facture) + '</div>',
        '<div style="padding:14px 16px;border:1px solid #DCE5EA;border-radius:7px;background:#F7F9FA;font-size:.78rem;line-height:1.9;">' +
          '<div><span style="color:#718391;">Date d’émission :</span> ' + formatDate(facture.date_emission) + '</div>' +
          '<div><span style="color:#718391;">Échéance :</span> ' + formatDate(facture.date_echeance) + '</div><div style="margin-top:5px;">' + statutBadge(facture.statut) + '</div></div>',
      '</div>',
      '<table><thead><tr><th style="background:#142B3B;color:#fff;">Désignation</th><th style="background:#142B3B;color:#fff;">Qté</th><th style="background:#142B3B;color:#fff;">Prix U.</th><th style="background:#142B3B;color:#fff;">TVA</th><th style="background:#142B3B;color:#fff;text-align:right;">Total</th></tr></thead><tbody>' + lignesRowsHtml(lignes) + '</tbody></table>',
      '<div style="display:flex;justify-content:flex-end;margin-top:20px;"><div style="width:300px;padding:15px 17px;border:1px solid #B9DED4;border-left:4px solid #20B89A;border-radius:7px;background:#F5FBF9;">' + totalsRowsHtml(facture,'#142B3B',personnalisation) + '</div></div>',
      footerHtml(user,facture,isDevis,paymentStampLabel(facture,isDevis)==='Payée'?'':'stamp-clay',qrCode,personnalisation)
    ].join('');
  }

  function renderNordique(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return [
      '<div style="margin-bottom:26px;padding:0 0 20px;border-top:4px solid #71816C;border-bottom:1px solid #DCE2D8;">',
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-top:21px;">',
          '<div style="max-width:65%;">' + logoHtml(user,54,personnalisation) +
            '<div style="margin-top:12px;color:#25362B;font-size:1.35rem;font-weight:750;letter-spacing:-.035em;">' + escapeHtml(user.entreprise_nom || user.nom) + '</div>' +
            '<div style="margin-top:5px;color:#718071;font-size:.76rem;line-height:1.65;">' + escapeHtml(user.entreprise_adresse || '') + '<br/>' + escapeHtml(user.entreprise_telephone || '') + (user.entreprise_email ? ' · ' + escapeHtml(user.entreprise_email) : '') + '</div></div>',
          '<div style="min-width:145px;text-align:right;"><div style="color:#7B8B75;font-size:.63rem;font-weight:800;letter-spacing:.22em;">DOCUMENT</div>' +
            '<div style="margin-top:8px;color:#25362B;font-family:Georgia,serif;font-size:1.55rem;font-weight:700;">' + (isDevis ? 'DEVIS' : 'FACTURE') + '</div>' +
            '<div style="margin-top:5px;color:#7B8B75;font-size:.78rem;">' + escapeHtml(facture.numero) + '</div></div>',
        '</div>',
      '</div>',
      '<div style="display:grid;grid-template-columns:1.15fr .85fr;gap:22px;margin-bottom:26px;">',
        '<div><div style="margin-bottom:7px;color:#71816C;font-size:.65rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase;">Votre client</div>' + clientBlockHtml(facture) + '</div>',
        '<div style="padding:12px 15px;border-left:2px solid #A7B49F;background:#F6F8F4;color:#526151;font-size:.78rem;line-height:2;">' +
          '<div><strong style="color:#344537;">Date d’émission :</strong> ' + formatDate(facture.date_emission) + '</div>' +
          '<div><strong style="color:#344537;">Échéance :</strong> ' + formatDate(facture.date_echeance) + '</div><div style="margin-top:4px;">' + statutBadge(facture.statut) + '</div></div>',
      '</div>',
      '<table><thead><tr><th style="background:#E8EEE5;color:#354638;border-bottom:2px solid #A7B49F;">Désignation</th><th style="background:#E8EEE5;color:#354638;border-bottom:2px solid #A7B49F;">Qté</th><th style="background:#E8EEE5;color:#354638;border-bottom:2px solid #A7B49F;">Prix U.</th><th style="background:#E8EEE5;color:#354638;border-bottom:2px solid #A7B49F;">TVA</th><th style="background:#E8EEE5;color:#354638;border-bottom:2px solid #A7B49F;text-align:right;">Total</th></tr></thead><tbody>' + lignesRowsHtml(lignes) + '</tbody></table>',
      '<div style="display:flex;justify-content:flex-end;margin-top:22px;"><div style="width:285px;padding:13px 16px;border-top:2px solid #71816C;background:#F6F8F4;">' + totalsRowsHtml(facture,'#354638',personnalisation) + '</div></div>',
      footerHtml(user,facture,isDevis,paymentStampLabel(facture,isDevis)==='Payée'?'':'stamp-clay',qrCode,personnalisation)
    ].join('');
  }

  function renderLuxe(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return [
      '<div class="sf-luxe-header" style="margin:-40px -40px 26px;padding:28px 40px 25px;background:#252321;color:#F9F5ED;border-bottom:3px solid #B99A62;">',
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:18px;">',
          '<div><div style="color:#C9AE7B;font-size:.62rem;font-weight:800;letter-spacing:.24em;">COLLECTION LUXE</div>' +
            '<div style="margin-top:9px;font-family:Georgia,serif;font-size:1.42rem;font-weight:700;letter-spacing:.01em;">' + escapeHtml(user.entreprise_nom || user.nom) + '</div>' +
            '<div style="margin-top:5px;color:#D3CBBE;font-size:.74rem;line-height:1.65;">' + escapeHtml(user.entreprise_adresse || '') + '<br/>' + escapeHtml(user.entreprise_telephone || '') + (user.entreprise_email ? ' · ' + escapeHtml(user.entreprise_email) : '') + '</div></div>',
          '<div style="width:74px;height:74px;display:grid;place-items:center;flex-shrink:0;border:1px solid #B99A62;border-radius:50%;background:#fff;">' + logoHtml(user,58,personnalisation) + '</div>',
        '</div>',
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin-top:23px;padding-top:13px;border-top:1px solid rgba(201,174,123,.4);">' +
          '<div style="color:#D8BF8A;font-family:Georgia,serif;font-size:1.18rem;letter-spacing:.12em;">' + (isDevis ? 'PROPOSITION' : 'FACTURE') + '</div>' +
          '<div style="color:#F9F5ED;font-size:.78rem;font-weight:700;">N° ' + escapeHtml(facture.numero) + '</div></div>',
      '</div>',
      '<div class="sf-luxe-client-grid" style="display:grid;grid-template-columns:1.15fr .85fr;gap:20px;margin-bottom:25px;">',
        '<div style="padding:14px 16px;border:1px solid #E6DDCC;background:#FCFAF6;"><div style="color:#A18453;font-size:.63rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;margin-bottom:8px;">Client</div>' + clientBlockHtml(facture) + '</div>',
        '<div style="padding:13px 15px;background:#F5F1E9;color:#5E5649;font-size:.78rem;line-height:1.95;">' +
          '<div><span style="color:#96815F;">Date d’émission :</span> ' + formatDate(facture.date_emission) + '</div>' +
          '<div><span style="color:#96815F;">Échéance :</span> ' + formatDate(facture.date_echeance) + '</div><div style="margin-top:4px;">' + statutBadge(facture.statut) + '</div></div>',
      '</div>',
      '<table><thead><tr><th style="background:#3B3934;color:#F9F5ED;">Désignation</th><th style="background:#3B3934;color:#F9F5ED;">Qté</th><th style="background:#3B3934;color:#F9F5ED;">Prix U.</th><th style="background:#3B3934;color:#F9F5ED;">TVA</th><th style="background:#3B3934;color:#F9F5ED;text-align:right;">Total</th></tr></thead><tbody>' + lignesRowsHtml(lignes) + '</tbody></table>',
      '<div class="sf-luxe-totals" style="display:flex;justify-content:flex-end;margin-top:22px;"><div style="width:300px;padding:15px 18px;border:1px solid #D8C59F;border-top:3px solid #B99A62;background:#FCFAF6;">' + totalsRowsHtml(facture,'#3B3934',personnalisation) + '</div></div>',
      footerHtml(user,facture,isDevis,paymentStampLabel(facture,isDevis)==='Payée'?'':'stamp-clay',qrCode,personnalisation)
    ].join('');
  }

  function renderTech(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return [
      '<div style="margin:-40px -40px 25px;padding:24px 40px 23px;background:#10253F;color:#fff;border-left:8px solid #31B8D4;">',
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;">',
          '<div><div style="color:#74D8E8;font-size:.62rem;font-weight:800;letter-spacing:.2em;">TECH / BUSINESS</div>' +
            '<div style="margin-top:8px;font-size:1.23rem;font-weight:800;">' + escapeHtml(user.entreprise_nom || user.nom) + '</div>' +
            '<div style="margin-top:5px;color:#BCD0E1;font-size:.73rem;line-height:1.65;">' + escapeHtml(user.entreprise_adresse || '') + '<br/>' + escapeHtml(user.entreprise_telephone || '') + (user.entreprise_email ? ' · ' + escapeHtml(user.entreprise_email) : '') + '</div></div>',
          '<div style="min-width:145px;text-align:right;">' + logoHtml(user,52,personnalisation) +
            '<div style="margin-top:10px;color:#74D8E8;font-size:.62rem;font-weight:800;letter-spacing:.15em;">' + (isDevis ? 'DEVIS' : 'FACTURE') + '</div>' +
            '<div style="margin-top:4px;font-family:monospace;font-size:.82rem;">' + escapeHtml(facture.numero) + '</div></div>',
        '</div>',
      '</div>',
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:22px;">',
        '<div style="padding:11px 12px;border:1px solid #D7E4EE;background:#F4F8FB;"><div style="color:#648099;font-size:.59rem;font-weight:800;letter-spacing:.1em;">ÉMISSION</div><strong style="display:block;margin-top:5px;color:#183A57;font-size:.78rem;">' + formatDate(facture.date_emission) + '</strong></div>',
        '<div style="padding:11px 12px;border:1px solid #D7E4EE;background:#F4F8FB;"><div style="color:#648099;font-size:.59rem;font-weight:800;letter-spacing:.1em;">' + (isDevis ? 'VALIDITÉ' : 'ÉCHÉANCE') + '</div><strong style="display:block;margin-top:5px;color:#183A57;font-size:.78rem;">' + formatDate(facture.date_echeance) + '</strong></div>',
        '<div style="padding:11px 12px;border:1px solid #D7E4EE;background:#F4F8FB;"><div style="color:#648099;font-size:.59rem;font-weight:800;letter-spacing:.1em;">STATUT</div><div style="margin-top:4px;">' + statutBadge(facture.statut) + '</div></div>',
      '</div>',
      '<div style="margin-bottom:22px;padding:13px 16px;border:1px solid #D7E4EE;border-left:4px solid #31B8D4;border-radius:6px;"><div style="color:#3289A4;font-size:.63rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:7px;">Destinataire</div>' + clientBlockHtml(facture) + '</div>',
      '<table><thead><tr><th style="background:#183A57;color:#fff;">Désignation</th><th style="background:#183A57;color:#fff;">Qté</th><th style="background:#183A57;color:#fff;">Prix U.</th><th style="background:#183A57;color:#fff;">TVA</th><th style="background:#183A57;color:#fff;text-align:right;">Total</th></tr></thead><tbody>' + lignesRowsHtml(lignes) + '</tbody></table>',
      '<div style="display:flex;justify-content:flex-end;margin-top:20px;"><div style="width:300px;padding:14px 17px;border:1px solid #C6DDE8;border-radius:6px;background:#F4F8FB;">' + totalsRowsHtml(facture,'#183A57',personnalisation) + '</div></div>',
      footerHtml(user,facture,isDevis,paymentStampLabel(facture,isDevis)==='Payée'?'':'stamp-clay',qrCode,personnalisation)
    ].join('');
  }

  function renderHorizon(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return [
      '<div style="margin:-40px -40px 26px;padding:25px 40px 24px;background:#EAF2F8;border-top:6px solid #2C6592;">',
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;">',
          '<div><div style="color:#2C6592;font-size:.62rem;font-weight:800;letter-spacing:.2em;">HORIZON / GESTION</div>' +
            '<div style="margin-top:8px;color:#173B59;font-size:1.34rem;font-weight:800;letter-spacing:-.03em;">' + escapeHtml(user.entreprise_nom || user.nom) + '</div>' +
            '<div style="margin-top:5px;color:#61778A;font-size:.76rem;line-height:1.65;">' + escapeHtml(user.entreprise_adresse || '') + '<br/>' + escapeHtml(user.entreprise_telephone || '') + (user.entreprise_email ? ' · ' + escapeHtml(user.entreprise_email) : '') + '</div></div>',
          '<div style="text-align:right;">' + logoHtml(user,58,personnalisation) +
            '<div style="margin-top:11px;color:#2C6592;font-size:1.1rem;font-weight:850;letter-spacing:.08em;">' + (isDevis ? 'DEVIS' : 'FACTURE') + '</div>' +
            '<div style="margin-top:4px;color:#496982;font-size:.78rem;">' + escapeHtml(facture.numero) + '</div></div>',
        '</div>',
      '</div>',
      '<div style="display:grid;grid-template-columns:1.1fr .9fr;gap:18px;margin-bottom:24px;">',
        '<div><div style="color:#2C6592;font-size:.64rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase;margin-bottom:8px;">Pour</div>' + clientBlockHtml(facture) + '</div>',
        '<div style="padding:14px 16px;border-radius:8px;background:#F4F7FA;color:#455F73;font-size:.78rem;line-height:1.95;">' +
          '<div><strong style="color:#173B59;">Date d’émission :</strong> ' + formatDate(facture.date_emission) + '</div>' +
          '<div><strong style="color:#173B59;">Échéance :</strong> ' + formatDate(facture.date_echeance) + '</div><div style="margin-top:5px;">' + statutBadge(facture.statut) + '</div></div>',
      '</div>',
      '<table><thead><tr><th style="background:#2C6592;color:#fff;">Désignation</th><th style="background:#2C6592;color:#fff;">Qté</th><th style="background:#2C6592;color:#fff;">Prix U.</th><th style="background:#2C6592;color:#fff;">TVA</th><th style="background:#2C6592;color:#fff;text-align:right;">Total</th></tr></thead><tbody>' + lignesRowsHtml(lignes) + '</tbody></table>',
      '<div style="display:flex;justify-content:flex-end;margin-top:21px;"><div style="width:290px;padding:14px 17px;border-radius:8px;border-top:3px solid #2C6592;background:#F4F7FA;">' + totalsRowsHtml(facture,'#173B59',personnalisation) + '</div></div>',
      footerHtml(user,facture,isDevis,paymentStampLabel(facture,isDevis)==='Payée'?'':'stamp-clay',qrCode,personnalisation)
    ].join('');
  }

  // Générateur de variantes premium : chaque thème conserve une composition propre, tout en
  // réutilisant les helpers échappés, les calculs, les lignes, les totaux et le pied de page
  // communs. Aucun calcul métier n'est effectué dans les modèles de présentation.
  function makePremiumRenderer(config) {
    return function renderPremium(user, facture, lignes, isDevis, qrCode, personnalisation) {
      const companyName = escapeHtml(user.entreprise_nom || user.nom);
      const companyAddress = escapeHtml(user.entreprise_adresse || '');
      const companyContact = [
        user.entreprise_telephone ? escapeHtml(user.entreprise_telephone) : '',
        user.entreprise_email ? escapeHtml(user.entreprise_email) : ''
      ].filter(Boolean).join(' · ');
      const logo = logoHtml(user, config.logoSize || 58, personnalisation);
      const documentName = isDevis ? 'DEVIS' : 'FACTURE';
      const documentRef = escapeHtml(facture.numero || '');
      const identity = '<div style="display:flex;align-items:center;gap:13px;min-width:0;">' + logo +
        '<div style="min-width:0;"><div style="font-size:' + (config.companySize || '1.08rem') +
        ';font-weight:800;letter-spacing:' + (config.letterSpacing || '-.02em') + ';">' + companyName +
        '</div><div style="margin-top:5px;font-size:.74rem;line-height:1.65;opacity:.82;">' +
        companyAddress + (companyContact ? '<br/>' + companyContact : '') + '</div></div></div>';
      const documentLabel = '<div style="text-align:right;min-width:118px;"><div style="font-size:.62rem;font-weight:800;letter-spacing:.18em;">' +
        documentName + '</div><div style="margin-top:7px;font-size:' + (config.referenceSize || '.95rem') +
        ';font-weight:750;letter-spacing:.02em;">' + documentRef + '</div></div>';
      let header = '';
      if (config.layout === 'bar') {
        header = '<div style="margin:-40px -40px 25px;padding:25px 40px 24px;background:' + config.primary +
          ';color:#fff;border-bottom:5px solid ' + config.accent +
          ';display:flex;justify-content:space-between;align-items:center;gap:18px;">' + identity + documentLabel + '</div>';
      } else if (config.layout === 'split') {
        header = '<div style="margin:-40px -40px 25px;padding:23px 40px 22px;border-top:5px solid ' + config.accent +
          ';border-bottom:1px solid ' + config.line +
          ';display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;"><div>' + identity +
          '</div><div style="padding:13px 16px;background:' + config.pale + ';border-left:3px solid ' + config.accent +
          ';color:' + config.primary + ';">' + documentLabel + '</div></div>';
      } else if (config.layout === 'rail') {
        header = '<div style="margin:-40px -40px 25px;padding:24px 40px 23px;border-left:9px solid ' + config.accent +
          ';background:' + config.pale + ';display:flex;justify-content:space-between;align-items:center;gap:18px;"><div style="color:' +
          config.primary + ';">' + identity + '</div><div style="color:' + config.primary + ';">' + documentLabel + '</div></div>';
      } else if (config.layout === 'frame') {
        header = '<div style="margin:-40px -40px 25px;padding:21px 40px 22px;background:' + config.primary +
          ';color:#fff;border:1px solid ' + config.accent + ';outline:1px solid ' + config.accent +
          ';outline-offset:-7px;"><div style="display:flex;justify-content:space-between;align-items:center;gap:18px;">' +
          identity + documentLabel + '</div></div>';
      } else if (config.layout === 'tiles') {
        header = '<div style="margin:-40px -40px 25px;padding:22px 40px 21px;background:' + config.pale +
          ';border-top:7px solid ' + config.primary +
          ';display:flex;justify-content:space-between;align-items:center;gap:18px;"><div style="color:' +
          config.primary + ';">' + identity + '</div><div style="padding:14px 17px;background:' + config.primary +
          ';color:#fff;border-radius:4px;">' + documentLabel + '</div></div>';
      } else if (config.layout === 'grid') {
        header = '<div style="margin:-40px -40px 25px;padding:22px 40px 22px;background:' + config.pale +
          ';border:1px solid ' + config.line +
          ';display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;"><div style="padding-left:13px;border-left:4px solid ' +
          config.accent + ';color:' + config.primary + ';">' + identity + '</div><div style="padding:16px 19px;background:' +
          config.primary + ';color:#fff;min-width:150px;">' + documentLabel + '</div></div>';
      } else {
        header = '<div style="margin:-40px -40px 25px;padding:23px 40px 22px;text-align:center;border-top:3px double ' +
          config.accent + ';border-bottom:3px double ' + config.accent + ';color:' + config.primary +
          ';"><div style="display:flex;justify-content:center;margin-bottom:9px;">' + logo +
          '</div><div style="font-size:1.12rem;font-weight:800;letter-spacing:.08em;">' + companyName +
          '</div><div style="margin-top:5px;font-size:.73rem;line-height:1.6;">' + companyAddress +
          (companyContact ? ' · ' + companyContact : '') + '</div><div style="margin-top:13px;font-size:.65rem;font-weight:800;letter-spacing:.22em;">' +
          documentName + ' · ' + documentRef + '</div></div>';
      }
      const metaCards = '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:0 0 21px;">' +
        '<div style="padding:11px 12px;background:' + config.pale + ';border:1px solid ' + config.line +
        ';"><div style="color:' + config.accent + ';font-size:.58rem;font-weight:800;letter-spacing:.1em;">DATE D’ÉMISSION</div>' +
        '<strong style="display:block;margin-top:6px;color:' + config.primary + ';font-size:.78rem;">' +
        formatDate(facture.date_emission) + '</strong></div>' +
        '<div style="padding:11px 12px;background:' + config.pale + ';border:1px solid ' + config.line +
        ';"><div style="color:' + config.accent + ';font-size:.58rem;font-weight:800;letter-spacing:.1em;">' +
        (isDevis ? 'VALIDITÉ DU DEVIS' : 'ÉCHÉANCE') + '</div><strong style="display:block;margin-top:6px;color:' +
        config.primary + ';font-size:.78rem;">' + formatDate(facture.date_echeance) + '</strong></div>' +
        '<div style="padding:11px 12px;background:' + config.pale + ';border:1px solid ' + config.line +
        ';"><div style="color:' + config.accent + ';font-size:.58rem;font-weight:800;letter-spacing:.1em;">STATUT</div>' +
        '<div style="margin-top:5px;">' + statutBadge(facture.statut) + '</div></div></div>';
      const client = '<div style="margin-bottom:21px;padding:14px 16px;background:' +
        (config.clientBackground || config.pale) + ';border:1px solid ' + config.line + ';border-left:4px solid ' +
        config.accent + ';"><div style="margin-bottom:7px;color:' + config.accent +
        ';font-size:.62rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">' +
        (config.clientLabel || 'FACTURÉ À') + '</div>' + clientBlockHtml(facture) + '</div>';
      const table = '<table><thead><tr><th style="background:' + config.primary +
        ';color:#fff;">Désignation</th><th style="background:' + config.primary +
        ';color:#fff;">Qté</th><th style="background:' + config.primary +
        ';color:#fff;">Prix U.</th><th style="background:' + config.primary +
        ';color:#fff;">TVA</th><th style="background:' + config.primary +
        ';color:#fff;text-align:right;">Total</th></tr></thead><tbody>' + lignesRowsHtml(lignes) + '</tbody></table>';
      const totals = '<div style="display:flex;justify-content:flex-end;margin-top:19px;"><div style="width:300px;padding:15px 17px;background:' +
        config.pale + ';border:1px solid ' + config.line + ';border-top:4px solid ' +
        config.accent + ';">' + totalsRowsHtml(facture, config.accent, personnalisation) + '</div></div>';
      return header + metaCards + client + table + totals +
        footerHtml(user, facture, isDevis, paymentStampLabel(facture,isDevis)==='Payée'?'':'stamp-clay', qrCode, personnalisation);
    };
  }

  // Trois créations Pro supplémentaires : sobres, modernes et immédiatement lisibles.
  const renderEclipse = makePremiumRenderer({
    layout:'rail', primary:'#173B32', accent:'#2E8066', pale:'#EEF6F2', line:'#D5E7DE',
    companySize:'1.16rem', logoSize:62, referenceSize:'1rem', clientLabel:'CLIENT'
  });
  const renderSaphir = makePremiumRenderer({
    layout:'bar', primary:'#173A70', accent:'#4A86D8', pale:'#EEF4FC', line:'#D7E4F4',
    companySize:'1.12rem', logoSize:58, referenceSize:'1rem', clientLabel:'INFORMATIONS CLIENT'
  });
  const renderConseil = makePremiumRenderer({
    layout:'split', primary:'#344255', accent:'#A27B4E', pale:'#F5F3EE', line:'#E4DED2',
    companySize:'1.02rem', logoSize:54, referenceSize:'.9rem', clientLabel:'DESTINATAIRE'
  });

  // Quatre créations exclusives Entreprise, pensées pour les dossiers B2B et les organisations.
  const renderImperial = makePremiumRenderer({
    layout:'frame', primary:'#25242A', accent:'#C4A46A', pale:'#F7F4ED', line:'#E7DDC8',
    companySize:'1.14rem', logoSize:60, referenceSize:'1rem', clientLabel:'COMPTE CLIENT'
  });
  const renderPanorama = makePremiumRenderer({
    layout:'tiles', primary:'#145B62', accent:'#35A6A0', pale:'#EAF5F4', line:'#D1E8E6',
    companySize:'1.12rem', logoSize:60, referenceSize:'1rem', clientLabel:'FACTURÉ À'
  });
  const renderGroupe = makePremiumRenderer({
    layout:'grid', primary:'#24364B', accent:'#7894AC', pale:'#F0F3F6', line:'#DCE3EA',
    companySize:'1.08rem', logoSize:58, referenceSize:'.95rem', clientLabel:'ENTITÉ / CLIENT'
  });
  const renderMajeste = makePremiumRenderer({
    layout:'center', primary:'#633F43', accent:'#B58B67', pale:'#F8F2EE', line:'#E9DCD5',
    companySize:'1.08rem', logoSize:62, referenceSize:'.95rem', clientLabel:'CLIENT'
  });

  const RENDERERS = {
    classique: renderClassique, moderne: renderModerne, minimaliste: renderMinimaliste,
    elegant: renderElegant, corporate: renderCorporate, creatif: renderCreatif,
    prestige: renderPrestige, heritage: renderHeritage, diamant: renderDiamant,
    epure: renderEpure, azur: renderAzur, circuit: renderCircuit,
    platine: renderPlatine, atelier: renderAtelier, saveurs: renderSaveurs,
    executive: renderExecutive, institution: renderInstitution, signature: renderSignature, consolide: renderConsolide,
    nova: renderNova, nordique: renderNordique, luxe: renderLuxe, tech: renderTech, horizon: renderHorizon,
    eclipse: renderEclipse, saphir: renderSaphir, conseil: renderConseil,
    imperial: renderImperial, panorama: renderPanorama, groupe: renderGroupe, majeste: renderMajeste
  };

  // Construit les zones d'en-tête des marges de page CSS (Paged Media).
  // Chromium les répète sur chaque feuille imprimée, sans ajouter de DOM au document.
  // Les données dynamiques sont encodées comme chaînes CSS, et non concaténées en HTML.
  function cssQuotedString(value) {
    let output = '"';
    for (const character of String(value ?? '')) {
      const codePoint = character.codePointAt(0);
      if (character === '"' || character === '\\') {
        output += '\\' + character;
      } else if (codePoint <= 0x1F || codePoint === 0x7F) {
        output += '\\' + codePoint.toString(16) + ' ';
      } else {
        output += character;
      }
    }
    return output + '"';
  }

  function printPageIdentityCss({ user, facture, isDevis }) {
    const companyName = user?.entreprise_nom || user?.nom || 'SamaFacture';
    const documentType = isDevis ? 'DEVIS' : 'FACTURE';
    const documentNumber = facture?.numero || '';
    const reference = documentNumber
      ? documentType + ' · ' + documentNumber
      : documentType;

    return [
      '@page {',
      '  @top-left {',
      '    content: ' + cssQuotedString(companyName) + ';',
      '    color: #64748b;',
      '    font-family: "IBM Plex Sans", Arial, sans-serif;',
      '    font-size: 7pt;',
      '    font-weight: 500;',
      '    vertical-align: bottom;',
      '    padding-bottom: 1mm;',
      '    border-bottom: 0.25mm solid #cbd5e1;',
      '  }',
      '  @top-right {',
      '    content: ' + cssQuotedString(reference) + ';',
      '    color: #334155;',
      '    font-family: "IBM Plex Sans", Arial, sans-serif;',
      '    font-size: 7pt;',
      '    font-weight: 700;',
      '    text-align: right;',
      '    vertical-align: bottom;',
      '    padding-bottom: 1mm;',
      '    border-bottom: 0.25mm solid #cbd5e1;',
      '  }',
      '}',
      // Le bandeau complet du modèle identifie déjà la première page :
      // réserver la ligne répétée aux feuilles de continuation.
      '@page:first {',
      '  @top-left { content: none; border: 0; }',
      '  @top-right { content: none; border: 0; }',
      '}'
    ].join('\n');
  }

  function renderInvoiceHtml({ user, facture, lignes, isDevis, qrCode, template, personnalisation }) {
    const render = RENDERERS[template] || renderClassique;
    // Un devis porte une date de validité, jamais une échéance de paiement.
    // Les 24 modèles partagent le même champ d'affichage pour garder une présentation cohérente.
    const facturePourRendu = isDevis
      ? { ...facture, date_echeance: facture.date_validite || null }
      : facture;
    let html = render(user, facturePourRendu, lignes, isDevis, qrCode, personnalisation);
    // Les modèles Créatif et Corporate avaient deux dates séparées par une flèche,
    // sans en préciser la nature. Nommer explicitement émission et échéance/validité.
    const secondDateLabel = isDevis ? 'Validité du devis' : 'Échéance de paiement';
    html = html.replace(/<div>📅 ([^<]+) → ([^<]+)<\/div>/g,
      '<div><span>Date d’émission :</span> $1<br/><span>' + secondDateLabel + ' :</span> $2</div>');
    html = html.replace(/<div style="font-size:0\.85rem;">([^<]+) → ([^<]+)<\/div>/,
      '<div><span>Date d’émission :</span> $1<br/><span>' + secondDateLabel + ' :</span> $2</div>');
    // Uniformiser les intitulés de dates dans tous les en-têtes historiques des 24 modèles.
    // Certains anciens modèles emploient un libellé court ou ajoutent un deux-points.
    // On remplace uniquement le texte du nœud HTML, jamais les commentaires ni les conditions libres.
    const dateEmissionLabel = 'Date d’émission :';
    const dateLimiteLabel = isDevis ? 'Validité du devis :' : 'Échéance de paiement :';
    html = html
      .replace(/>\s*(?:ÉMISSION|Émis le|Date d’émission|Date d'émission|Date d’édition|Date d'édition)\s*:?\s*</gi,
        '>' + dateEmissionLabel + '<')
      .replace(/>\s*(?:ÉCHÉANCE DE PAIEMENT|ÉCHÉANCE|À régler avant le|Échéance|DATE LIMITE)\s*:?\s*</gi,
        '>' + dateLimiteLabel + '<')
      .replace(/>\s*(?:VALIDITÉ DU DEVIS|VALIDITÉ|Valable jusqu’au|Valable jusqu'au|Validité)\s*:?\s*</gi,
        '>' + dateLimiteLabel + '<');
    if (isDevis) {
      // Le modèle Corporate possède aussi un titre composite "Émission / Échéance".
      // Le corriger pour ne laisser aucune notion de règlement sur un devis.
      html = html.replace(/Émission\s*\/\s*Échéance/gi, 'Émission / Validité du devis');
    }

    // Le bloc de références est partagé par les 24 modèles modèles pour conserver les mêmes
    // informations métier dans chaque facture/devis et dans le PDF Puppeteer.
    const meta = documentMetaHtml(facture, isDevis, template === 'minimaliste' || template === 'saveurs', user, html, template);
    const firstTable = html.indexOf('<table');
    if (meta && firstTable >= 0) html = html.slice(0, firstTable) + meta + html.slice(firstTable);

    // Les libellés précisent maintenant que les prix unitaires sont HT et les montants de
    // lignes TTC. Les tableaux gardent leurs couleurs et leur identité visuelle.
    html = html
      .replace(/<th([^>]*)>Prix U\.<\/th>/g, '<th$1>Prix unitaire HT</th>')
      .replace(/<th([^>]*)>Total<\/th>/g, '<th$1>Montant TTC</th>');

    const tableEnd = html.indexOf('</table>');
    const taxBreakdown = taxBreakdownHtml(facture, lignes);
    if (taxBreakdown && tableEnd >= 0) {
      const insertAt = tableEnd + '</table>'.length;
      html = html.slice(0, insertAt) + taxBreakdown + html.slice(insertAt);
    }

    html += documentSupplementHtml(user, facture, isDevis, template);
    // Le même tableau de lignes reçoit une classe stable pour la mise en page écran et A4.
    html = html.replace(/<table\b([^>]*)>/i, (match, attributes) => {
      const existingClass = attributes.match(/\bclass=["']([^"']*)["']/i);
      const templateTableClass = template === 'platine' ? ' sf-platine-table' : (template === 'luxe' ? ' sf-luxe-table' : '');
      if (existingClass) {
        const nextClass = (existingClass[1] + ' sf-document-table' + templateTableClass).trim();
        return match.replace(existingClass[0], 'class="' + nextClass + '"').replace(/<table\b/i, '<table aria-label="Détail des lignes du document"');
      }
      return '<table class="sf-document-table' + templateTableClass + '" aria-label="Détail des lignes du document"' + attributes + '>';
    });

    // Le même moteur sert à l'écran, à l'impression et au PDF serveur.
    return wrapPersonnalisation(html, personnalisation);
  }

  return { renderInvoiceHtml, printPageIdentityCss, RENDERERS };
}

// Export CommonJS additionnel, utilisé uniquement par les tests Node (server/tests/templates.test.js).
// Sans effet dans le navigateur : `module` n'y est pas défini, donc ce bloc ne s'exécute jamais côté client.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createFactureTemplates };
}
