// Système d'icônes SVG — remplace les emojis utilisés comme icônes dans l'application (menu,
// badges, cartes statistiques, états vides...). Voir RAPPORT_ICONES.md pour le détail.
//
// Pourquoi : un emoji s'affiche différemment selon l'OS/le navigateur (Windows, macOS, Android
// n'ont pas le même jeu d'emojis), ne s'aligne jamais parfaitement avec du texte, et ne peut pas
// hériter la couleur environnante. Un jeu d'icônes SVG cohérent (trait 1.8, coins arrondis,
// hérite `currentColor` et `font-size` via `width/height:1em`) résout les trois à la fois.
//
// Deux façons de s'en servir, pour ne rien casser de l'existant :
//  1) Contenu généré en JavaScript (template literals, ex. sidebar.js) :
//       `${Icon('home')}` → renvoie le <svg> complet, prêt à insérer.
//  2) HTML statique déjà présent sur la page :
//       `<i class="ic" data-icon="home"></i>` → converti automatiquement en SVG au chargement
//       (voir hydrateIcons() plus bas). La classe existante (`ic`, `stat-icon`...) est conservée
//       telle quelle : ce sont CES classes qui gèrent déjà la taille/couleur/fond dans style.css,
//       le SVG n'a donc besoin d'aucune règle CSS supplémentaire pour s'intégrer.
(function () {
  const PATHS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9"/><path d="M9.5 20v-6h5v6"/>',
    'file-text': '<path d="M7 2.5h7l4 4V21a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"/><path d="M14 2.5V7h4"/><path d="M9 12h6M9 15.5h6M9 9h2"/>',
    'file-stack': '<path d="M6.5 3.5h7l4 4V19a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M13.5 3.5V7.5h4"/><path d="M4 8v11.5A1.5 1.5 0 0 0 5.5 21h9"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2c2.6.3 4.5 2.5 4.5 5.3"/>',
    banknote: '<rect x="2.5" y="6.5" width="19" height="11" rx="1.8"/><circle cx="12" cy="12" r="2.6"/><path d="M5.5 9h.01M18.5 15h.01"/>',
    wallet: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5v9A2.5 2.5 0 0 1 16.5 19h-11A2.5 2.5 0 0 1 3 16.5v-9Z"/><path d="M19 9.5h1.5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H19"/><path d="M15 12.2h.01"/>',
    'bar-chart': '<path d="M4 20V10M12 20V4M20 20v-7"/><path d="M2.5 20h19"/>',
    'trending-up': '<path d="M3 17l6.5-6.5 4 4L21 6.5"/><path d="M15.5 6.5H21V12"/>',
    package: '<path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
    'credit-card': '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19"/><path d="M6 15h4"/>',
    building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h1.2M13.8 7H15M9 11h1.2M13.8 11H15M9 15h1.2M13.8 15H15"/><path d="M10 21v-3.5h4V21"/>',
    landmark: '<path d="M3 9.5 12 4l9 5.5"/><path d="M4.5 9.5h15V20h-15V9.5Z"/><path d="M7.5 12.5v5M12 12.5v5M16.5 12.5v5"/><path d="M3 20.5h18"/>',
    receipt: '<path d="M6 2.5h12v18.2l-2.2-1.4-2.2 1.4-2.1-1.4-2.1 1.4-2.2-1.4-1.2.8V2.5Z"/><path d="M9 8h6M9 11.5h6M9 15h4"/>',
    'check-circle': '<circle cx="12" cy="12" r="9.2"/><path d="M8 12.3l2.6 2.6L16.3 9"/>',
    check: '<path d="M4 12.5 9.5 18 20 6"/>',
    x: '<path d="M5 5l14 14M19 5 5 19"/>',
    'alert-triangle': '<path d="M12 3.5 22 20.5H2L12 3.5Z"/><path d="M12 10v4.2M12 17.3h.01"/>',
    sparkles: '<path d="M12 3l1.4 4.2L18 8.6l-4.6 1.4L12 14.2l-1.4-4.2L6 8.6l4.6-1.4L12 3Z"/><path d="M19 15l.8 2.3L22 18l-2.2.7L19 21l-.8-2.3L16 18l2.2-.7L19 15Z"/>',
    wand: '<path d="M4 20 16 8"/><path d="M14 3l.8 2.2L17 6l-2.2.8L14 9l-.8-2.2L11 6l2.2-.8L14 3Z"/><path d="M19 11l.5 1.5L21 13l-1.5.5L19 15l-.5-1.5L17 13l1.5-.5L19 11Z"/>',
    star: '<path d="M12 3.2 14.9 9l6.4 1-4.6 4.5 1.1 6.3L12 17.8 6.2 20.8l1.1-6.3L2.7 10l6.4-1L12 3.2Z"/>',
    gem: '<path d="M4 8.5 8 3.5h8l4 5-9.7 11.5L4 8.5Z"/><path d="M4 8.5h16"/><path d="M9.5 3.5 8 8.5l4 11.5 4-11.5-1.5-5"/>',
    'message-circle': '<path d="M12 3.5C6.8 3.5 2.6 7.2 2.6 11.8c0 2.2 1 4.2 2.6 5.7-.15 1.3-.7 2.6-1.6 3.6 1.6-.15 3.2-.7 4.5-1.6 1.2.4 2.5.6 3.9.6 5.2 0 9.4-3.7 9.4-8.3S17.2 3.5 12 3.5Z"/>',
    mail: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M3 6.5 12 13l9-6.5"/>',
    phone: '<path d="M6 3.5 9.5 3l1.5 4-2 1.5c.9 2 2.5 3.6 4.5 4.5l1.5-2 4 1.5-.5 3.5c-.2 1.4-1.4 2.4-2.8 2.2-6.5-.9-11.6-6-12.5-12.5C3.1 4.9 4.2 3.7 5.5 3.5Z"/>',
    menu: '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M19.5 19.5 15.2 15.2"/>',
    smartphone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2"/><path d="M11 19h2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9.5h18"/><path d="M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.5 2"/>',
    printer: '<path d="M7 8.5V3h10v5.5"/><rect x="3.5" y="8.5" width="17" height="8" rx="1.5"/><path d="M7 15h10v6H7v-6Z"/>',
    repeat: '<path d="M4 7.5h12.5a3.5 3.5 0 0 1 3.5 3.5v1"/><path d="M8 4 4 7.5 8 11"/><path d="M20 16.5H7.5A3.5 3.5 0 0 1 4 13v-1"/><path d="M16 20l4-3.5-4-3.5"/>',
    'arrow-right': '<path d="M4.5 12h15"/><path d="M13 5.5 19.5 12 13 18.5"/>',
    'arrow-left': '<path d="M19.5 12h-15"/><path d="M11 5.5 4.5 12 11 18.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
    plus: '<path d="M12 4.5v15M4.5 12h15"/>',
    download: '<path d="M12 3v12"/><path d="M7 10.5 12 15l5-4.5"/><path d="M4.5 19.5h15"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.2 6.2l2.2 2M17.6 15.8l2.2 2M2.5 12h3M18.5 12h3M4.2 17.8l2.2-2M17.6 8.2l2.2-2"/>',
    'help-circle': '<circle cx="12" cy="12" r="9.2"/><path d="M9.2 9.3a2.8 2.8 0 1 1 4.4 2.3c-.9.6-1.6 1.1-1.6 2.4"/><path d="M12 17.3h.01"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5"/><circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none"/>',
    activity: '<path d="M2.5 13.5A9.7 9.7 0 0 1 21.5 13.5"/><path d="M6 16.7a5.6 5.6 0 0 1 12 0"/><circle cx="12" cy="20" r="1.3" fill="currentColor" stroke="none"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"/>',
    moon: '<path d="M20.5 14.5A9 9 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z"/>',
    'circle-half': '<circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18Z" fill="currentColor" stroke="none"/>',
    'chevron-down': '<path d="M5 8.5 12 15.5 19 8.5"/>'
  };

  /**
   * Renvoie le HTML complet d'une icône, prêt à insérer dans un template littéral JS.
   * @param {string} name - une clé de PATHS ci-dessus.
   * @param {{class?: string}} [opts]
   */
  function Icon(name, opts) {
    const d = PATHS[name];
    if (!d) {
      console.warn(`[icons.js] icône inconnue : "${name}"`);
      return '';
    }
    const extra = opts && opts.class ? ` ${opts.class}` : '';
    return `<svg class="icon${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
  }

  /** Convertit tous les <i class="..." data-icon="nom"></i> d'une portion de page en SVG. Les
   * autres attributs déjà présents sur le <i> (class, style, title...) sont reportés tels quels
   * sur le <svg> généré, pour que le CSS/style inline existant continue de s'appliquer sans
   * modification — ex. <i class="ic" data-icon="arrow-right" style="transform:scaleX(-1)">. */
  function hydrateIcons(root) {
    (root || document).querySelectorAll('i[data-icon]').forEach((el) => {
      const name = el.getAttribute('data-icon');
      if (!PATHS[name]) {
        console.warn(`[icons.js] icône inconnue : "${name}"`);
        return;
      }
      const classesExistantes = (el.getAttribute('class') || '').trim();
      const svgHtml = Icon(name, { class: classesExistantes });
      const temp = document.createElement('div');
      temp.innerHTML = svgHtml;
      const svg = temp.firstElementChild;
      // Reporte tout attribut supplémentaire (style, title, data-*...) autre que class/data-icon
      // (déjà gérés ci-dessus) sur le <svg> généré.
      for (const attr of el.attributes) {
        if (attr.name === 'class' || attr.name === 'data-icon') continue;
        svg.setAttribute(attr.name, attr.value);
      }
      el.replaceWith(svg);
    });
  }

  document.addEventListener('DOMContentLoaded', () => hydrateIcons());

  window.Icon = Icon;
  window.hydrateIcons = hydrateIcons;
})();
