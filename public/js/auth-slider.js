// Diaporama partagé par les pages de connexion et d'inscription.
function renderAuthSide() {
  const slides = [
    {
      src: 'images/auth-slide-1.jpg',
      eyebrow: 'GESTION AU QUOTIDIEN',
      title: 'Votre activité, mieux organisée.',
      description: 'Centralisez vos devis, factures et clients dans un seul espace.'
    },
    {
      src: 'images/auth-slide-2.jpg',
      eyebrow: 'IMAGE PROFESSIONNELLE',
      title: 'Des documents clairs et soignés.',
      description: 'Créez des factures professionnelles en quelques clics.'
    },
    {
      src: 'images/auth-slide-3.jpg',
      eyebrow: 'SUIVI SIMPLIFIÉ',
      title: 'Gardez le contrôle de vos encaissements.',
      description: 'Suivez les règlements et l’évolution de votre activité plus facilement.'
    }
  ];

  const messages = [
    { icon: 'check-circle', text: 'Facturation rapide et professionnelle.' },
    { icon: 'sparkles', text: 'Gérez vos clients en quelques clics.' },
    { icon: 'file-text', text: 'Devis et factures conformes.' },
    { icon: 'credit-card', text: 'Paiement via Wave, Orange Money, PayDunya et Stripe.' },
    { icon: 'bar-chart', text: 'Tableau de bord intelligent.' }
  ];
  const marqueeItems = [...messages, ...messages]
    .map(m => '<span class="auth-marquee-item">' + Icon(m.icon) + ' ' + m.text + '</span>')
    .join('');

  const slidesHtml = slides.map((slide, i) =>
    '<div class="auth-slide' + (i === 0 ? ' active' : '') + '" role="group" aria-roledescription="diapositive" aria-label="Diapositive ' + (i + 1) + ' sur ' + slides.length + '" aria-hidden="' + (i !== 0) + '" style="background-image:url(&quot;' + slide.src + '&quot;)"></div>'
  ).join('');

  const dotsHtml = slides.map((_, i) =>
    '<button type="button" class="dot' + (i === 0 ? ' active' : '') + '" data-slide-dot="' + i + '" aria-label="Afficher la diapositive ' + (i + 1) + '" aria-current="' + (i === 0) + '"></button>'
  ).join('');

  return ''
    + '<section class="auth-side" id="auth-slider" role="region" aria-roledescription="carrousel" aria-label="Présentation de SamaFacture Pro">'
    + slidesHtml
    + '<div class="auth-slide-overlay" aria-hidden="true"></div>'
    + '<button type="button" class="auth-slider-arrow prev" aria-label="Image précédente">‹</button>'
    + '<button type="button" class="auth-slider-arrow next" aria-label="Image suivante">›</button>'
    + '<div class="auth-content">'
    + '  <div class="auth-badge"><div class="mark" style="width:36px;height:36px;border-radius:10px;overflow:hidden;flex-shrink:0;"><img src="images/icon-192.png" alt="" style="width:100%;height:100%;object-fit:cover;" /></div><div style="font-family:var(--font-display);font-weight:700;font-size:1.1rem;">SamaFacture Pro</div></div>'
    + '  <div class="auth-slide-caption" aria-live="polite" aria-atomic="true"><span class="eyebrow" data-auth-eyebrow>' + slides[0].eyebrow + '</span><h2 data-auth-title>' + slides[0].title + '</h2><p data-auth-description>' + slides[0].description + '</p></div>'
    + '  <div class="auth-marquee-group">'
    + '    <div class="auth-marquee"><div class="auth-marquee-track">' + marqueeItems + '</div></div>'
    + '    <div class="auth-slider-controls"><div class="auth-slider-dots" aria-label="Choisir une diapositive">' + dotsHtml + '</div><button type="button" class="auth-slider-toggle" aria-label="Mettre le diaporama en pause" aria-pressed="false">Ⅱ</button></div>'
    + '    <div style="font-size:0.82rem;color:#D4DBEA;margin-top:10px;">Wave · Orange Money · PayDunya · Stripe</div>'
    + '  </div>'
    + '</div></section>';
}

function initAuthSlider() {
  const root = document.getElementById('auth-side-root');
  if (!root) return;
  root.outerHTML = renderAuthSide();

  const slider = document.getElementById('auth-slider');
  if (!slider) return;

  const slides = Array.from(slider.querySelectorAll('.auth-slide'));
  const dots = Array.from(slider.querySelectorAll('[data-slide-dot]'));
  const title = slider.querySelector('[data-auth-title]');
  const eyebrow = slider.querySelector('[data-auth-eyebrow]');
  const description = slider.querySelector('[data-auth-description]');
  const toggle = slider.querySelector('.auth-slider-toggle');
  const AUTOPLAY_MS = 5200;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = 0;
  let timer = null;
  let pausedByUser = reduceMotion;
  let pointerInside = false;
  let focusInside = false;
  let touchStartX = null;

  function stopAutoplay() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function syncAutoplay() {
    stopAutoplay();
    if (!pausedByUser && !pointerInside && !focusInside && !document.hidden && slides.length > 1) {
      timer = window.setInterval(function () { show(current + 1); }, AUTOPLAY_MS);
    }
  }

  function show(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach(function (slide, i) {
      const active = i === current;
      slide.classList.toggle('active', active);
      slide.setAttribute('aria-hidden', String(!active));
    });
    dots.forEach(function (dot, i) {
      const active = i === current;
      dot.classList.toggle('active', active);
      dot.setAttribute('aria-current', String(active));
    });
    if (title) title.textContent = slidesData[current].title;
    if (eyebrow) eyebrow.textContent = slidesData[current].eyebrow;
    if (description) description.textContent = slidesData[current].description;
  }

  const slidesData = [
    { eyebrow: 'GESTION AU QUOTIDIEN', title: 'Votre activité, mieux organisée.', description: 'Centralisez vos devis, factures et clients dans un seul espace.' },
    { eyebrow: 'IMAGE PROFESSIONNELLE', title: 'Des documents clairs et soignés.', description: 'Créez des factures professionnelles en quelques clics.' },
    { eyebrow: 'SUIVI SIMPLIFIÉ', title: 'Gardez le contrôle de vos encaissements.', description: 'Suivez les règlements et l’évolution de votre activité plus facilement.' }
  ];

  function setPaused(paused) {
    pausedByUser = paused;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Reprendre le diaporama' : 'Mettre le diaporama en pause');
    toggle.textContent = paused ? '▶' : 'Ⅱ';
    syncAutoplay();
  }

  slider.querySelector('.auth-slider-arrow.next').addEventListener('click', function () { show(current + 1); syncAutoplay(); });
  slider.querySelector('.auth-slider-arrow.prev').addEventListener('click', function () { show(current - 1); syncAutoplay(); });
  dots.forEach(function (dot, i) { dot.addEventListener('click', function () { show(i); syncAutoplay(); }); });
  toggle.addEventListener('click', function () { setPaused(!pausedByUser); });

  slider.addEventListener('mouseenter', function () { pointerInside = true; syncAutoplay(); });
  slider.addEventListener('mouseleave', function () { pointerInside = false; syncAutoplay(); });
  slider.addEventListener('focusin', function () { focusInside = true; syncAutoplay(); });
  slider.addEventListener('focusout', function () {
    window.setTimeout(function () {
      focusInside = slider.contains(document.activeElement);
      syncAutoplay();
    }, 0);
  });
  slider.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); syncAutoplay(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); syncAutoplay(); }
  });
  slider.addEventListener('touchstart', function (event) {
    touchStartX = event.changedTouches && event.changedTouches[0] ? event.changedTouches[0].clientX : null;
  }, { passive: true });
  slider.addEventListener('touchend', function (event) {
    if (touchStartX === null || !event.changedTouches || !event.changedTouches[0]) return;
    const delta = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 45) { show(current + (delta < 0 ? 1 : -1)); syncAutoplay(); }
    touchStartX = null;
  }, { passive: true });
  document.addEventListener('visibilitychange', syncAutoplay);

  show(0);
  setPaused(reduceMotion);
}
