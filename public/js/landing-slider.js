// Carrousel photo de la page d'accueil : autonome, accessible et sans dépendance.
(function () {
  var root = document.getElementById('lp-home-slider');
  if (!root) return;

  var slides = Array.prototype.slice.call(root.querySelectorAll('[data-home-slide]'));
  var dots = Array.prototype.slice.call(root.querySelectorAll('[data-home-dot]'));
  var previous = root.querySelector('[data-home-prev]');
  var next = root.querySelector('[data-home-next]');
  var toggle = root.querySelector('[data-home-toggle]');
  var counter = root.querySelector('[data-home-counter]');
  var intervalMs = 5600;
  var current = 0;
  var timer = null;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pausedByUser = reduceMotion;
  var pointerInside = false;
  var focusInside = false;
  var touchStartX = null;

  if (!slides.length) return;

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function syncAutoplay() {
    stop();
    if (!pausedByUser && !pointerInside && !focusInside && !document.hidden && slides.length > 1) {
      timer = window.setInterval(function () { show(current + 1); }, intervalMs);
    }
  }

  function show(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach(function (slide, i) {
      var active = i === current;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
    });
    dots.forEach(function (dot, i) {
      var active = i === current;
      dot.setAttribute('aria-current', String(active));
    });
    if (counter) counter.textContent = String(current + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
  }

  function setPaused(paused) {
    pausedByUser = paused;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Reprendre le diaporama' : 'Mettre le diaporama en pause');
    toggle.textContent = paused ? '▶' : 'Ⅱ';
    syncAutoplay();
  }

  if (previous) previous.addEventListener('click', function () { show(current - 1); syncAutoplay(); });
  if (next) next.addEventListener('click', function () { show(current + 1); syncAutoplay(); });
  dots.forEach(function (dot, i) { dot.addEventListener('click', function () { show(i); syncAutoplay(); }); });
  if (toggle) toggle.addEventListener('click', function () { setPaused(!pausedByUser); });

  root.addEventListener('mouseenter', function () { pointerInside = true; syncAutoplay(); });
  root.addEventListener('mouseleave', function () { pointerInside = false; syncAutoplay(); });
  root.addEventListener('focusin', function () { focusInside = true; syncAutoplay(); });
  root.addEventListener('focusout', function () {
    window.setTimeout(function () {
      focusInside = root.contains(document.activeElement);
      syncAutoplay();
    }, 0);
  });
  root.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); syncAutoplay(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); syncAutoplay(); }
  });
  root.addEventListener('touchstart', function (event) {
    touchStartX = event.changedTouches && event.changedTouches[0] ? event.changedTouches[0].clientX : null;
  }, { passive: true });
  root.addEventListener('touchend', function (event) {
    if (touchStartX === null || !event.changedTouches || !event.changedTouches[0]) return;
    var delta = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 45) { show(current + (delta < 0 ? 1 : -1)); syncAutoplay(); }
    touchStartX = null;
  }, { passive: true });
  document.addEventListener('visibilitychange', syncAutoplay);

  show(0);
  setPaused(reduceMotion);
})();
