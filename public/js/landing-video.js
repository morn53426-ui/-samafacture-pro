// Présentation animée de secours : le lecteur natif MP4 prend le relais dès que le fichier est présent.
(function () {
  var root = document.getElementById('lp-video-presentation');
  if (!root) return;

  var video = root.querySelector('.lp-presentation-video');
  var fallback = root.querySelector('[data-video-fallback]');
  var scenes = Array.prototype.slice.call(root.querySelectorAll('[data-video-scene]'));
  var previous = root.querySelector('[data-video-prev]');
  var next = root.querySelector('[data-video-next]');
  var toggle = root.querySelector('[data-video-toggle]');
  var counter = root.querySelector('[data-video-counter]');
  var progress = root.querySelector('[data-video-progress]');
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var current = 0;
  var playing = !reduceMotion;
  var timer = null;
  var intervalMs = 6200;

  if (!scenes.length) return;

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function show(index) {
    current = (index + scenes.length) % scenes.length;
    scenes.forEach(function (scene, i) {
      var active = i === current;
      scene.classList.toggle('is-active', active);
      scene.setAttribute('aria-hidden', String(!active));
    });
    if (counter) {
      counter.textContent = String(current + 1).padStart(2, '0') +
        ' / ' + String(scenes.length).padStart(2, '0');
    }
    if (progress) progress.style.width = ((current + 1) / scenes.length * 100) + '%';
  }

  function sync() {
    stop();
    if (playing && !document.hidden && !reduceMotion && !root.classList.contains('is-video-ready')) {
      timer = window.setInterval(function () { show(current + 1); }, intervalMs);
    }
    if (toggle) {
      toggle.textContent = playing ? 'Ⅱ' : '▶';
      toggle.setAttribute('aria-pressed', String(!playing));
      toggle.setAttribute('aria-label', playing
        ? 'Mettre la présentation en pause'
        : 'Reprendre la présentation');
    }
  }

  if (previous) previous.addEventListener('click', function () { show(current - 1); sync(); });
  if (next) next.addEventListener('click', function () { show(current + 1); sync(); });
  if (toggle) toggle.addEventListener('click', function () { playing = !playing; sync(); });

  if (video) {
    function revealVideo() {
      root.classList.add('is-video-ready');
      stop();
    }

    // loadedmetadata arrive avant la première image : les commandes natives
    // restent accessibles sur les connexions lentes et les appareils mobiles.
    video.addEventListener('loadedmetadata', revealVideo);
    video.addEventListener('loadeddata', revealVideo);
    video.addEventListener('canplay', revealVideo);
    video.addEventListener('playing', revealVideo);
    video.addEventListener('error', function () {
      root.classList.remove('is-video-ready');
      sync();
    });

    // preload="metadata" peut finir avant l'installation des écouteurs.
    if (video.readyState >= 1 && !video.error) revealVideo();
  }

  document.addEventListener('visibilitychange', sync);
  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', sync);
  show(0);
  sync();
})();
