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
      { id: 'professionnel', icon: 'building', label: 'Espace professionnel', href: 'professionnel.html' },
      { id: 'achats', icon: 'truck', label: 'Achats & stocks', href: 'achats.html' },
      { id: 'assistant-ia', icon: 'message-circle', label: 'Assistant IA', href: 'assistant-ia.html' },
      { id: 'automatisations', icon: 'workflow', label: 'Automatisations', href: 'automatisations.html' },
      { id: 'facture-ia', icon: 'wand', label: 'Facture par IA', href: 'facture-ia.html' }
    ]},
    { group: 'Compte', items: [
      { id: 'abonnement', icon: 'wallet-cards', label: 'Abonnement', href: 'abonnement.html' },
      { id: 'parametres', icon: 'settings', label: 'Paramètres', href: 'parametres.html' }
    ]},
    { group: 'Aide et ressources', items: [
      { id: 'aide', icon: 'help-circle', label: 'Centre d’aide', href: 'aide.html' },
      { id: 'support', icon: 'phone', label: 'Support technique', href: 'support.html' },
      { id: 'confidentialite', icon: 'lock', label: 'Confidentialité', href: 'confidentialite.html' },
      { id: 'conditions', icon: 'file-stack', label: "Conditions d'utilisation", href: 'conditions.html' }
    ]}
  ];

  if (user?.plan === 'entreprise' || localStorage.getItem('sf_company_group_member') === 'true') {
    // La gestion multi-sociétés est une destination métier : elle dispose de sa
    // propre rubrique, distincte des réglages du compte et de l'abonnement.
    const accountIndex = nav.findIndex(section => section.group === 'Compte');
    if (accountIndex >= 0) {
      nav.splice(accountIndex, 0, {
        group: 'Entreprise',
        items: [{
          id: 'groupe-entreprise',
          icon: 'building-2',
          label: 'Groupe & sociétés',
          href: 'groupe-entreprise.html'
        }]
      });
    }
  }

  const planLabels = { gratuit: 'Plan Gratuit', starter: 'Plan Starter', pro: 'Plan Pro', entreprise: 'Plan Entreprise' };
  const isEnterpriseConsole = location.pathname.endsWith('/groupe-entreprise.html');
  document.body.classList.toggle('enterprise-console-shell', isEnterpriseConsole);
  // Le centre de pilotage possède son propre rail vertical, avec libellés sous les icônes.
  // La préférence de repli générale n'est donc pas modifiée pour les autres pages.
  const sidebarCollapsed = window.matchMedia('(min-width: 901px)').matches && (
    isEnterpriseConsole || (() => {
      try { return localStorage.getItem('sf-sidebar-collapsed') !== 'false'; }
      catch { return true; }
    })()
  );
  // Évite de montrer le menu en position développée pendant son repli initial.
  // La transition reste disponible après l'initialisation pour les clics utilisateur.
  document.body.classList.add('sidebar-initializing');
  document.body.classList.toggle('sidebar-collapsed', sidebarCollapsed);

  const navHtml = nav.map(section => `
    ${section.group ? `<div class="nav-group-label" role="heading" aria-level="2">${section.group}</div>` : ''}
    ${section.items.map(item => `
      <a href="${item.href}" class="nav-item ${(activePage === item.id || (activePage === 'nouvelle-facture' && item.id === 'factures')) ? 'active' : ''}" title="${item.label}" aria-label="${item.label}" ${(activePage === item.id || (activePage === 'nouvelle-facture' && item.id === 'factures')) ? 'aria-current="page"' : ''} onclick="closeSidebar()">
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
          <div class="sub">Gestion commerciale</div>
        </div>
        <button type="button" class="sidebar-collapse-toggle" id="sidebar-collapse-toggle" onclick="toggleDesktopSidebar()" aria-controls="app-navigation" aria-label="${sidebarCollapsed ? 'Élargir le menu' : 'Réduire le menu'}" aria-expanded="${String(!sidebarCollapsed)}" title="${sidebarCollapsed ? 'Élargir le menu' : 'Réduire le menu'}">${Icon(sidebarCollapsed ? 'arrow-right' : 'arrow-left')}</button>
        <button type="button" class="mobile-toggle" id="mobile-toggle-btn" onclick="toggleSidebar()" aria-label="Ouvrir le menu" aria-controls="app-navigation" aria-expanded="false">${Icon('menu')}</button>
      </div>
      <nav class="sidebar-nav" id="app-navigation" aria-label="Navigation principale">${navHtml}</nav>
      <div class="sidebar-foot">
        <button type="button" class="install-app-btn" style="display:none;" onclick="installApp()"><span class="ic">${Icon('smartphone')}</span> Installer l'application</button>
        <div class="sidebar-user-info">
          <div class="plan-badge">${planLabels[user?.plan] || 'Plan Gratuit'}</div>
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
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.classList.remove('sidebar-initializing');
  }));
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
  const enterpriseToggle = document.querySelector('.enterprise-console-menu-toggle');
  if (enterpriseToggle) {
    enterpriseToggle.innerHTML = isOpen ? Icon('x') : Icon('menu');
    enterpriseToggle.setAttribute('aria-expanded', String(!!isOpen));
    enterpriseToggle.setAttribute('aria-label', isOpen ? 'Fermer la navigation' : 'Ouvrir la navigation');
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
  const enterpriseToggle = document.querySelector('.enterprise-console-menu-toggle');
  if (enterpriseToggle) {
    enterpriseToggle.innerHTML = Icon('menu');
    enterpriseToggle.setAttribute('aria-expanded', 'false');
    enterpriseToggle.setAttribute('aria-label', 'Ouvrir la navigation');
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
  const isLocalizationPage = location.pathname.endsWith('/internationalisation.html');
  const isEnterpriseConsole = location.pathname.endsWith('/groupe-entreprise.html');

  el.outerHTML = `
    <header class="app-topbar${isEnterpriseConsole ? ' enterprise-console-topbar' : ''}" aria-label="Barre d'outils">
      ${isEnterpriseConsole ? `
        <button type="button" class="enterprise-console-menu-toggle" onclick="toggleSidebar()" aria-label="Ouvrir la navigation" aria-controls="app-navigation" aria-expanded="false">
          ${Icon('menu')}
        </button>
        <a class="enterprise-console-brand" href="dashboard.html" aria-label="SamaFacture Pro, tableau de bord">
          <span class="enterprise-console-brand-mark"><img src="images/icon-192.png" alt="" /></span>
          <span><strong>SamaFacture <em>Pro</em></strong><small>Gestion d’entreprise</small></span>
        </a>
        <div class="enterprise-console-view">
          <span>Vue consolidée</span>
          <small>${escapeHtml(user.entreprise_nom || 'Groupe multi-sociétés')}</small>
          ${Icon('chevron-down')}
        </div>
      ` : `
        <form class="app-topbar-search" role="search" onsubmit="return submitWorkspaceSearch(event)">
          <span class="ic" aria-hidden="true">${Icon('search')}</span>
          <input id="workspace-search" type="search"
            placeholder="Rechercher un client (nom, email, téléphone)..."
            aria-label="Rechercher un client par nom, email ou téléphone" />
          <button type="submit" aria-label="Lancer la recherche">${Icon('arrow-up-right')}</button>
        </form>
      `}
      ${isEnterpriseConsole ? `
        <nav class="enterprise-console-utility-links" aria-label="Aide et paramètres">
          <a href="parametres.html" aria-label="Paramètres" title="Paramètres">${Icon('settings')}</a>
          <a href="aide.html" aria-label="Centre d’aide" title="Centre d’aide">${Icon('help-circle')}</a>
        </nav>
      ` : ''}
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
        <div class="app-topbar-quick-actions" role="group" aria-label="Accès rapides">
          ${window.SamaTheme ? SamaTheme.boutonHtml('-topbar') : ''}
          <a href="internationalisation.html" class="app-topbar-localization${isLocalizationPage ? ' is-active' : ''}"
            aria-label="Pays, langue et devise" data-tooltip="Pays, langue et devise" ${isLocalizationPage ? 'aria-current="page"' : ''}>
            <span class="ic" aria-hidden="true">${Icon('globe')}</span>
            <span class="app-topbar-localization-label">Pays, langue &amp; devise</span>
          </a>
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

function positionWorkspaceNotificationPanel() {
  const panel = document.getElementById('workspace-notification-panel');
  const toggle = document.getElementById('workspace-notification-toggle');
  if (!panel || !toggle || panel.hidden) return;

  const properties = ['position', 'top', 'left', 'right', 'width', 'max-width', 'max-height'];
  const list = panel.querySelector('.app-notification-list');
  if (window.innerWidth > 640) {
    properties.forEach(property => panel.style.removeProperty(property));
    if (list) list.style.removeProperty('max-height');
    return;
  }

  const rect = toggle.getBoundingClientRect();
  const gutter = 12;
  // innerHeight décrit le viewport de mise en page. Sur iOS Safari et certains
  // navigateurs mobiles, le clavier réduit seulement le viewport visuel.
  const visualViewport = window.visualViewport;
  const viewportLeft = Math.max(0, Number(visualViewport?.offsetLeft) || 0);
  const viewportTop = Math.max(0, Number(visualViewport?.offsetTop) || 0);
  const viewportWidth = Math.max(0, Number(visualViewport?.width) || window.innerWidth);
  const viewportHeight = Math.max(0, Number(visualViewport?.height) || window.innerHeight);
  const safeGutterX = Math.min(gutter, viewportWidth / 2);
  const safeGutterY = Math.min(gutter, viewportHeight / 2);
  const viewportRight = viewportLeft + viewportWidth;
  const viewportBottom = viewportTop + viewportHeight;
  const width = Math.max(0, Math.min(360, viewportWidth - safeGutterX * 2));
  const left = Math.max(viewportLeft + safeGutterX, Math.min(
    rect.right - width,
    viewportRight - width - safeGutterX
  ));
  const availableBelow = Math.max(0, viewportBottom - rect.bottom - safeGutterY - 8);
  const availableAbove = Math.max(0, rect.top - viewportTop - safeGutterY - 8);
  let top;
  let maxHeight;

  if (availableBelow >= 220 || availableBelow >= availableAbove) {
    top = rect.bottom + 8;
    maxHeight = Math.min(430, availableBelow);
  } else {
    maxHeight = Math.min(430, availableAbove);
    top = rect.top - maxHeight - 8;
  }

  // Ne jamais imposer une hauteur minimale qui dépasse l'espace réellement libre.
  // Le panneau peut être plus petit que 140 px lorsque le clavier mobile ou un
  // viewport court réduit la zone visible ; la liste conserve alors son scroll interne.
  maxHeight = Math.max(0, Math.min(maxHeight, viewportHeight - safeGutterY * 2));
  top = Math.max(viewportTop + safeGutterY, Math.min(
    top,
    viewportBottom - safeGutterY - maxHeight
  ));

  panel.style.position = 'fixed';
  panel.style.top = Math.round(top) + 'px';
  panel.style.left = Math.round(left) + 'px';
  panel.style.right = 'auto';
  panel.style.width = Math.round(width) + 'px';
  panel.style.maxWidth = Math.round(width) + 'px';
  panel.style.maxHeight = Math.round(maxHeight) + 'px';

  // Mesurer l'en-tête après avoir appliqué la largeur finale : son texte peut
  // passer sur plusieurs lignes sur les téléphones étroits. Réserver son espace
  // et donner tout le reste à la liste défilante pour éviter de la couper.
  const headerHeight = panel.querySelector('.app-notification-panel-head')?.getBoundingClientRect().height || 0;
  if (list) list.style.maxHeight = Math.round(Math.max(0, maxHeight - headerHeight)) + 'px';
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
    positionWorkspaceNotificationPanel();
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
  window.addEventListener('resize', positionWorkspaceNotificationPanel);
  window.addEventListener('orientationchange', positionWorkspaceNotificationPanel);
  // Le clavier virtuel et le zoom peuvent modifier le viewport visuel sans
  // déclencher de redimensionnement du viewport de mise en page.
  window.visualViewport?.addEventListener('resize', positionWorkspaceNotificationPanel);
  window.visualViewport?.addEventListener('scroll', positionWorkspaceNotificationPanel);
  document.addEventListener('click', event => {
    if (!event.target.closest('.app-notification')) closeWorkspaceNotifications();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;

    const panel = document.getElementById('workspace-notification-panel');
    if (!panel || panel.hidden) return;

    // Un dialogue actif (aperçu A4, confirmation, etc.) doit traiter Échap en priorité.
    // Ne pas déplacer le focus vers la cloche lorsque les notifications sont déjà fermées.
    const anotherDialogIsOpen = Array.from(
      document.querySelectorAll('[role="dialog"], [id$="modal"]')
    ).some(dialog =>
      dialog !== panel &&
      !dialog.hidden &&
      getComputedStyle(dialog).display !== 'none'
    );
    if (anotherDialogIsOpen) return;

    closeWorkspaceNotifications();
    const toggle = document.getElementById('workspace-notification-toggle');
    if (toggle?.isConnected) toggle.focus({ preventScroll: true });
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
    let socket = null;
    const connecterNotifications = () => {
      // La page Professionnel peut changer d'entreprise sans rechargement complet.
      // Recréer le socket force une nouvelle validation d'adhésion et un changement de salle.
      if (socket) socket.disconnect();
      const companyOwner = localStorage.getItem('sf_company_owner');
      socket = io({ auth: { token, companyOwner: companyOwner || null } });

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

    connecterNotifications();
    window.addEventListener('sf-company-changed', connecterNotifications);
  };
  script.onerror = () => { window.__samafactureSocketLoading = false; };
  document.head.appendChild(script);
}
