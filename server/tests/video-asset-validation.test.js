'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateVideoAssets } = require('../scripts/validate-video-asset');

function makeFixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sunupilot-media-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const videoPath = path.join(dir, 'presentation.mp4');
  const captionsPath = path.join(dir, 'presentation.vtt');
  const posterPath = path.join(dir, 'poster.svg');

  const buffer = Buffer.alloc(128 * 1024);
  buffer.write('ftyp', 4, 'ascii');
  buffer.write('moov', 32, 'ascii');
  buffer.write('mdat', 64, 'ascii');
  fs.writeFileSync(videoPath, buffer);
  fs.writeFileSync(captionsPath, 'WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nBienvenue sur Sunupilot.\n');
  fs.writeFileSync(posterPath, '<svg xmlns="http://www.w3.org/2000/svg"></svg>');

  return { videoPath, captionsPath, posterPath };
}

test('validates the MP4 container, French WebVTT cues and poster', t => {
  const result = validateVideoAssets(makeFixture(t));
  assert.equal(result.valid, true);
  assert.equal(result.captionsCues, 1);
  assert.equal(result.videoBytes, 128 * 1024);
});

test('rejects a missing MP4 instead of silently accepting the fallback', t => {
  const fixture = makeFixture(t);
  fs.rmSync(fixture.videoPath);
  const result = validateVideoAssets(fixture);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /MP4 de présentation introuvable/);
});

test('rejects invalid MP4 signatures and malformed captions', t => {
  const fixture = makeFixture(t);
  fs.writeFileSync(fixture.videoPath, Buffer.alloc(128 * 1024, 0));
  fs.writeFileSync(fixture.captionsPath, 'SUBTITLES\nno timestamp here');
  const result = validateVideoAssets(fixture);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /signature MP4 valide/);
  assert.match(result.errors.join(' '), /WEBVTT/);
});
