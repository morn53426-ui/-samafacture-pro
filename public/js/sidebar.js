function renderSidebar(activePage) {
  const user = Api.currentUser();
  const nav = [
    { group: null, items: [
      { id: 'dashboard', icon: 'home', label: 'Tableau de bord', href: 'dashboard.html' }
    ]},
    { group: 'Ventes', items: [
      { id: 'clients', icon: 'users', label: 'Clients', href: 'clients.html' },
      { id: 'factures', icon: 'file-text', label: 'Factures', href: 'factures.html' },
      { id: 'devis', icon: 'file-stack', label: 'Devis', href: 'devis.html' },
      { id: 'nouvelle-facture', icon: 'plus', label: 'Nouvelle facture', href: 'nouvelle-facture.html' },
      { id: 'factures-recurrentes', icon: 'repeat', label: 'Factures récurrentes', href: 'factures-recurrentes.html' }
    ]},
    { group: 'Catalogue', items: [
      { id: 'produits', icon: 'package', label: 'Produits', href: 'produits.html' }
    ]},
    { group: 'Comptabilité', items: [
      { id: 'depenses', icon: 'banknote', label: 'Dépenses', href: 'depenses.html' },
      { id: 'rapports', icon: 'bar-chart', label: 'Rapports', href: 'rapports.html' },
      { id: 'finances', icon: 'landmark', label: 'Finances', href: 'finances.html' }
    ]},
    { group: 'Intelligence artificielle', items: [
      { id: 'assistant-ia', icon: 'sparkles', label: 'Assistant IA', href: 'assistant-ia.html' },
      { id: 'facture-ia', icon: 'wand', label: 'Facture par IA', href: 'facture-ia.html' }
    ]},
    { group: 'Compte', items: [
      { id: 'abonnement', icon: 'gem', label: 'Abonnement', href: 'abonnement.html' },
      { id: 'parametres', icon: 'settings', label: 'Paramètres', href: 'parametres.html' }
    ]},
    { group: 'Ressources', items: [
      { id: 'aide', icon: 'help-circle', label: 'Centre d\'aide', href: 'aide.html' },
      { id: 'support', icon: 'phone', label: 'Support technique', href: 'support.html' },
      { id: 'confidentialite', icon: 'lock', label: 'Confidentialité', href: 'confidentialite.html' },
      { id: 'conditions', icon: 'file-stack', label: "Conditions d'utilisation", href: 'conditions.html' }
    ]}
  ];

  const planLabels = { gratuit: 'Plan Gratuit', starter: 'Plan Starter', pro: 'Plan Pro', entreprise: 'Plan Entreprise' };

  const navHtml = nav.map(section => `
    ${section.group ? `<div class="nav-group-label">${section.group}</div>` : ''}
    ${section.items.map(item => `
      <a href="${item.href}" class="nav-item ${activePage === item.id ? 'active' : ''}">
        <span class="ic">${Icon(item.icon)}</span><span>${item.label}</span>
      </a>
    `).join('')}
  `).join('');

  const html = `
    <aside class="sidebar" id="app-sidebar">
      <div class="sidebar-brand">
        <div class="mark"><img src="images/icon-192.png" alt="SamaFacture Pro" /></div>
        <div>
          <div class="name">SamaFacture</div>
          <div class="sub">Pro</div>
        </div>
        <button type="button" class="mobile-toggle" id="mobile-toggle-btn" onclick="toggleSidebar()" aria-label="Ouvrir le menu">${Icon('menu')}</button>
      </div>
      <nav class="sidebar-nav">${navHtml}</nav>
      <div class="sidebar-foot">
        <button type="button" class="install-app-btn" style="display:none;" onclick="installApp()"><span class="ic">${Icon('smartphone')}</span> Installer l'application</button>
        ${window.SamaTheme ? SamaTheme.boutonHtml() : ''}
        <div class="plan-badge"><span class="ic">${Icon('star')}</span> ${planLabels[user?.plan] || 'Plan Gratuit'}</div>
        <div>${escapeHtml(user?.entreprise_nom || user?.nom)}</div>
        <div style="margin-top:10px; cursor:pointer; color:#B7C0DA; display:flex; align-items:center; gap:6px;" onclick="Api.clearSession(); location.href='login.html';"><span class="ic">${Icon('arrow-right')}</span> Se déconnecter</div>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>
  `;
  document.getElementById('sidebar-root').outerHTML = html;
  initRealtime();
}

function toggleSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const btn = document.getElementById('mobile-toggle-btn');
  const isOpen = sidebar?.classList.toggle('open');
  overlay?.classList.toggle('show', !!isOpen);
  if (btn) btn.innerHTML = isOpen ? Icon('x') : Icon('menu');
}
function closeSidebar() {
  document.getElementById('app-sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('show');
  const btn = document.getElementById('mobile-toggle-btn');
  if (btn) btn.innerHTML = Icon('menu');
}

function renderTopbar(title, subtitle) {
  const el = document.getElementById('topbar-root');
  if (!el) return;
  el.outerHTML = `
    <div class="topbar">
      <div>
        <h1 style="margin:0;">${title}</h1>
        ${subtitle ? `<p style="color:var(--ink-soft); margin:2px 0 0;">${subtitle}</p>` : ''}
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// Notifications en temps réel — connecté au serveur Socket.io (voir server/realtime.js).
// Appelée depuis renderSidebar() ci-dessus (présente sur toutes les pages authentifiées),
// donc pas besoin d'ajouter une balise <script> séparée sur chaque page.
//
// Limite connue : si c'est CE navigateur qui vient de déclencher l'action (ex: vous
// venez vous-même d'enregistrer un paiement), la page affiche déjà sa propre confirmation
// ET ce toast temps réel peut s'ajouter en double. Pas gênant en soi, mais si besoin de
// le supprimer plus tard, il faudrait exclure le socket d'origine côté serveur — non fait
// dans cette première version.
// -----------------------------------------------------------------------------
function initRealtime() {
  const token = Api.token();
  if (!token || window.__samafactureSocketLoading) return;
  window.__samafactureSocketLoading = true;

  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.8.1/socket.io.min.js';
  script.onload = () => {
    if (typeof io === 'undefined') return;
    const socket = io({ auth: { token } });

    socket.on('facture_payee', (data) => {
      showToast(`Facture ${data.facture?.numero || ''} marquée payée ✓`, 'success');
    });
    socket.on('nouveau_client', (data) => {
      showToast(`Nouveau client ajouté : ${data.client?.nom || ''}`, 'success');
    });
    socket.on('alerte_quota', (data) => {
      showToast(data.message, 'error');
    });
    socket.on('connect_error', (err) => {
      // Ne bloque jamais l'utilisation de l'application si les notifications temps réel
      // sont indisponibles (réseau restrictif, serveur sans WebSocket...) — dégradation
      // silencieuse, l'app continue de fonctionner normalement sans elles.
      console.warn('Notifications temps réel indisponibles :', err.message);
    });
  };
  script.onerror = () => { window.__samafactureSocketLoading = false; };
  document.head.appendChild(script);
}
