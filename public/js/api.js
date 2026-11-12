// URL de base de l'API.
//
// Sur le web (navigateur classique, PWA) : chemin relatif '/api', l'app et l'API étant
// servies par le même serveur Express (voir server/app.js).
//
// Dans l'app native (Capacitor, iOS/Android) : le contenu web est chargé depuis un
// pseudo-domaine local (capacitor://localhost sur iOS, https://localhost sur Android),
// pas depuis votre vrai serveur — un chemin relatif '/api' irait donc nulle part. C'est
// pourquoi window.SAMAFACTURE_API_URL peut être défini AVANT le chargement de ce fichier
// (voir capacitor.config.json → injecté par index native, ou une balise <script> dédiée)
// pour forcer l'URL complète de votre serveur en production, ex. 'https://votredomaine.com/api'.
const API_BASE = window.SAMAFACTURE_API_URL || (() => {
  // En local, l'application peut être ouverte par erreur via Live Server (5500/5501...)
  // alors que l'API Express écoute sur 4000. Dans ce cas, '/api' pointe vers le mauvais
  // serveur et les boutons de sauvegarde semblent « ne rien faire ». On redirige donc
  // automatiquement les appels API vers Express pour localhost/127.0.0.1 lorsque la page
  // n'est pas elle-même servie par le port API 4000. SAMAFACTURE_API_URL reste prioritaire
  // pour Capacitor, un autre port local ou un déploiement avec API séparée.
  const host = window.location.hostname;
  const port = window.location.port;
  const localHost = host === 'localhost' || host === '127.0.0.1';
  if (localHost && port && port !== '4000') return `http://${host}:4000/api`;
  return '/api';
})();

// Vrai en développement local uniquement (voir AUDIT_QUALITE.md §2.1) : sert à choisir entre un
// message d'erreur technique (utile pendant le développement) et un message neutre adapté à un
// vrai utilisateur, quand le serveur ne répond pas.
function estEnLocal() {
  return ['localhost', '127.0.0.1'].includes(location.hostname);
}

const Api = {
  token() {
    return localStorage.getItem('sf_token');
  },
  setSession(token, user) {
    localStorage.setItem('sf_token', token);
    localStorage.setItem('sf_user', JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem('sf_token');
    localStorage.removeItem('sf_user');
    localStorage.removeItem('sf_company_owner');
    // Efface aussi le cookie de session HttpOnly posé en parallèle depuis la connexion (voir
    // SECURITY_REPORT.md et server/routes/auth.js, /auth/logout). Best-effort et non bloquant :
    // clearSession() reste synchrone comme avant (tous les appels existants, ex. sidebar.js,
    // continuent de fonctionner sans modification) — un échec réseau ici ne doit jamais empêcher
    // la déconnexion locale immédiate, qui reste ce qui protège réellement l'utilisateur.
    fetch(API_BASE + '/auth/logout', { method: 'POST' }).catch(() => {});
  },
  currentUser() {
    const raw = localStorage.getItem('sf_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      // Une session locale corrompue ne doit jamais casser l'initialisation de la page.
      this.clearSession();
      return null;
    }
  },
  async request(path, { method = 'GET', body } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      // Signale au serveur que cette requête vient bien du JavaScript de l'application (un
      // <form>/<img> forgé depuis un autre site ne peut pas ajouter d'en-tête personnalisé) —
      // seconde protection CSRF pour la migration progressive vers un cookie de session, voir
      // server/middleware/auth.js. Sans effet sur le comportement actuel (l'en-tête Authorization
      // ci-dessous reste la source d'authentification utilisée dans tous les cas aujourd'hui).
      'X-Requested-With': 'SamaFacturePro'
    };
    const token = this.token();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const companyOwner = localStorage.getItem('sf_company_owner');
    if (companyOwner) headers['X-SF-Company-Owner'] = companyOwner;

    let res;
    try {
      res = await fetch(API_BASE + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (networkErr) {
      // Le serveur n'est pas joignable. Message différent selon le contexte (voir
      // AUDIT_QUALITE.md §2.1) : en développement local, les indications techniques
      // (npm start, port...) aident réellement ; envoyées telles quelles à un vrai client en
      // production après une coupure réseau, elles ne veulent rien dire pour lui.
      throw new Error(estEnLocal()
        ? "Impossible de contacter le serveur SamaFacture. Vérifiez que le serveur Node est démarré (npm start) " +
          "et que vous accédez au site via http://localhost:4000 (et non via Live Server ou un autre port)."
        : "Impossible de contacter le serveur. Vérifiez votre connexion internet et réessayez dans un instant.");
    }

    const contentType = res.headers.get('content-type') || '';
    let data = {};
    if (contentType.includes('application/json')) {
      try { data = await res.json(); } catch (e) { /* corps vide ou invalide */ }
    } else {
      // La réponse n'est pas du JSON : en local, c'est presque toujours le signe qu'on n'est pas
      // sur le bon serveur/port (ex: Live Server sur le port 5500 au lieu du serveur Node sur le
      // port 4000, qui renvoie une page HTML d'erreur au lieu d'une réponse de l'API).
      if (!res.ok) {
        throw new Error(estEnLocal()
          ? `Le serveur a répondu ${res.status} (${res.statusText}) sans données JSON pour ${API_BASE + path}. ` +
            "Assurez-vous d'ouvrir l'application via http://localhost:4000 (démarré avec 'npm start' dans le dossier server/), " +
            "et non via Live Server ou un autre serveur statique."
          : "Une erreur inattendue est survenue en contactant le serveur. Veuillez réessayer, ou contacter le support si le problème persiste.");
      }
    }

    if (res.status === 401) {
      this.clearSession();
      if (!location.pathname.endsWith('login.html')) {
        location.href = 'login.html';
      }
    }
    if (!res.ok) {
      throw new Error(data.error || `Erreur ${res.status} : une erreur est survenue.`);
    }
    return data;
  },
  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, { method: 'POST', body }); },
  put(path, body) { return this.request(path, { method: 'PUT', body }); },
  del(path) { return this.request(path, { method: 'DELETE' }); }
};

function requireAuthPage() {
  if (!Api.token()) {
    location.href = 'login.html';
  }
}

function formatMontant(n, devise) {
  const user = Api.currentUser() || {};
  const currency = devise || user.devise || 'FCFA';
  const locale = user.locale || (user.langue === 'en' ? 'en' : 'fr-FR');
  const val = Number(n || 0).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return currency === 'FCFA' || currency === 'XOF' ? `${val} ${currency}` : `${val} ${currency}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const user = Api.currentUser() || {};
  const locale = user.locale || 'fr-FR';
  const timeZone = user.fuseau_horaire || 'UTC';
  const format = user.format_date || 'dd/MM/yyyy';
  const source = String(iso);
  let date;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(source);
  if (dateOnly) {
    const [year, month, day] = source.split('-').map(Number);
    // Noon UTC preserves the intended calendar date across all supported timezones.
    date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  } else {
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(source) ? source.replace(' ', 'T') : source;
    date = new Date(normalized);
  }
  if (Number.isNaN(date.getTime())) return iso;
  if (format === 'yyyy-MM-dd') {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(date);
  }
  if (format === 'MM/dd/yyyy') {
    return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone }).format(date);
  }
  // The selected date pattern takes precedence over the language of the interface.
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone }).format(date);
}
function statutBadge(statut) {
  const map = {
    payee: ['badge-payee', 'Payée'],
    en_attente: ['badge-attente', 'En attente'],
    en_retard: ['badge-retard', 'En retard'],
    annulee: ['badge-annulee', 'Annulée']
  };
  const [cls, label] = map[statut] || ['badge-attente', statut];
  return `<span class="badge ${cls}">${label}</span>`;
}

function initials(nom) {
  if (!nom) return '?';
  return nom.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

// Échappe le texte avant insertion dans du innerHTML, pour empêcher qu'un nom de client,
// une note, ou tout autre champ saisi par l'utilisateur ne soit interprété comme du HTML/JS
// (protection contre les failles XSS). À utiliser pour TOUTE donnée venant de l'API/du serveur
// insérée via innerHTML (sauf le HTML volontairement généré par l'application elle-même).
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Affiche un bandeau d'erreur visible en haut de la page (au lieu d'un échec silencieux
// visible seulement dans la console développeur).
function showFatalError(message) {
  const main = document.querySelector('.main-content') || document.body;
  const box = document.createElement('div');
  box.className = 'error-box';
  box.style.marginBottom = '18px';
  box.setAttribute('role', 'alert'); // annoncé automatiquement par les lecteurs d'écran
  box.textContent = message;
  main.prepend(box);
}

// Conteneur partagé par toutes les notifications de la page — leur permet de s'empiler
// proprement (auparavant, deux notifications rapprochées se superposaient exactement au
// même endroit, faute d'un tel conteneur).
let _toastContainer = null;
function _getToastContainer() {
  if (!_toastContainer || !document.body.contains(_toastContainer)) {
    _toastContainer = document.createElement('div');
    _toastContainer.className = 'toast-container';
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

/**
 * Affiche une notification temporaire (disparaît après 4s). type: 'success' (défaut),
 * 'error' ou 'info'. À la différence de showFatalError (bandeau persistant intégré à la
 * page), un toast flotte au-dessus du contenu et disparaît de lui-même — pour une
 * confirmation qui n'exige pas d'action de l'utilisateur.
 */
function showToast(message, type = 'success') {
  const container = _getToastContainer();
  const box = document.createElement('div');
  box.className = `toast toast-${type}`;
  box.setAttribute('role', type === 'error' ? 'alert' : 'status');
  box.textContent = message;
  container.appendChild(box);

  // La transition CSS peut être interrompue ou retargetée si plusieurs notifications
  // apparaissent rapidement ; contrairement à animationend, elle ne redémarre pas du début.
  const reveal = () => {
    if (box.isConnected) box.classList.add('is-visible');
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(reveal);
  else setTimeout(reveal, 0);

  setTimeout(() => {
    if (!box.isConnected) return;
    box.classList.add('toast-leaving');
    // Nettoyage indépendant de transitionend : fonctionne aussi en onglet inactif
    // et avec prefers-reduced-motion.
    setTimeout(() => box.remove(), 220);
  }, 4000);
}

// Petite notification de succès, discrète et temporaire — pour confirmer une action
// réussie sans la confondre avec un message d'erreur. Conservée telle quelle (plutôt que
// remplacée partout par showToast) pour ne pas avoir à modifier chaque page qui l'appelle
// déjà.
function showSuccessNotice(message) {
  showToast(message, 'success');
}

// ---------- Accessibilité des modales (id se terminant par "modal") ----------
// Fonctionne automatiquement sur toutes les pages, sans rien à modifier dans leur code :
// on observe les changements de style des éléments [id$="modal"] pour détecter leur
// ouverture/fermeture (elles basculent toutes entre display:none et display:flex).
let _dernierElementFocuse = null;
let _gestionnaireClavierModale = null;

function _elementsFocusables(conteneur) {
  return Array.from(conteneur.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(el => el.offsetParent !== null); // ignore les éléments cachés
}

function _ouvrirModaleAccessible(modale) {
  _dernierElementFocuse = document.activeElement;

  modale.setAttribute('role', 'dialog');
  modale.setAttribute('aria-modal', 'true');
  const titre = modale.querySelector('h3, h2');
  if (titre) {
    if (!titre.id) titre.id = 'titre-modale-' + Math.random().toString(36).slice(2, 9);
    modale.setAttribute('aria-labelledby', titre.id);
  }

  const focusables = _elementsFocusables(modale);
  if (focusables.length) focusables[0].focus();

  // Piège le Tab à l'intérieur de la modale tant qu'elle est ouverte (le focus clavier
  // ne doit jamais "s'échapper" vers le contenu de la page en dessous).
  _gestionnaireClavierModale = (e) => {
    if (e.key !== 'Tab') return;
    const items = _elementsFocusables(modale);
    if (!items.length) return;
    const premier = items[0];
    const dernier = items[items.length - 1];
    if (e.shiftKey && document.activeElement === premier) {
      e.preventDefault(); dernier.focus();
    } else if (!e.shiftKey && document.activeElement === dernier) {
      e.preventDefault(); premier.focus();
    }
  };
  document.addEventListener('keydown', _gestionnaireClavierModale);
}

function _fermerModaleAccessible() {
  if (_gestionnaireClavierModale) {
    document.removeEventListener('keydown', _gestionnaireClavierModale);
    _gestionnaireClavierModale = null;
  }
  // Rend le focus à l'élément qui avait ouvert la modale (ex: le bouton "Modifier"),
  // pour que la navigation clavier reprenne exactement là où l'utilisateur en était.
  if (_dernierElementFocuse && document.contains(_dernierElementFocuse)) {
    _dernierElementFocuse.focus();
  }
  _dernierElementFocuse = null;
}

function _initAccessibiliteModales() {
  document.querySelectorAll('[id$="modal"]').forEach((modale) => {
    let visible = getComputedStyle(modale).display !== 'none';
    new MutationObserver(() => {
      const maintenantVisible = getComputedStyle(modale).display !== 'none';
      if (maintenantVisible && !visible) _ouvrirModaleAccessible(modale);
      else if (!maintenantVisible && visible) _fermerModaleAccessible();
      visible = maintenantVisible;
    }).observe(modale, { attributes: true, attributeFilter: ['style'] });
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initAccessibiliteModales);
} else {
  _initAccessibiliteModales();
}

// Ferme n'importe quelle modale ouverte avec la touche Échap.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('[id$="modal"]').forEach((m) => {
    if (getComputedStyle(m).display !== 'none') m.style.display = 'none';
  });
});
// Désactive un bouton et affiche un texte de chargement pendant une action asynchrone,
// pour empêcher un double-clic de soumettre deux fois le même formulaire (double facture,
// double paiement, etc.). Retourne une fonction à appeler pour restaurer l'état initial.
function setButtonLoading(btn, loadingText) {
  if (!btn || btn.disabled) return () => {};
  const original = btn.innerHTML;
  btn.dataset.originalHtml = original;
  btn.disabled = true;
  btn.classList.add('btn-loading');
  btn.setAttribute('aria-busy', 'true');
  if (loadingText) {
    btn.setAttribute('aria-label', loadingText); // annoncé par les lecteurs d'écran
    btn.textContent = loadingText;
  }
  return () => {
    btn.disabled = false;
    btn.classList.remove('btn-loading');
    btn.removeAttribute('aria-busy');
    btn.removeAttribute('aria-label');
    btn.innerHTML = btn.dataset.originalHtml ?? original;
  };
}

// Affiche les contrôles de pagination (Précédent / indicateur de page / Suivant) dans le
// conteneur donné, et appelle `onPageChange(nouvellePage)` au clic. `pagination` est
// l'objet { page, limite, total, total_pages } renvoyé par l'API à côté des résultats.
function renderPagination(containerId, pagination, onPageChange) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!pagination || pagination.total_pages <= 1) {
    el.innerHTML = '';
    return;
  }

  const { page, total_pages, total } = pagination;
  el.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 4px; flex-wrap:wrap;">
      <span style="font-size:0.82rem; color:var(--ink-soft);">${total} résultat${total > 1 ? 's' : ''} — page ${page} / ${total_pages}</span>
      <div style="display:flex; gap:8px;">
        <button type="button" class="btn btn-sm btn-outline" id="pagination-prev" ${page <= 1 ? 'disabled' : ''}>${Icon('arrow-left')} Précédent</button>
        <button type="button" class="btn btn-sm btn-outline" id="pagination-next" ${page >= total_pages ? 'disabled' : ''}>Suivant ${Icon('arrow-right')}</button>
      </div>
    </div>
  `;
  document.getElementById('pagination-prev')?.addEventListener('click', () => onPageChange(page - 1));
  document.getElementById('pagination-next')?.addEventListener('click', () => onPageChange(page + 1));
}
