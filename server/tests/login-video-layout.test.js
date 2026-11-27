'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.resolve(__dirname, '../../public');
const loginHtml = fs.readFileSync(path.join(publicDir, 'login.html'), 'utf8');
const registerHtml = fs.readFileSync(path.join(publicDir, 'register.html'), 'utf8');
const stylesheet = fs.readFileSync(path.join(publicDir, 'css/style.css'), 'utf8');

test('login presents the Sunupilot video instead of the rotating image carousel', () => {
  assert.match(loginHtml, /class="auth-login-video-side"/);
  assert.match(loginHtml, /videos\/sunupilot-presentation\.mp4/);
  assert.match(loginHtml, /images\/sunupilot-presentation-poster\.svg/);
  assert.doesNotMatch(loginHtml, /auth-slider\.js|initAuthSlider\(\)|auth-side-root/);
});

test('login video exposes native controls, inline playback and French captions', () => {
  assert.match(loginHtml, /<video[^>]*controls[^>]*muted[^>]*playsinline/);
  assert.match(loginHtml, /<track[^>]*kind="captions"[^>]*srclang="fr"[^>]*default/);
  assert.match(loginHtml, /prefers-reduced-motion:\s*reduce/);
});

test('login video layout has a bounded 16:9 frame and responsive safe-area spacing', () => {
  assert.match(stylesheet, /\.auth-login-video-frame\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/s);
  const loginVideoStyles = stylesheet.slice(
    stylesheet.indexOf('/* ---------- Connexion : présentation vidéo Sunupilot ---------- */')
  );
  assert.match(loginVideoStyles, /@media\\s*\\(max-width:\\s*900px\\)/);
  assert.match(loginVideoStyles, /\\.auth-login-video-side\\s*\\{/);
  assert.match(stylesheet, /env\(safe-area-inset-bottom/);
});

test('registration retains the shared image carousel', () => {
  assert.match(registerHtml, /auth-slider\.js/);
  assert.match(registerHtml, /initAuthSlider\(\)/);
});
