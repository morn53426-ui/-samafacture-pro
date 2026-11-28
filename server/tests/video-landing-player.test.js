'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.resolve(__dirname, '../../public');
const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(publicDir, 'css/style.css'), 'utf8');
const playerJs = fs.readFileSync(path.join(publicDir, 'js/landing-video.js'), 'utf8');

test('the landing page uses the Sunupilot HTML5 presentation instead of the carousel', () => {
  assert.match(html, /id="lp-video-presentation"/);
  assert.doesNotMatch(html, /id="lp-home-slider"/);
  assert.doesNotMatch(html, /js\/landing-slider\.js/);
  assert.match(html, /js\/landing-video\.js/);
});

test('the video player uses the correct Sunupilot media and official brand icon', () => {
  assert.match(html, /src="videos\/sunupilot-presentation\.mp4"/);
  assert.match(html, /src="videos\/sunupilot-presentation-fr\.vtt"/);
  assert.match(html, /src="images\/icon-192\.png"/);
  assert.match(html, /<strong>Sunupilot<\/strong>/);
  assert.doesNotMatch(html, /Spark Sunupilot|Sama Facture Pro/i);
});

test('the player includes native controls, captions, and an accessible fallback', () => {
  assert.match(html, /<video[^>]+controls[^>]+playsinline/s);
  assert.match(html, /kind="captions"/);
  assert.match(html, /data-video-fallback/);
  assert.match(html, /data-video-prev/);
  assert.match(html, /data-video-next/);
  assert.match(playerJs, /prefers-reduced-motion/);
  assert.match(playerJs, /loadedmetadata/);
  assert.match(playerJs, /loadeddata/);
  assert.match(playerJs, /canplay/);
  assert.match(playerJs, /readyState >= 1/);
  assert.match(playerJs, /addEventListener\('error'/);
});

test('the player styles include responsive and reduced-motion rules', () => {
  assert.match(css, /\.lp-video-presentation/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /@media\s*\(max-width:\s*520px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('the HTML5 source uses a clear expected path and no remote media URL', () => {
  const source = html.match(/<source\s+src="([^"]+)"\s+type="video\/mp4"/);
  assert.ok(source, 'MP4 source tag is missing');
  assert.equal(source[1], 'videos/sunupilot-presentation.mp4');
  assert.doesNotMatch(source[1], /^https?:/i);
});
