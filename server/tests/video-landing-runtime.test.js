'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const playerSource = fs.readFileSync(
  path.resolve(__dirname, '../../public/js/landing-video.js'),
  'utf8'
);

function makeElement(initialClasses = []) {
  const classes = new Set(initialClasses);
  const listeners = new Map();
  return {
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
      toggle(name, force) {
        const enabled = force === undefined ? !classes.has(name) : Boolean(force);
        if (enabled) classes.add(name);
        else classes.delete(name);
        return enabled;
      }
    },
    attributes: {},
    listeners,
    textContent: '',
    style: {},
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(callback);
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    dispatch(name) {
      for (const callback of listeners.get(name) || []) callback();
    }
  };
}

function bootPlayer(readyState = 0) {
  const video = makeElement();
  video.readyState = readyState;
  video.error = null;

  const fallback = makeElement();
  const previous = makeElement();
  const next = makeElement();
  const toggle = makeElement();
  const counter = makeElement();
  const progress = makeElement();
  const scene = makeElement();
  const root = makeElement();

  root.querySelector = selector => ({
    '.lp-presentation-video': video,
    '[data-video-fallback]': fallback,
    '[data-video-prev]': previous,
    '[data-video-next]': next,
    '[data-video-toggle]': toggle,
    '[data-video-counter]': counter,
    '[data-video-progress]': progress
  })[selector] || null;
  root.querySelectorAll = selector => selector === '[data-video-scene]' ? [scene] : [];
  
  const documentListeners = new Map();
  const document = {
    hidden: false,
    getElementById(id) { return id === 'lp-video-presentation' ? root : null; },
    addEventListener(name, callback) { documentListeners.set(name, callback); }
  };
  const window = {
    matchMedia() { return { matches: true }; },
    clearInterval() {},
    setInterval() { return 1; }
  };

  vm.runInNewContext(playerSource, { document, window, String, Array });
  return { root, video };
}

test('reveals native controls as soon as video metadata is available', () => {
  const { root, video } = bootPlayer(0);
  assert.equal(root.classList.contains('is-video-ready'), false);

  video.dispatch('loadedmetadata');
  assert.equal(root.classList.contains('is-video-ready'), true);
});

test('keeps the fallback visible when the video resource fails', () => {
  const { root, video } = bootPlayer(0);
  video.dispatch('error');
  assert.equal(root.classList.contains('is-video-ready'), false);
});

test('reveals the video immediately when metadata loaded before listener setup', () => {
  const { root } = bootPlayer(1);
  assert.equal(root.classList.contains('is-video-ready'), true);
});
