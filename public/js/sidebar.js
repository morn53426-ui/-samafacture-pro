function renderSidebar(activePage) {
  const user = Api.currentUser();
  const nav = [
    { group: null, items: [
      { id: 'dashboard', icon: 'home', label: 'Tableau de bord', href: 'dashboard.html' }
    ]},
    { group: 'Ventes', items: [
      { id: 'factures', icon: 'file-text', label: 'Factures', href: 'factures.html' },
      { id: 'devis', icon: 'file-stack', label: 'Devis', href: 'devis.html' },
      { id: 'clients', icon: 'users', label: 'Clients', href: 'clients.html' }
    ]},
    { group: 'Catalogue', items: [
      { id: 'produits', icon: 'package', label: 'Produits & services', href: 'produits.html' }
    ]},
    { group: 'Comptabilité', items: [
      { id: 'finances', icon: 'credit-card', label: 'Paiements', href: 'finances.html' },
      { id: 'depenses', icon: 'banknote', label: 'Dépenses', href: 'depenses.html' },
      { id: 'rapports', icon: 'bar-chart', label: 'Rapports', href: 'rapports.html' }
    ]},
    { group: 'Outils professionnels', items: [
      { id: 'factures-recurrentes', icon: 'repeat', label: 'Factures récurrentes', href: 'factures-recurrentes.html' },
      { id: 'professionnel', icon: 'briefcase-business', label: 'Espace professionnel', href: 'professionnel.html' },
      { id: 'assistant-ia', icon: 'sparkles', label: 'Assistant IA', href: 'assistant-ia.html' },
      { id: 'facture-ia', icon: 'wand', label: 'Facture par IA', href: 'facture-ia.html' }
    ]},
    { group: 'Compte', items: [
      { id: 'abonnement', icon: 'gem', label: 'Abonnement', href: 'abonnement.html' },
      { id: 'parametres', icon: 'settings', label: 'Paramètres', href: 'parametres.html' }
    ]},
    { group: 'Aide et ressources', items: [
      { id: 'aide', icon: 'help-circle', label: 'Centre d’aide', href: 'aide.html' },
      { id: 'support', icon: 'phone', label: 'Support technique', href: 'support.html' },
      { id: 'confidentialite', icon: 'lock', label: 'Confidentialité', href: 'confidentialite.html' },
      { id: 'conditions', icon: 'file-stack', label: "Conditions d'utilisation", href: 'conditions.html' }
    ]}
  ];

  const planLabels = { gratuit: 'Plan Gratuit', starter: 'Plan Starter', pro: 'Plan Pro', entreprise: 'Plan Entreprise' };

  const navHtml = nav.map(section => `
    ${section.group ? `<div class="nav-group-label">${section.group}</div>` : ''}
    ${section.items.map(item => `
      <a href="${item.href}" class="nav-item ${(activePage === item.id || (activePage === 'nouvelle-facture' && item.id === 'factures')) ? 'active' : ''}" onclick="closeSidebar()">
        <span class="ic">${Icon(item.icon)}</span><span>${item.label}</span>
      </a>
    `).join('')}
  `).join('');

  const html = `
    <aside class="sidebar" id="app-sidebar">
      <div class="sidebar-brand">
        <div class="mark"><img src="images/icon-192.png" alt="SamaFacture Pro" /></div>
        <div>
          <div class="name">SamaFacture <span class="brand-pro">Pro</span></div>
          <div class="sub">Facturez • Gérez • Développez</div>
        </div>
        <button type="button" class="mobile-toggle" id="mobile-toggle-btn" onclick="toggleSidebar()" aria-label="Ouvrir le menu" aria-controls="app-navigation" aria-expanded="false">${Icon('menu')}</button>
      </div>
      <nav class="sidebar-nav" id="app-navigation" aria-label="Navigation principale">${navHtml}</nav>
      <section class="sidebar-promo" aria-label="Présentation de SamaFacture Pro">
        <div class="promo-icon" aria-hidden="true">✦</div>
        <strong>SamaFacture Pro</strong>
        <p>Votre espace pour gérer clients, produits, factures et suivi commercial.</p>
        <a href="aide.html">Découvrir l'aide ${Icon('arrow-up-right')}</a>
      </section>
      <div class="sidebar-foot">
        <button type="button" class="install-app-btn" style="display:none;" onclick="installApp()"><span class="ic">${Icon('smartphone')}</span> Installer l'application</button>
        ${window.SamaTheme ? SamaTheme.boutonHtml() : ''}
        <div class="plan-badge"><span class="ic">${Icon('star')}</span> ${planLabels[user?.plan] || 'Plan Gratuit'}</div>
        <div>${escapeHtml(user?.entreprise_nom || user?.nom)}</div>
        <div style="margin-top:10px; cursor:pointer; color:#B7C0DA; display:flex; align-items:center; gap:6px;" onclick="Api.clearSession(); location.href='login.html';"><span class="ic">${Icon('log-out')}</span> Se déconnecter</div>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>
  `;
  document.getElementById('sidebar-root').outerHTML = html;
  ensureWorkspaceTopbar();
  initRealtime();
}

function toggleSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const btn = document.getElementById('mobile-toggle-btn');
  const isOpen = sidebar?.classList.toggle('open');
  overlay?.classList.toggle('show', !!isOpen);
  if (btn) {
    btn.innerHTML = isOpen ? Icon('x') : Icon('menu');
    btn.setAttribute('aria-expanded', String(!!isOpen));
    btn.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
  }
}
function closeSidebar() {
  document.getElementById('app-sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('show');
  const btn = document.getElementById('mobile-toggle-btn');
  if (btn) {
    btn.innerHTML = Icon('menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Ouvrir le menu');
  }
}

function ensureWorkspaceTopbar() {
  const main = document.querySelector('.main-content');
  if (!main || document.getElementById('topbar-root')) return;
  const root = document.createElement('div');
  root.id = 'topbar-root';
  main.insertBefore(root, main.firstChild);
  renderTopbar();
}

function renderTopbar(title, subtitle) {
  const el = document.getElementById('topbar-root');
  if (!el) return;
  const user = Api.currentUser() || {};
  const displayName = user.nom || user.email || user.entreprise_nom || 'Mon compte';
  const roleLabel = user.role === 'admin' || user.role === 'owner'
    ? 'Administrateur'
    : 'Espace de travail';
  const avatar = typeof initials === 'function' ? initials(displayName) : 'SF';

  el.outerHTML = `
    <header class="app-topbar" aria-label="Barre d'outils">
      <form class="app-topbar-search" role="search" onsubmit="return submitWorkspaceSearch(event)">
        <span class="ic" aria-hidden="true">${Icon('search')}</span>
        <input id="workspace-search" type="search"
          placeholder="Rechercher un client (nom, email, téléphone)..."
          aria-label="Rechercher un client par nom, email ou téléphone" />
        <button type="submit" aria-label="Lancer la recherche">${Icon('arrow-up-right')}</button>
      </form>
      <div class="app-topbar-account">
        <div class="app-topbar-avatar" aria-hidden="true">${escapeHtml(avatar)}</div>
        <div>
          <strong>${escapeHtml(displayName)}</strong>
          <small>${escapeHtml(roleLabel)}</small>
        </div>
        <button type="button" class="app-topbar-logout"
          onclick="Api.clearSession(); location.href='login.html';"
          aria-label="Se déconnecter" title="Se déconnecter">
          ${Icon('log-out')} <span>Déconnexion</span>
        </button>
      </div>
    </header>
  `;
}

function submitWorkspaceSearch(event) {
  event?.preventDefault();
  const input = document.getElementById('workspace-search');
  const query = input?.value?.trim() || '';
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  location.href = 'clients.html' + (params.toString() ? '?' + params.toString() : '');
  return false;
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
