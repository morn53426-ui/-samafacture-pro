function renderSidebar(activePage) {
  const user = Api.currentUser();
  const nav = [
    { group: null, items: [
      { id: 'dashboard', icon: 'home', label: 'Tableau de bord', href: 'dashboard.html' }
    ]},
    { group: 'Ventes', items: [
      { id: 'factures', icon: 'file-text', label: 'Factures', href: 'factures.html' },
      { id: 'devis', icon: 'file-stack', label: 'Devis', href: 'devis.html' },
      { id: 'clients', icon: 'users', label: 'Clients', href: 'clients.html' },
      { id: 'crm', icon: 'contact-round', label: 'CRM & suivi client', href: 'crm.html' }
    ]},
    { group: 'Catalogue', items: [
      { id: 'produits', icon: 'package', label: 'Produits & services', href: 'produits.html' }
    ]},
    { group: 'Comptabilité', items: [
      { id: 'finances', icon: 'credit-card', label: 'Paiements', href: 'finances.html' },
      { id: 'paiements-pro', icon: 'wallet-cards', label: 'Paiements en ligne', href: 'paiements-professionnels.html' },
      { id: 'comptabilite', icon: 'calculator', label: 'Comptabilité OHADA', href: 'comptabilite.html' },
      { id: 'depenses', icon: 'banknote', label: 'Dépenses', href: 'depenses.html' },
      { id: 'rapports', icon: 'bar-chart', label: 'Rapports', href: 'rapports.html' }
    ]},
    { group: 'Outils professionnels', items: [
      { id: 'factures-recurrentes', icon: 'repeat', label: 'Factures récurrentes', href: 'factures-recurrentes.html' },
      { id: 'professionnel', icon: 'briefcase-business', label: 'Espace professionnel', href: 'professionnel.html' },
      { id: 'achats', icon: 'truck', label: 'Achats & stocks', href: 'achats.html' },
      { id: 'assistant-ia', icon: 'sparkles', label: 'Assistant IA', href: 'assistant-ia.html' },
      { id: 'automatisations', icon: 'workflow', label: 'Automatisations', href: 'automatisations.html' },
      { id: 'facture-ia', icon: 'wand', label: 'Facture par IA', href: 'facture-ia.html' }
    ]},
    { group: 'Compte', items: [
      { id: 'abonnement', icon: 'gem', label: 'Abonnement', href: 'abonnement.html' },
      { id: 'parametres', icon: 'settings', label: 'Paramètres', href: 'parametres.html' },
      { id: 'internationalisation', icon: 'globe', label: 'Pays, langue & devise', href: 'internationalisation.html' }
    ]},
    { group: 'Aide et ressources', items: [
      { id: 'aide', icon: 'help-circle', label: 'Centre d’aide', href: 'aide.html' },
      { id: 'support', icon: 'phone', label: 'Support technique', href: 'support.html' },
      { id: 'confidentialite', icon: 'lock', label: 'Confidentialité', href: 'confidentialite.html' },
      { id: 'conditions', icon: 'file-stack', label: "Conditions d'utilisation", href: 'conditions.html' }
    ]}
  ];

  const planLabels = { gratuit: 'Plan Gratuit', starter: 'Plan Starter', pro: 'Plan Pro', entreprise: 'Plan Entreprise' };
  // Sur ordinateur, la navigation démarre en mode compact pour laisser la priorité
  // à la zone de travail. La préférence utilisateur est conservée entre les pages.
  const sidebarCollapsed = window.matchMedia('(min-width: 901px)').matches && (() => {
    try { return localStorage.getItem('sf-sidebar-collapsed') !== 'false'; }
    catch { return true; }
  })();
  document.body.classList.toggle('sidebar-collapsed', sidebarCollapsed);

  const navHtml = nav.map(section => `
    ${section.group ? `<div class="nav-group-label">${section.group}</div>` : ''}
    ${section.items.map(item => `
      <a href="${item.href}" class="nav-item ${(activePage === item.id || (activePage === 'nouvelle-facture' && item.id === 'factures')) ? 'active' : ''}" title="${item.label}" aria-label="${item.label}" onclick="closeSidebar()">
        <span class="ic" aria-hidden="true">${Icon(item.icon)}</span><span class="nav-label">${item.label}</span>
      </a>
    `).join('')}
  `).join('');

  const html = `
    <aside class="sidebar${sidebarCollapsed ? ' is-collapsed' : ''}" id="app-sidebar">
      <div class="sidebar-brand">
        <div class="mark"><img src="images/icon-192.png" alt="SamaFacture Pro" /></div>
        <div class="sidebar-brand-copy">
          <div class="name">SamaFacture <span class="brand-pro">Pro</span></div>
          <div class="sub">Facturez • Gérez • Développez</div>
        </div>
        <button type="button" class="sidebar-collapse-toggle" id="sidebar-collapse-toggle" onclick="toggleDesktopSidebar()" aria-label="${sidebarCollapsed ? 'Élargir le menu' : 'Réduire le menu'}" aria-expanded="${String(!sidebarCollapsed)}" title="${sidebarCollapsed ? 'Élargir le menu' : 'Réduire le menu'}">${Icon(sidebarCollapsed ? 'arrow-right' : 'arrow-left')}</button>
        <button type="button" class="mobile-toggle" id="mobile-toggle-btn" onclick="toggleSidebar()" aria-label="Ouvrir le menu" aria-controls="app-navigation" aria-expanded="false">${Icon('menu')}</button>
      </div>
      <nav class="sidebar-nav" id="app-navigation" aria-label="Navigation principale">${navHtml}</nav>
      <div class="sidebar-foot">
        <button type="button" class="install-app-btn" style="display:none;" onclick="installApp()"><span class="ic">${Icon('smartphone')}</span> Installer l'application</button>
        <div class="sidebar-theme-control">${window.SamaTheme ? SamaTheme.boutonHtml() : ''}</div>
        <div class="sidebar-user-info">
          <div class="plan-badge"><span class="ic">${Icon('star')}</span> ${planLabels[user?.plan] || 'Plan Gratuit'}</div>
          <div class="sidebar-user-name">${escapeHtml(user?.entreprise_nom || user?.nom || 'Mon compte')}</div>
        </div>
        <button type="button" class="sidebar-logout" onclick="Api.clearSession(); location.href='login.html';" aria-label="Se déconnecter" title="Se déconnecter"><span class="ic" aria-hidden="true">${Icon('log-out')}</span><span class="sidebar-logout-label">Se déconnecter</span></button>
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
function toggleDesktopSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const button = document.getElementById('sidebar-collapse-toggle');
  if (!sidebar || window.matchMedia('(max-width: 900px)').matches) return;

  const isCollapsed = sidebar.classList.toggle('is-collapsed');
  document.body.classList.toggle('sidebar-collapsed', isCollapsed);
  try { localStorage.setItem('sf-sidebar-collapsed', String(isCollapsed)); } catch { /* préférence facultative */ }

  if (button) {
    button.innerHTML = Icon(isCollapsed ? 'arrow-right' : 'arrow-left');
    button.setAttribute('aria-expanded', String(!isCollapsed));
    button.setAttribute('aria-label', isCollapsed ? 'Élargir le menu' : 'Réduire le menu');
    button.title = isCollapsed ? 'Élargir le menu' : 'Réduire le menu';
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
        <div class="app-notification">
          <button type="button" class="app-notification-toggle" id="workspace-notification-toggle"
            onclick="toggleWorkspaceNotifications(event)" aria-label="Notifications" aria-controls="workspace-notification-panel"
            aria-expanded="false" title="Notifications">
            <span class="ic" aria-hidden="true">${Icon('bell')}</span>
            <span class="app-notification-badge" id="workspace-notification-badge" hidden></span>
          </button>
          <section class="app-notification-panel" id="workspace-notification-panel"
            aria-label="Centre de notifications" hidden>
            <header class="app-notification-panel-head">
              <div><strong>Notifications</strong><small id="workspace-notification-summary">Aucune nouvelle notification</small></div>
              <button type="button" class="app-notification-clear" onclick="clearWorkspaceNotifications()">Effacer</button>
            </header>
            <div class="app-notification-list" id="workspace-notification-list" aria-live="polite">
              <div class="app-notification-empty">Aucune notification reçue pendant cette session.</div>
            </div>
          </section>
        </div>
        <button type="button" class="app-topbar-logout"
          onclick="Api.clearSession(); location.href='login.html';"
          aria-label="Se déconnecter" title="Se déconnecter">
          ${Icon('log-out')} <span>Déconnexion</span>
        </button>
      </div>
    </header>
  `;
  renderWorkspaceNotifications();
  bindWorkspaceNotificationDismiss();
}

let workspaceNotifications = [];
let workspaceNotificationSequence = 0;

function pushWorkspaceNotification(title, message, tone) {
  workspaceNotificationSequence += 1;
  workspaceNotifications.unshift({
    id: workspaceNotificationSequence,
    title: String(title || 'Notification'),
    message: String(message || ''),
    tone: ['success', 'warning', 'error'].includes(tone) ? tone : 'info',
    createdAt: new Date(),
    read: false
  });
  workspaceNotifications = workspaceNotifications.slice(0, 20);
  renderWorkspaceNotifications();
}

function renderWorkspaceNotifications() {
  const badge = document.getElementById('workspace-notification-badge');
  const list = document.getElementById('workspace-notification-list');
  const summary = document.getElementById('workspace-notification-summary');
  const clearButton = document.querySelector('.app-notification-clear');
  const toggle = document.getElementById('workspace-notification-toggle');
  if (!badge || !list || !summary || !toggle) return;

  const unread = workspaceNotifications.filter(item => !item.read).length;
  badge.hidden = unread === 0;
  badge.textContent = unread > 99 ? '99+' : String(unread);
  toggle.setAttribute('aria-label', unread
    ? 'Notifications, ' + unread + ' non lue' + (unread > 1 ? 's' : '')
    : 'Notifications');
  toggle.title = unread ? unread + ' notification' + (unread > 1 ? 's' : '') + ' non lue' + (unread > 1 ? 's' : '') : 'Notifications';
  summary.textContent = unread ? unread + ' non lue' + (unread > 1 ? 's' : '') : workspaceNotifications.length + ' notification' + (workspaceNotifications.length > 1 ? 's' : '');

  if (clearButton) clearButton.disabled = workspaceNotifications.length === 0;
  list.innerHTML = workspaceNotifications.length ? workspaceNotifications.map(item => `
    <article class="app-notification-item ${item.read ? '' : 'is-unread'} tone-${escapeHtml(item.tone)}">
      <span class="app-notification-item-dot" aria-hidden="true"></span>
      <div class="app-notification-item-content">
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.message)}</p>
        <time datetime="${item.createdAt.toISOString()}">${item.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</time>
      </div>
    </article>
  `).join('') : '<div class="app-notification-empty">Aucune notification reçue pendant cette session.</div>';
}

function toggleWorkspaceNotifications(event) {
  event?.stopPropagation();
  const panel = document.getElementById('workspace-notification-panel');
  const toggle = document.getElementById('workspace-notification-toggle');
  if (!panel || !toggle) return;
  const shouldOpen = panel.hidden;
  panel.hidden = !shouldOpen;
  toggle.setAttribute('aria-expanded', String(shouldOpen));
  if (shouldOpen) {
    workspaceNotifications.forEach(item => { item.read = true; });
    renderWorkspaceNotifications();
  }
}

function closeWorkspaceNotifications() {
  const panel = document.getElementById('workspace-notification-panel');
  const toggle = document.getElementById('workspace-notification-toggle');
  if (panel && !panel.hidden) panel.hidden = true;
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function clearWorkspaceNotifications() {
  workspaceNotifications = [];
  renderWorkspaceNotifications();
}

function bindWorkspaceNotificationDismiss() {
  if (window.__sfNotificationDismissBound) return;
  window.__sfNotificationDismissBound = true;
  document.addEventListener('click', event => {
    if (!event.target.closest('.app-notification')) closeWorkspaceNotifications();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeWorkspaceNotifications();
      document.getElementById('workspace-notification-toggle')?.focus();
    }
  });
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
      const numero = data.facture?.numero || '';
      pushWorkspaceNotification('Paiement reçu', numero ? 'La facture ' + numero + ' a été marquée payée.' : 'Une facture a été marquée payée.', 'success');
      showToast(`Facture ${numero} marquée payée ✓`, 'success');
    });
    socket.on('nouveau_client', (data) => {
      const nom = data.client?.nom || 'Nouveau client';
      pushWorkspaceNotification('Nouveau client', nom + ' a été ajouté à votre portefeuille clients.', 'info');
      showToast(`Nouveau client ajouté : ${nom}`, 'success');
    });
    socket.on('alerte_quota', (data) => {
      const message = data.message || 'Une limite de votre abonnement approche.';
      pushWorkspaceNotification('Alerte de quota', message, 'warning');
      showToast(message, 'error');
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
