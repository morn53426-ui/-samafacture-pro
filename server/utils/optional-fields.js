'use strict';

function optionalText(value, maxLength) {
  if (value === undefined || value === null) return null;
  return String(value).trim().slice(0, maxLength) || null;
}

function optionalIsoDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const date = new Date(text + 'T00:00:00.000Z');
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? undefined : text;
}

module.exports = { optionalText, optionalIsoDate };
