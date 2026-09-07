// Génère le panneau gauche des pages de connexion/inscription : slider photo en fond
// (transition fondu + effet Ken Burns, flèches, points de navigation) et bannière
// défilante en verre dépoli (glassmorphism) à la place du texte statique.
// Usage : document.getElementById('auth-side-root').outerHTML = renderAuthSide();
function renderAuthSide() {
  const slides = ['images/auth-slide-1.jpg', 'images/auth-slide-2.jpg', 'images/auth-slide-3.jpg'];

  const messages = [
    { icon: 'check-circle', text: 'Facturation rapide et professionnelle.' },
    { icon: 'sparkles', text: 'Gérez vos clients en quelques clics.' },
    { icon: 'file-text', text: 'Devis et factures conformes.' },
    { icon: 'credit-card', text: 'Paiement via Wave, Orange Money, PayDunya et Stripe.' },
    { icon: 'bar-chart', text: 'Tableau de bord intelligent.' }
  ];
  // Le contenu est dupliqué une fois pour permettre une boucle de défilement infinie et
  // parfaitement continue (voir l'animation authMarqueeScroll dans style.css).
  const marqueeItems = [...messages, ...messages]
    .map(m => `<span class="auth-marquee-item">${Icon(m.icon)} ${m.text}</span>`)
    .join('');

  const slidesHtml = slides.map((src, i) =>
    `<div class="auth-slide${i === 0 ? ' active' : ''}" style="background-image:url('${src}')"></div>`
  ).join('');

  const dotsHtml = slides.map((_, i) =>
    `<span class="dot${i === 0 ? ' active' : ''}" data-slide-dot="${i}"></span>`
  ).join('');

  return `
    <div class="auth-side" id="auth-slider">
      ${slidesHtml}
      <div class="auth-slide-overlay"></div>

      <button type="button" class="auth-slider-arrow prev" aria-label="Image précédente">‹</button>
      <button type="button" class="auth-slider-arrow next" aria-label="Image suivante">›</button>

      <div class="auth-content">
        <div class="auth-badge">
          <div class="mark" style="width:36px;height:36px;border-radius:10px;overflow:hidden;flex-shrink:0;"><img src="images/icon-192.png" alt="SamaFacture Pro" style="width:100%;height:100%;object-fit:cover;" /></div>
          <div style="font-family:var(--font-display); font-weight:700; font-size:1.1rem;">SamaFacture Pro</div>
        </div>

        <div class="auth-marquee-group">
          <div class="auth-marquee">
            <div class="auth-marquee-track">${marqueeItems}</div>
          </div>
          <div class="auth-slider-dots">${dotsHtml}</div>
          <div style="font-size:0.82rem; color:#9AA6C4; margin-top:10px;">Wave · Orange Money · PayDunya · Stripe</div>
        </div>
      </div>
    </div>
  `;
}

function initAuthSlider() {
  const root = document.getElementById('auth-side-root');
  if (!root) return;
  root.outerHTML = renderAuthSide();

  const slider = document.getElementById('auth-slider');
  const slides = slider.querySelectorAll('.auth-slide');
  const dots = slider.querySelectorAll('.auth-slider-dots .dot');
  const AUTOPLAY_MS = 4500;
  let current = 0;
  let timer = null;

  function show(index) {
    slides[current]?.classList.remove('active');
    dots[current]?.classList.remove('active');
    current = (index + slides.length) % slides.length;
    // Force un reflow avant de réappliquer la classe pour relancer l'effet Ken Burns
    // (l'animation CSS ne redémarre pas si la classe reste appliquée sans interruption).
    void slides[current].offsetWidth;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }

  function restartAutoplay() {
    clearInterval(timer);
    timer = setInterval(() => show(current + 1), AUTOPLAY_MS);
  }

  slider.querySelector('.auth-slider-arrow.next').addEventListener('click', () => { show(current + 1); restartAutoplay(); });
  slider.querySelector('.auth-slider-arrow.prev').addEventListener('click', () => { show(current - 1); restartAutoplay(); });
  dots.forEach((d, i) => d.addEventListener('click', () => { show(i); restartAutoplay(); }));

  restartAutoplay();
}
