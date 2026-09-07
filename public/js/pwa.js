// Enregistre le service worker (mise en cache de l'interface pour un chargement rapide/hors-ligne)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Gère l'invite d'installation native du navigateur ("Ajouter à l'écran d'accueil" / "Installer")
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.querySelectorAll('.install-app-btn').forEach(btn => { btn.style.display = 'flex'; });
});

async function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.querySelectorAll('.install-app-btn').forEach(btn => { btn.style.display = 'none'; });
}

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  document.querySelectorAll('.install-app-btn').forEach(btn => { btn.style.display = 'none'; });
});
