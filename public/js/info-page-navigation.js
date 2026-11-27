'use strict';

(() => {
  const link = document.querySelector('[data-smart-back]');
  if (!link) return;

  const params = new URLSearchParams(window.location.search);
  const fallback = params.get('from') === 'workspace' ? 'dashboard.html' : 'index.html';
  link.setAttribute('href', fallback);

  let sameOriginHistory = false;
  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    sameOriginHistory = Boolean(
      referrer &&
      referrer.origin === window.location.origin &&
      referrer.href !== window.location.href &&
      window.history.length > 1
    );
  } catch (_) {
    sameOriginHistory = false;
  }

  if (sameOriginHistory) {
    link.addEventListener('click', event => {
      event.preventDefault();
      window.history.back();
    });
  }
})();
