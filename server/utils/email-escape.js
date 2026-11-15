'use strict';

function escapeHtmlEmail(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function sanitizeEmailHeader(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

module.exports = { escapeHtmlEmail, sanitizeEmailHeader };
