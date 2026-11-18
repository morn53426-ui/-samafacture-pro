// Bascule Clair / Sombre / Système — les palettes sont définies dans les feuilles CSS
// et sélectionnées par l'attribut data-theme sur <html>. Ce script mémorise le choix et
// notifie les composants canvas lorsqu'ils doivent recalculer leurs couleurs ; il ne définit
// aucune couleur lui-même.
//
// Chargé en tout premier dans <head> (avant même la feuille de style) sur CHAQUE page, pour que
// le thème mémorisé soit appliqué avant le premier rendu — sans ça, l'utilisateur verrait un
// éclair de thème clair avant que le thème sombre ne s'applique (flash of wrong theme).
(function () {
  const STORAGE_KEY = 'sf_theme'; // valeurs possibles : 'auto' | 'light' | 'dark'
  const ORDRE = ['auto', 'light', 'dark'];
  const INFOS = {
    auto: { icone: 'circle-half', label: 'Système' },
    light: { icone: 'sun', label: 'Clair' },
    dark: { icone: 'moon', label: 'Sombre' }
  };

  function themeActuel() {
    const v = localStorage.getItem(STORAGE_KEY);
    return ORDRE.includes(v) ? v : 'auto';
  }

  function appliquer(theme) {
    const html = document.documentElement;
    // 'auto' = suit la préférence système (@media prefers-color-scheme, déjà géré par le CSS
    // existant) : on retire simplement l'attribut plutôt que d'en imposer un.
    if (theme === 'auto') html.removeAttribute('data-theme');
    else html.setAttribute('data-theme', theme);
    document.dispatchEvent(new CustomEvent('sf:theme-change', { detail: { theme } }));
  }

  // Appliqué immédiatement, de façon synchrone, avant tout rendu de la page.
  appliquer(themeActuel());

  function definir(theme) {
    if (!ORDRE.includes(theme)) return;
    localStorage.setItem(STORAGE_KEY, theme);
    appliquer(theme);
    synchroniserBoutons();
  }

  // En mode « Système », les graphiques canvas ne peuvent pas suivre les variables CSS
  // automatiquement : on les avertit aussi lorsque la préférence système change à chaud.
  const mediaSysteme = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
  if (mediaSysteme) {
    const signalerChangementSysteme = () => {
      if (themeActuel() === 'auto') {
        document.dispatchEvent(new CustomEvent('sf:theme-change', { detail: { theme: 'auto' } }));
      }
    };
    if (typeof mediaSysteme.addEventListener === 'function') {
      mediaSysteme.addEventListener('change', signalerChangementSysteme);
    } else if (typeof mediaSysteme.addListener === 'function') {
      mediaSysteme.addListener(signalerChangementSysteme);
    }
  }

  function suivant() {
    const actuel = themeActuel();
    definir(ORDRE[(ORDRE.indexOf(actuel) + 1) % ORDRE.length]);
  }

  /** HTML du bouton, réutilisable partout (sidebar des pages connectées, ou bouton flottant
   * des pages publiques/légales sans sidebar). Un seul point de vérité pour son balisage. */
  function boutonHtml(idSuffixe) {
    const theme = themeActuel();
    const info = INFOS[theme];
    const id = `theme-toggle-btn${idSuffixe || ''}`;
    return `<button type="button" class="theme-toggle-btn" id="${id}" onclick="SamaTheme.suivant()" aria-label="Thème : ${info.label} — cliquer pour changer" title="Thème : ${info.label} — cliquer pour changer">` +
      `<span class="theme-toggle-icone" aria-hidden="true">${window.Icon ? Icon(info.icone) : ''}</span>` +
      `<span class="theme-toggle-texte">${info.label}</span>` +
      `</button>`;
  }

  function synchroniserBoutons() {
    const theme = themeActuel();
    const info = INFOS[theme];
    document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
      const icone = btn.querySelector('.theme-toggle-icone');
      const texte = btn.querySelector('.theme-toggle-texte');
      if (icone && window.Icon) icone.innerHTML = Icon(info.icone);
      if (texte) texte.textContent = info.label;
      const libelle = `Thème : ${info.label} — cliquer pour changer`;
      btn.setAttribute('aria-label', libelle);
      btn.setAttribute('title', libelle);
    });
  }

  /** Pages sans sidebar (accueil, connexion, pages légales...) : aucun bouton n'est fourni par
   * ailleurs, donc on ajoute un petit bouton flottant. Sur les pages avec sidebar, sidebar.js
   * insère déjà un `.theme-toggle-btn` dans le pied de menu — on ne duplique jamais le bouton. */
  function assurerBoutonFlottant() {
    if (document.querySelector('.theme-toggle-btn')) return;
    const conteneur = document.createElement('div');
    conteneur.className = 'theme-toggle-flottant';
    conteneur.innerHTML = boutonHtml('-flottant');
    document.body.appendChild(conteneur);
  }

  document.addEventListener('DOMContentLoaded', assurerBoutonFlottant);

  window.SamaTheme = { suivant, definir, get: themeActuel, boutonHtml, synchroniserBoutons };
})();
