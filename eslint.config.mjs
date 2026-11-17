const browserGlobals = Object.fromEntries([
  'AbortController', 'Api', 'Audio', 'Blob', 'CSS', 'CanvasRenderingContext2D',
  'CustomEvent', 'DOMParser', 'Document', 'Element', 'Event', 'EventTarget', 'File',
  'FileReader', 'FormData', 'HTMLButtonElement', 'HTMLImageElement',
  'HTMLInputElement', 'HTMLElement', 'Image', 'Icon', 'IntersectionObserver',
  'io', 'KeyboardEvent', 'MouseEvent', 'MutationObserver', 'Node', 'NodeList',
  'ResizeObserver', 'SamaTheme', 'SVGElement', 'TextDecoder', 'TextEncoder',
  'URL', 'URLSearchParams', 'XMLHttpRequest', 'XMLSerializer',
  'addEventListener', 'alert', 'atob', 'btoa', 'cancelAnimationFrame',
  'clearTimeout', 'closeWorkspaceNotifications', 'confirm', 'console',
  'crypto', 'clearWorkspaceNotifications', 'devicePixelRatio', 'document',
  'escapeHtml', 'fetch', 'getComputedStyle', 'getSelection', 'history',
  'initials', 'innerHeight', 'innerWidth', 'localStorage', 'location',
  'matchMedia', 'navigator', 'performance', 'prompt', 'pushWorkspaceNotification',
  'requestAnimationFrame', 'requestIdleCallback', 'sessionStorage', 'setInterval',
  'setTimeout', 'showToast', 'toggleWorkspaceNotifications', 'window'
].map((name) => [name, 'readonly']));

const nodeGlobals = Object.fromEntries([
  '__dirname', '__filename', 'Buffer', 'clearImmediate', 'clearInterval',
  'clearTimeout', 'console', 'exports', 'global', 'module', 'process', 'require',
  'setImmediate', 'setInterval', 'setTimeout'
].map((name) => [name, 'readonly']));

const correctnessRules = {
  'no-constant-binary-expression': 'error',
  'no-dupe-args': 'error',
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-func-assign': 'error',
  'no-invalid-regexp': 'error',
  'no-irregular-whitespace': 'error',
  'no-obj-calls': 'error',
  'no-prototype-builtins': 'error',
  'no-self-assign': 'error',
  'no-sparse-arrays': 'error',
  'no-undef': 'error',
  'no-unexpected-multiline': 'error',
  'no-unreachable': 'error',
  'no-unsafe-finally': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error'
};

export default [
  {
    files: ['eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: correctnessRules
  },
  {
    files: ['public/js/sidebar.js', 'public/js/workspace-modals.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: browserGlobals
    },
    rules: correctnessRules
  },
  {
    files: [
      'server/tests/visual/recette-visuelle.js',
      'server/tests/workspace-navigation.test.js',
      'server/tests/workspace-modal-accessibility.test.js'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...nodeGlobals, ...browserGlobals }
    },
    rules: correctnessRules
  },

  {
    files: [
      'server/config/db.js',
      'server/email-outbox.js',
      'server/routes/professionnel.js',
      'server/tests/company-group-ui.test.js',
      'server/tests/company-groups.test.js',
      'server/tests/invoice-quota-migration-v8.test.js'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...nodeGlobals,
        AbortController: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        structuredClone: 'readonly'
      }
    },
    rules: correctnessRules
  }

];
