// Affiche le bouton "Se connecter avec Google" si le serveur a un GOOGLE_CLIENT_ID configuré
// (voir server/.env.example). Sans configuration, la section reste simplement masquée —
// aucune erreur visible pour l'utilisateur.
async function initGoogleButton(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let config;
  try {
    config = await Api.get('/config');
  } catch (err) {
    return; // pas de configuration disponible, on n'affiche rien
  }

  if (!config.googleClientId) return;

  // Charge le script Google Identity Services à la demande, seulement si nécessaire.
  await new Promise((resolve, reject) => {
    if (window.google && window.google.accounts) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  }).catch(() => null);

  if (!window.google || !window.google.accounts) return;

  window.google.accounts.id.initialize({
    client_id: config.googleClientId,
    callback: handleGoogleCredential
  });

  container.style.display = 'block';
  window.google.accounts.id.renderButton(container.querySelector('.gsi-slot') || container, {
    theme: 'outline', size: 'large', width: 320, text: 'continue_with', locale: 'fr'
  });
}

async function handleGoogleCredential(response) {
  const errorBox = document.getElementById('error-box');
  try {
    const { token, user } = await Api.post('/auth/google', { credential: response.credential });
    Api.setSession(token, user);
    location.href = 'dashboard.html';
  } catch (err) {
    if (errorBox) errorBox.innerHTML = `<div class="error-box">${err.message}</div>`;
  }
}
