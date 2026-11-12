(function () {
  'use strict';

  function montantRestant(facture) {
    return Math.max(0, Number(facture.total || 0) - Number(facture.montant_paye || 0));
  }

  window.renderBillingRows = function (factures) {
    const tbody = document.getElementById('factures-body');
    const rows = Array.isArray(factures) ? factures : [];
    window.__sfBillingInvoices = rows;

    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="ic">' +
        Icon('file-text') + '</div>Aucune facture pour ce filtre.</div></td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(function (f) {
      const id = Number(f.id);
      const numero = escapeHtml(f.numero || '');
      const client = escapeHtml(f.client_nom || 'Client non renseigné');
      const restant = montantRestant(f);
      const emailArg = escapeHtml(JSON.stringify(f.client_email || ''));
      const actions = [];

      if (f.statut !== 'payee') {
        actions.push(
          '<button type="button" class="billing-icon-action is-primary" aria-label="Encaisser la facture ' + numero +
          '" title="Enregistrer un règlement" onclick="event.stopPropagation(); openPayModal(' + id + ')">' +
          Icon('hand-coins') + '</button>'
        );
      }

      actions.push(
        '<button type="button" class="billing-icon-action" aria-label="Consulter ou imprimer la facture ' + numero +
        '" title="Consulter / imprimer" onclick="event.stopPropagation(); printFacture(' + id + ')">' +
        Icon('printer') + '</button>'
      );

      actions.push(
        '<button type="button" class="billing-icon-action" aria-label="Envoyer la facture ' + numero +
        '" title="Envoyer par email" onclick=\'event.stopPropagation(); openSendModal(' + id + ', ' + emailArg + ', "envoyer")\'>' +
        Icon('mail') + '</button>'
      );

      if (f.statut === 'en_attente' || f.statut === 'en_retard') {
        actions.push(
          '<button type="button" class="billing-icon-action" aria-label="Relancer la facture ' + numero +
          '" title="Envoyer une relance" onclick=\'event.stopPropagation(); openSendModal(' + id + ', ' + emailArg + ', "relancer")\'>' +
          Icon('refresh-cw') + '</button>'
        );
      }

      actions.push(
        '<button type="button" class="billing-icon-action" aria-label="Dupliquer la facture ' + numero +
        '" title="Dupliquer" onclick="event.stopPropagation(); dupliquerFacture(' + id + ')">' +
        Icon('copy') + '</button>'
      );

      return '<tr class="billing-invoice-row row-clickable" tabindex="0" role="button" data-invoice-id="' + id +
        '" aria-label="Consulter la facture ' + numero + '" onclick="printFacture(' + id +
        ')" onkeydown="if(event.key===&quot;Enter&quot;) printFacture(' + id + ')">' +
        '<td data-label="Référence"><span class="billing-reference">' + numero + '</span></td>' +
        '<td data-label="Client"><span class="billing-client-name">' + client + '</span></td>' +
        '<td data-label="Émission">' + formatDate(f.date_emission) + '</td>' +
        '<td data-label="Échéance">' + formatDate(f.date_echeance) + '</td>' +
        '<td data-label="Montant" class="mono billing-amount">' + formatMontant(f.total) + '</td>' +
        '<td data-label="Reste dû" class="mono ' + (restant > 0 ? 'billing-balance-due' : 'billing-balance-clear') + '">' +
        formatMontant(restant) + '</td>' +
        '<td data-label="Statut">' + statutBadge(f.statut) + '</td>' +
        '<td data-label="Actions" class="billing-actions-cell" onclick="event.stopPropagation();">' +
        '<div class="billing-row-actions">' + actions.join('') + '</div></td></tr>';
    }).join('');
  };

  window.loadBillingSummary = async function () {
    const root = document.getElementById('billing-stats');
    if (!root) return;

    try {
      const stats = await Api.get('/dashboard');
      const cards = [
        {
          icon: 'banknote',
          tone: 'tone-blue',
          label: 'Chiffre d’affaires',
          value: formatMontant(stats.chiffre_affaires || 0),
          meta: 'Activité facturée'
        },
        {
          icon: 'check-circle',
          tone: 'tone-green',
          label: 'Factures payées',
          value: String(stats.factures_payees && stats.factures_payees.n != null ? stats.factures_payees.n : 0),
          meta: formatMontant(stats.factures_payees && stats.factures_payees.total || 0) + ' encaissés'
        },
        {
          icon: 'clock',
          tone: 'tone-purple',
          label: 'En attente',
          value: String(stats.factures_en_attente && stats.factures_en_attente.n != null ? stats.factures_en_attente.n : 0),
          meta: formatMontant(stats.factures_en_attente && stats.factures_en_attente.total || 0) + ' en attente de règlement'
        },
        {
          icon: 'alert-triangle',
          tone: 'tone-amber',
          label: 'En retard',
          value: String(stats.factures_en_retard && stats.factures_en_retard.n != null ? stats.factures_en_retard.n : 0),
          meta: formatMontant(stats.factures_en_retard && stats.factures_en_retard.total || 0) + ' de factures échues'
        }
      ];

      root.innerHTML = cards.map(function (card) {
        return '<article class="billing-stat-card">' +
          '<span class="billing-stat-icon ' + card.tone + '">' + Icon(card.icon) + '</span>' +
          '<span class="billing-stat-label">' + card.label + '</span>' +
          '<strong class="billing-stat-value mono">' + card.value + '</strong>' +
          '<small class="billing-stat-meta">' + card.meta + '</small></article>';
      }).join('');
    } catch (err) {
      root.querySelectorAll('.billing-stat-meta').forEach(function (item) {
        item.textContent = 'Indicateur indisponible';
      });
    }
  };
})();