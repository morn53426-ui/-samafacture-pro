(function (root) {
  'use strict';

  function normaliserTelephoneWhatsApp(telephone, paysCode) {
    const raw = String(telephone || '').trim();
    const prefixeInternational = raw.startsWith('+') || raw.startsWith('00');
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    // Seul un numéro local sénégalais de neuf chiffres peut être préfixé automatiquement.
    // Pour les autres pays, un numéro international (+... ou 00...) doit être saisi explicitement.
    if (digits.length === 9 && !prefixeInternational) {
      if (String(paysCode || '').toUpperCase() !== 'SN') return '';
      digits = '221' + digits;
    }
    return digits.length >= 8 && digits.length <= 15 ? digits : '';
  }

  function construireLienWhatsApp(documentData, options) {
    const doc = documentData || {};
    const opts = options || {};
    const id = String(doc.id || '');
    const code = String(doc.verification_code || '');
    if (!/^\d+$/.test(id)) throw new Error('Document invalide pour le partage.');
    if (!/^[a-f0-9]{10,64}$/i.test(code)) throw new Error('Lien sécurisé indisponible. Ouvrez le document puis réessayez.');

    const baseUrl = opts.baseUrl || (root.location && root.location.href) || 'https://example.com/';
    const consultationUrl = new URL('consulter.html', baseUrl);
    consultationUrl.searchParams.set('id', id);
    consultationUrl.searchParams.set('code', code);

    const typeLabel = doc.type === 'devis' ? 'devis' : 'facture';
    const client = String(doc.client_nom || '').trim();
    const entreprise = String(opts.entreprise || '').trim();
    const numero = String(doc.numero || '').trim();
    const montant = Number(doc.total || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    const devise = String(doc.devise || 'FCFA').trim();
    const introduction = entreprise
      ? entreprise + ' vous transmet votre ' + typeLabel + (numero ? ' ' + numero : '') + '.'
      : 'Veuillez trouver votre ' + typeLabel + (numero ? ' ' + numero : '') + '.';
    const message = [
      client ? 'Bonjour ' + client + ',' : 'Bonjour,',
      '',
      introduction,
      'Montant : ' + montant + ' ' + devise + '.',
      '',
      'Consulter le document et l’imprimer ou l’enregistrer en PDF :',
      consultationUrl.toString(),
      '',
      'Merci pour votre confiance.'
    ].join('\n');

    const telephone = normaliserTelephoneWhatsApp(doc.client_whatsapp || doc.client_telephone, doc.client_pays_code);
    const destination = telephone ? 'https://wa.me/' + telephone : 'https://wa.me/';
    return {
      telephone,
      consultationUrl: consultationUrl.toString(),
      message,
      whatsappUrl: destination + '?text=' + encodeURIComponent(message)
    };
  }

  async function partagerDocumentWhatsApp(documentData) {
    let popup = null;
    try {
      let doc = documentData;
      if (!doc || !doc.id) throw new Error('Document introuvable.');

      // Les documents anciens peuvent ne pas encore avoir de code de consultation.
      // Le détail le crée à la demande ; ouvrir la fenêtre pendant le clic évite son blocage.
      if (!doc.verification_code) {
        popup = root.open('about:blank', '_blank');
        const detail = await root.Api.get('/factures/' + encodeURIComponent(doc.id));
        if (!detail || !detail.facture) throw new Error('Impossible de préparer le lien sécurisé.');
        doc = Object.assign({}, detail.facture, {
          client_telephone: detail.facture.client_telephone || doc.client_telephone || '',
          client_nom: detail.facture.client_nom || doc.client_nom || ''
        });
      }

      const user = root.Api && typeof root.Api.currentUser === 'function' ? root.Api.currentUser() || {} : {};
      const share = construireLienWhatsApp(doc, {
        baseUrl: root.location.href,
        entreprise: user.entreprise_nom || user.nom || ''
      });

      if (popup && !popup.closed) {
        popup.location.href = share.whatsappUrl;
      } else {
        const opened = root.open(share.whatsappUrl, '_blank');
        if (!opened) root.location.href = share.whatsappUrl;
        else opened.opener = null;
      }
    } catch (err) {
      if (popup && !popup.closed) popup.close();
      root.alert(err.message || 'Impossible de préparer le partage WhatsApp.');
    }
  }

  const api = { normaliserTelephoneWhatsApp, construireLienWhatsApp, partagerDocumentWhatsApp };
  root.SamaWhatsApp = api;
  root.partagerDocumentWhatsApp = partagerDocumentWhatsApp;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
