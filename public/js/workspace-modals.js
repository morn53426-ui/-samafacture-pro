'use strict';

(() => {
  const dialogs = [...document.querySelectorAll('[data-workspace-modal]')];
  if (!dialogs.length) return;

  const FOCUSABLE = [
    'a[href]', 'area[href]', 'input:not([type="hidden"]):not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])',
    'button:not([disabled])', '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  let activeDialog = null;
  let returnFocus = null;

  function isOpen(dialog) {
    return !dialog.hidden && window.getComputedStyle(dialog).display !== 'none';
  }

  function focusableItems(dialog) {
    return [...dialog.querySelectorAll(FOCUSABLE)].filter(element =>
      !element.hidden &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.getClientRects().length > 0
    );
  }

  function focusInside(dialog) {
    const target = focusableItems(dialog)[0] ||
      dialog.querySelector('.workspace-modal-panel') || dialog;
    target.focus({ preventScroll: true });
  }

  function syncDialogs() {
    const nextDialog = dialogs.find(isOpen) || null;
    dialogs.forEach(dialog => {
      dialog.setAttribute('aria-hidden', String(dialog !== nextDialog));
    });
    if (nextDialog === activeDialog) return;

    if (activeDialog && !nextDialog) {
      activeDialog = null;
      document.body.classList.remove('workspace-modal-open');
      const target = returnFocus;
      returnFocus = null;
      if (target && target.isConnected && typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    }

    if (nextDialog) {
      if (!activeDialog) returnFocus = document.activeElement;
      activeDialog = nextDialog;
      document.body.classList.add('workspace-modal-open');
      window.requestAnimationFrame(() => {
        if (activeDialog === nextDialog) focusInside(nextDialog);
      });
    }
  }

  dialogs.forEach(dialog => {
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-hidden', String(!isOpen(dialog)));
    if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
    const panel = dialog.querySelector('.workspace-modal-panel');
    if (panel && !panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
    const observer = new MutationObserver(syncDialogs);
    observer.observe(dialog, { attributes: true, attributeFilter: ['style', 'hidden'] });
  });

  document.addEventListener('keydown', event => {
    if (!activeDialog) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      const closeButton = activeDialog.querySelector('[data-modal-close]');
      if (closeButton) closeButton.click();
      else activeDialog.style.display = 'none';
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusableItems(activeDialog);
    if (!items.length) {
      event.preventDefault();
      activeDialog.querySelector('.workspace-modal-panel')?.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !activeDialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !activeDialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });

  document.addEventListener('focusin', event => {
    if (activeDialog && !activeDialog.contains(event.target)) focusInside(activeDialog);
  });

  syncDialogs();
})();
