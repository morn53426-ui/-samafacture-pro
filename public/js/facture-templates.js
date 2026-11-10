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
    serif: 'Georgia, "Times New Roman", serif',
    mono: '"Courier New", Courier, monospace'
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
    if (police) decls.push(`font-family:${police}`);
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
    return lignes.map(l => `
      <tr>
        <td>${escapeHtml(l.designation)}</td>
        <td class="mono">${l.quantite}</td>
        <td class="mono">${formatMontant(l.prix_unitaire)}</td>
        <td class="mono">${l.tva}%</td>
        <td class="mono" style="text-align:right;">${formatMontant(l.total_ligne)}</td>
      </tr>
    `).join('');
  }

  function totalsRowsHtml(facture, isDevis, borderColor, personnalisation) {
    const accent = accentColor(personnalisation, borderColor);
    return `
      <div style="display:flex; justify-content:space-between; padding:6px 0;"><span>Sous-total</span><span class="mono">${formatMontant(facture.sous_total)}</span></div>
      <div style="display:flex; justify-content:space-between; padding:6px 0;"><span>TVA</span><span class="mono">${formatMontant(facture.total_tva)}</span></div>
      <div style="display:flex; justify-content:space-between; padding:6px 0;"><span>Remise</span><span class="mono">- ${formatMontant(facture.remise)}</span></div>
      <div style="display:flex; justify-content:space-between; padding:6px 0;"><span>Livraison</span><span class="mono">${formatMontant(facture.frais_livraison)}</span></div>
      <div style="display:flex; justify-content:space-between; padding:10px 0; border-top:2px solid ${accent}; font-weight:700; font-size:1.1rem;"><span>Total</span><span class="mono">${formatMontant(facture.total)}</span></div>
      ${!isDevis ? `<div style="display:flex; justify-content:space-between; padding:6px 0; color:var(--emerald);"><span>Payé</span><span class="mono">${formatMontant(facture.montant_paye)}</span></div>` : ''}
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

  function footerHtml(user, facture, isDevis, stampClass, qrCode, personnalisation) {
    return `
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:40px; gap:16px;">
        <div style="max-width:55%; color:var(--ink-soft); font-size:0.85rem;">
          ${facture.commentaires ? `<div>${escapeHtml(facture.commentaires)}</div>` : ''}
          ${facture.mode_paiement ? `<div style="margin-top:6px;">Mode de paiement : ${escapeHtml(facture.mode_paiement)}</div>` : ''}
          ${signatureHtml(user, 180)}
        </div>
        <div style="display:flex; align-items:flex-end; gap:14px;">
          ${qrCodeHtml(qrCode, 64)}
          <div class="stamp ${stampClass}"${secondaryColor(personnalisation, null) ? ` style="border-color:${secondaryColor(personnalisation, null)}; color:${secondaryColor(personnalisation, null)};"` : ''}>
            ${facture.statut === 'payee' ? 'Payée' : (isDevis ? 'Devis' : 'Non payée')}
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
        <div style="width:280px;">${totalsRowsHtml(facture, isDevis, 'var(--navy-950)', personnalisation)}</div>
      </div>

      ${footerHtml(user, facture, isDevis, facture.statut === 'payee' ? '' : 'stamp-clay', qrCode, personnalisation)}
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
        <div style="width:290px; background:var(--emerald-light); border-radius:10px; padding:14px 18px;">${totalsRowsHtml(facture, isDevis, 'var(--emerald)', personnalisation)}</div>
      </div>

      ${footerHtml(user, facture, isDevis, facture.statut === 'payee' ? '' : 'stamp-clay', qrCode, personnalisation)}
    `;
  }

  // --- Modèle Minimaliste : noir et blanc, épuré, sans couleurs ---
  function renderMinimaliste(user, facture, lignes, isDevis, qrCode, personnalisation) {
    const statutLabel = { payee: 'Payée', en_attente: 'En attente', en_retard: 'En retard', annulee: 'Annulée' }[facture.statut] || facture.statut;
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
          <div style="color:#555; font-size:0.78rem; margin-top:2px;">${formatDate(facture.date_emission)} — ${statutLabel}</div>
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
        <div style="width:260px;">${totalsRowsHtml(facture, isDevis, '#111', personnalisation)}</div>
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
          <div><span style="color:var(--ink-soft);">Émise le</span> ${formatDate(facture.date_emission)}</div>
          <div><span style="color:var(--ink-soft);">Échéance</span> ${formatDate(facture.date_echeance)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table>
        <thead><tr><th style="background:var(--gold); color:var(--navy-950);">Désignation</th><th style="background:var(--gold); color:var(--navy-950);">Qté</th><th style="background:var(--gold); color:var(--navy-950);">Prix U.</th><th style="background:var(--gold); color:var(--navy-950);">TVA</th><th style="background:var(--gold); color:var(--navy-950); text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div style="width:280px;">${totalsRowsHtml(facture, isDevis, 'var(--gold)', personnalisation)}</div>
      </div>

      ${footerHtml(user, facture, isDevis, facture.statut === 'payee' ? '' : 'stamp-clay', qrCode, personnalisation)}
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
          ${statutBadge(facture.statut)}
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
        <div style="width:280px; border:1px solid var(--line); border-radius:10px; padding:14px 18px;">${totalsRowsHtml(facture, isDevis, 'var(--navy-950)', personnalisation)}</div>
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
        <div style="width:290px; background:var(--navy-950); color:#fff; border-radius:14px; padding:14px 18px;">
          <div style="display:flex; justify-content:space-between; padding:5px 0;"><span style="opacity:0.75;">Sous-total</span><span class="mono">${formatMontant(facture.sous_total)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:5px 0;"><span style="opacity:0.75;">TVA</span><span class="mono">${formatMontant(facture.total_tva)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:5px 0;"><span style="opacity:0.75;">Remise</span><span class="mono">- ${formatMontant(facture.remise)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:10px 0; border-top:1px solid rgba(255,255,255,0.2); font-weight:700; font-size:1.1rem; color:var(--gold);"><span>Total</span><span class="mono">${formatMontant(facture.total)}</span></div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:36px;">
        <div style="max-width:60%; color:var(--ink-soft); font-size:0.85rem;">
          ${facture.commentaires ? `<div>💬 ${escapeHtml(facture.commentaires)}</div>` : ''}
          ${facture.mode_paiement ? `<div style="margin-top:6px;">💳 ${escapeHtml(facture.mode_paiement)}</div>` : ''}
          ${signatureHtml(user, 180)}
        </div>
        <div class="stamp" style="border-color:var(--emerald); color:var(--emerald); transform:rotate(6deg);">
          ${facture.statut === 'payee' ? 'Merci ! 🎉' : (isDevis ? 'Devis' : 'À régler')}
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
        <div style="width:290px; background:var(--navy-950); border:1px solid var(--gold); border-radius:8px; padding:14px 18px; color:#fff;">
          <div style="display:flex; justify-content:space-between; padding:5px 0; opacity:0.8;"><span>Sous-total</span><span class="mono">${formatMontant(facture.sous_total)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:5px 0; opacity:0.8;"><span>TVA</span><span class="mono">${formatMontant(facture.total_tva)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:5px 0; opacity:0.8;"><span>Remise</span><span class="mono">- ${formatMontant(facture.remise)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:10px 0; border-top:1px solid var(--gold); font-weight:700; font-size:1.15rem; color:var(--gold);"><span>Total</span><span class="mono">${formatMontant(facture.total)}</span></div>
          ${!isDevis ? `<div style="display:flex; justify-content:space-between; padding:5px 0; opacity:0.8;"><span>Payé</span><span class="mono">${formatMontant(facture.montant_paye)}</span></div>` : ''}
        </div>
      </div>

      ${footerHtml(user, facture, isDevis, facture.statut === 'payee' ? '' : 'stamp-clay', qrCode, personnalisation)}
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
          <div><span style="color:var(--ink-soft);">Émise le</span> ${formatDate(facture.date_emission)}</div>
          <div><span style="color:var(--ink-soft);">Échéance</span> ${formatDate(facture.date_echeance)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table>
        <thead><tr><th style="background:#fff; color:var(--navy-950); border-bottom:2px solid var(--gold);">Désignation</th><th style="background:#fff; color:var(--navy-950); border-bottom:2px solid var(--gold);">Qté</th><th style="background:#fff; color:var(--navy-950); border-bottom:2px solid var(--gold);">Prix U.</th><th style="background:#fff; color:var(--navy-950); border-bottom:2px solid var(--gold);">TVA</th><th style="background:#fff; color:var(--navy-950); border-bottom:2px solid var(--gold); text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div style="width:280px;">${totalsRowsHtml(facture, isDevis, 'var(--gold)', personnalisation)}</div>
      </div>

      ${footerHtml(user, facture, isDevis, facture.statut === 'payee' ? '' : 'stamp-clay', qrCode, personnalisation)}
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
        <div style="width:270px;">${totalsRowsHtml(facture, isDevis, 'var(--gold)', personnalisation)}</div>
      </div>

      ${footerHtml(user, facture, isDevis, facture.statut === 'payee' ? '' : 'stamp-clay', qrCode, personnalisation)}
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
        <div style="width:280px;">${totalsRowsHtml(facture, isDevis, '#111', personnalisation)}</div>
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
          <div class="stamp ${facture.statut === 'payee' ? '' : 'stamp-clay'}">
            ${facture.statut === 'payee' ? 'Payée' : (isDevis ? 'Devis' : 'Non payée')}
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
          <div style="display:flex; justify-content:space-between; padding:5px 0; opacity:0.8;"><span>Sous-total</span><span class="mono">${formatMontant(facture.sous_total)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:5px 0; opacity:0.8;"><span>TVA</span><span class="mono">${formatMontant(facture.total_tva)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:5px 0; opacity:0.8;"><span>Remise</span><span class="mono">- ${formatMontant(facture.remise)}</span></div>
          <div style="display:flex; justify-content:space-between; padding:10px 0; border-top:1px solid rgba(255,255,255,0.25); font-weight:700; font-size:1.15rem; color:var(--emerald);"><span>Total</span><span class="mono">${formatMontant(facture.total)}</span></div>
          ${!isDevis ? `<div style="display:flex; justify-content:space-between; padding:5px 0; opacity:0.8;"><span>Payé</span><span class="mono">${formatMontant(facture.montant_paye)}</span></div>` : ''}
        </div>
      </div>

      ${footerHtml(user, facture, isDevis, facture.statut === 'payee' ? '' : 'stamp-clay', qrCode, personnalisation)}
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
        <div style="width:280px;">${totalsRowsHtml(facture, isDevis, 'var(--emerald)', personnalisation)}</div>
      </div>

      ${footerHtml(user, facture, isDevis, facture.statut === 'payee' ? '' : 'stamp-clay', qrCode, personnalisation)}
    `;
  }

  // --- Modèle Platine : logo mis en avant, QR de vérification et signature numérique en
  // évidence — modèle "exclusif" réservé au plan Entreprise (voir plans.js ENTERPRISE_TEMPLATES) ---
  function renderPlatine(user, facture, lignes, isDevis, qrCode, personnalisation) {
    return `
      <div style="text-align:center; padding-bottom:24px; margin-bottom:28px; border-bottom:1px solid #C7CBD6;">
        ${user.entreprise_logo ? `<div style="margin-bottom:12px;">${logoHtml(user, 72, personnalisation)}</div>` : ''}
        <div style="font-family:var(--font-display); font-weight:700; font-size:1.3rem; letter-spacing:0.03em;">${escapeHtml(user.entreprise_nom || user.nom)}</div>
        <div style="color:var(--ink-soft); font-size:0.8rem; margin-top:4px;">
          ${escapeHtml(user.entreprise_adresse)} ${user.entreprise_telephone ? '· ' + escapeHtml(user.entreprise_telephone) : ''}
        </div>
        <div style="margin-top:16px; display:inline-block; padding:8px 26px; background:var(--navy-950); border-radius:999px;">
          <span style="font-family:var(--font-display); letter-spacing:0.18em; font-size:0.82rem; color:#fff;">${isDevis ? 'DEVIS' : 'FACTURE'} N° ${escapeHtml(facture.numero)}</span>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:24px;">
        <div>
          <div style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.1em; color:var(--ink-soft); margin-bottom:6px;">Facturé à</div>
          ${clientBlockHtml(facture)}
        </div>
        <div style="text-align:right;">
          <div><span style="color:var(--ink-soft);">Émise le</span> ${formatDate(facture.date_emission)}</div>
          <div><span style="color:var(--ink-soft);">Échéance</span> ${formatDate(facture.date_echeance)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table>
        <thead><tr><th>Désignation</th><th>Qté</th><th>Prix U.</th><th>TVA</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div style="width:290px; border:1px solid var(--navy-950); border-radius:10px; padding:14px 18px;">${totalsRowsHtml(facture, isDevis, 'var(--navy-950)', personnalisation)}</div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:40px; gap:16px;">
        <div style="max-width:50%; color:var(--ink-soft); font-size:0.85rem;">
          ${facture.commentaires ? `<div>${escapeHtml(facture.commentaires)}</div>` : ''}
          ${facture.mode_paiement ? `<div style="margin-top:6px;">Mode de paiement : ${escapeHtml(facture.mode_paiement)}</div>` : ''}
          ${user.signature_default ? `<div style="margin-top:10px;"><div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--ink-soft);">Signature numérique</div>${signatureHtml(user, 180)}</div>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
          ${qrCodeHtml(qrCode, 78)}
          <div class="stamp ${facture.statut === 'payee' ? '' : 'stamp-clay'}">
            ${facture.statut === 'payee' ? 'Payée' : (isDevis ? 'Devis' : 'Non payée')}
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
        <div style="width:280px; border:2px solid #C1622B; border-radius:8px; padding:14px 18px;">${totalsRowsHtml(facture, isDevis, '#8A3F16', personnalisation)}</div>
      </div>

      ${footerHtml(user, facture, isDevis, facture.statut === 'payee' ? '' : 'stamp-clay', qrCode, personnalisation)}
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
          <div>${formatDate(facture.date_emission)}</div>
          <div style="margin-top:6px;">${statutBadge(facture.statut)}</div>
        </div>
      </div>

      <table style="font-size:0.88rem;">
        <thead><tr><th style="background:var(--clay-light); color:var(--ink);">Désignation</th><th style="background:var(--clay-light); color:var(--ink);">Qté</th><th style="background:var(--clay-light); color:var(--ink);">Prix U.</th><th style="background:var(--clay-light); color:var(--ink);">TVA</th><th style="background:var(--clay-light); color:var(--ink); text-align:right;">Total</th></tr></thead>
        <tbody>${lignesRowsHtml(lignes)}</tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <div style="width:270px; border-top:2px dashed var(--clay); padding-top:10px;">${totalsRowsHtml(facture, isDevis, 'var(--clay)', personnalisation)}</div>
      </div>

      ${footerHtml(user, facture, isDevis, facture.statut === 'payee' ? '' : 'stamp-clay', qrCode, personnalisation)}
    `;
  }

  function documentMetaHtml(facture, isDevis) {
    const fields = [];
    if (facture.objet) fields.push(['Objet', escapeHtml(facture.objet)]);
    if (facture.reference_externe) fields.push(['Référence client / commande', escapeHtml(facture.reference_externe)]);
    if (isDevis && facture.date_validite) fields.push(['Devis valable jusqu’au', formatDate(facture.date_validite)]);
    if (!fields.length) return '';
    return `
      <section class="sf-doc-meta" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:10px; margin:0 0 22px; padding:13px 16px; border:1px solid #dce2e8; border-left:4px solid #0F766E; border-radius:8px; background:#f8fafc; break-inside:avoid; page-break-inside:avoid;">
        ${fields.map(([label, value]) => `
          <div style="min-width:0;">
            <div style="font-size:0.66rem; text-transform:uppercase; letter-spacing:0.06em; color:#64748b; font-weight:700; margin-bottom:4px;">${label}</div>
            <div style="font-size:0.88rem; font-weight:600; color:#172033; overflow-wrap:anywhere;">${value}</div>
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
      <div style="display:flex; justify-content:space-between; gap:14px; padding:3px 0;">
        <span>TVA ${rate}% · base ${formatMontant(Math.round(values.base * 100) / 100)}</span>
        <strong class="mono">${formatMontant(Math.round(values.tax * 100) / 100)}</strong>
      </div>
    `).join('');
    return `
      <section style="margin:14px 0 0 auto; max-width:360px; color:#475569; font-size:0.76rem; break-inside:avoid; page-break-inside:avoid;">
        <div style="font-weight:700; color:#334155; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:5px;">Détail de la TVA par taux</div>
        ${rows}
        <div style="border-top:1px solid #dce2e8; margin-top:5px; padding-top:5px; display:flex; justify-content:space-between; font-weight:700;">
          <span>Total TVA</span><span class="mono">${formatMontant(facture.total_tva)}</span>
        </div>
      </section>
    `;
  }

  function documentSupplementHtml(user, facture, isDevis) {
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
      user.entreprise_site_web ? escapeHtml(user.entreprise_site_web) : null
    ].filter(Boolean);
    const legalMentions = user.entreprise_mentions_legales
      ? escapeHtml(user.entreprise_mentions_legales).replace(/\r?\n/g, '<br/>')
      : '';
    // La zone Bon pour accord fait partie de tout devis, même sans mentions légales ou coordonnées bancaires configurées.

    return `
      <style>
        .sf-doc-extras { margin-top:22px; color:#334155; font-size:0.78rem; }
        .sf-doc-extras section { break-inside:avoid; page-break-inside:avoid; }
        .sf-doc-extras .sf-extra-panel { border:1px solid #dce2e8; border-radius:8px; padding:12px 14px; background:#fff; margin-top:10px; }
        .sf-doc-extras .sf-extra-title { font-size:0.68rem; font-weight:800; text-transform:uppercase; letter-spacing:0.07em; color:#64748b; margin-bottom:7px; }
        .sf-doc-extras .sf-sign-line { display:inline-block; border-bottom:1px solid #94a3b8; min-width:145px; height:22px; vertical-align:bottom; }
        @media print { .sf-doc-extras { color:#1e293b; } }
      </style>
      <div class="sf-doc-extras">
        ${!isDevis ? `
          <section class="sf-extra-panel" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(145px,1fr)); gap:12px; border-left:4px solid #0F766E; background:#f8fafc;">
            <div><div class="sf-extra-title">Total TTC</div><strong style="font-size:0.95rem;">${formatMontant(total)}</strong></div>
            <div><div class="sf-extra-title">Déjà réglé</div><strong style="font-size:0.95rem;">${formatMontant(paid)}</strong></div>
            <div><div class="sf-extra-title">Reste à payer</div><strong style="font-size:1.05rem; color:${remaining > 0 ? '#B45309' : '#047857'};">${formatMontant(remaining)}</strong></div>
          </section>
        ` : ''}
        ${terms ? `
          <section class="sf-extra-panel">
            <div class="sf-extra-title">${isDevis ? 'Conditions et validité de l’offre' : 'Conditions de règlement'}</div>
            <div style="line-height:1.55;">${escapeHtml(terms).replace(/\r?\n/g, '<br/>')}</div>
          </section>
        ` : ''}
        ${bankDetails.length ? `
          <section class="sf-extra-panel">
            <div class="sf-extra-title">Coordonnées de règlement</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:8px;">
              ${bankDetails.map(([label, value]) => `<div><span style="color:#64748b;">${label} :</span> <strong style="overflow-wrap:anywhere;">${value}</strong></div>`).join('')}
            </div>
          </section>
        ` : ''}
        ${isDevis ? `
          <section class="sf-extra-panel" style="margin-top:16px;">
            <div class="sf-extra-title" style="color:#0F766E;">Bon pour accord — acceptation du devis</div>
            <p style="margin:0 0 12px;">Je confirme accepter le contenu, les quantités, les prix et les conditions indiqués dans le présent devis.</p>
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:16px;">
              <div>Nom et fonction : <span class="sf-sign-line"></span></div>
              <div>Date : <span class="sf-sign-line"></span></div>
              <div>Signature et cachet : <span class="sf-sign-line"></span></div>
            </div>
          </section>
        ` : ''}
        ${legalDetails.length || legalMentions ? `
          <section style="margin-top:14px; padding-top:9px; border-top:1px solid #dce2e8; color:#64748b; font-size:0.68rem; line-height:1.5;">
            ${legalDetails.length ? `<div>${legalDetails.join(' · ')}</div>` : ''}
            ${legalMentions ? `<div style="margin-top:3px;">${legalMentions}</div>` : ''}
          </section>
        ` : ''}
      </div>
    `;
  }

  const RENDERERS = {
    classique: renderClassique, moderne: renderModerne, minimaliste: renderMinimaliste,
    elegant: renderElegant, corporate: renderCorporate, creatif: renderCreatif,
    prestige: renderPrestige, heritage: renderHeritage, diamant: renderDiamant,
    epure: renderEpure, azur: renderAzur, circuit: renderCircuit,
    platine: renderPlatine, atelier: renderAtelier, saveurs: renderSaveurs
  };

  function renderInvoiceHtml({ user, facture, lignes, isDevis, qrCode, template, personnalisation }) {
    const render = RENDERERS[template] || renderClassique;
    let html = render(user, facture, lignes, isDevis, qrCode, personnalisation);

    // Le bloc de références est partagé par les 15 modèles pour conserver les mêmes
    // informations métier dans chaque facture/devis et dans le PDF Puppeteer.
    const meta = documentMetaHtml(facture, isDevis);
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

    html += documentSupplementHtml(user, facture, isDevis);
    // Le même moteur sert à l'écran, à l'impression et au PDF serveur.
    return wrapPersonnalisation(html, personnalisation);
  }

  return { renderInvoiceHtml, RENDERERS };
}

// Export CommonJS additionnel, utilisé uniquement par les tests Node (server/tests/templates.test.js).
// Sans effet dans le navigateur : `module` n'y est pas défini, donc ce bloc ne s'exécute jamais côté client.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createFactureTemplates };
}
