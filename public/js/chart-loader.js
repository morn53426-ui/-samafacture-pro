// Charge Chart.js depuis un CDN, avec un second CDN de secours automatique si le premier
// échoue (réseau restrictif, CDN temporairement indisponible, etc.). Expose une promesse
// `window.chartReady` que les pages peuvent attendre avant de créer un graphique, au lieu
// de planter avec "Chart is not defined" si le script ne s'est pas chargé.
window.chartReady = new Promise((resolve, reject) => {
  function tryLoad(url, onFail) {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = onFail;
    document.head.appendChild(script);
  }

  const sources = [
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
  ];

  tryLoad(sources[0], () => {
    console.warn('Chart.js indisponible sur le premier CDN, tentative avec un second...');
    tryLoad(sources[1], () => {
      console.error("Chart.js n'a pas pu être chargé (aucun accès internet ou CDN bloqué).");
      reject(new Error("Les graphiques n'ont pas pu être chargés (pas d'accès internet)."));
    });
  });
});
