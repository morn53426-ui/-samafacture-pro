// Convertit les attributs title= déjà présents dans les pages en info-bulles personnalisées
// (au survol et au focus clavier), plutôt que la bulle native du navigateur — lente à
// apparaître (~600ms), non stylée, et parfois peu lisible en mode sombre selon l'OS.
// Fonctionne sur toutes les pages sans qu'aucune n'ait besoin d'être modifiée.
(function () {
  function migrerTitres(racine) {
    if (!racine || racine.nodeType !== 1 && racine.nodeType !== 9) return;
    racine.querySelectorAll('[title]:not([data-tooltip])').forEach((el) => {
      const texte = el.getAttribute('title');
      if (!texte) return;

      // Préserve le nom accessible pour un élément sans texte visible (ex: bouton icône
      // seule) : le contenu généré en CSS (::after) n'est pas fiablement exposé aux
      // lecteurs d'écran, contrairement à title= qu'on s'apprête à retirer.
      if (!el.hasAttribute('aria-label') && !el.textContent.trim()) {
        el.setAttribute('aria-label', texte);
      }

      el.setAttribute('data-tooltip', texte);
      el.removeAttribute('title'); // évite d'avoir la bulle native ET la personnalisée
    });
  }

  function init() {
    migrerTitres(document);
    // Beaucoup de pages injectent du contenu après coup (barre latérale, lignes de
    // tableau...) : on observe le DOM pour migrer aussi les title= ajoutés dynamiquement.
    new MutationObserver(() => migrerTitres(document)).observe(document.documentElement, {
      childList: true, subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
