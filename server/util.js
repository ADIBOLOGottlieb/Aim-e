class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const bad = (message) => new HttpError(400, message);

function text(value, { field = 'Champ', max = 200, required = false } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw bad(`${field} invalide`);
  const v = value.trim();
  if (required && !v) throw bad(`${field} requis`);
  if (v.length > max) throw bad(`${field} trop long (${max} caractères max)`);
  return v;
}

function number(value, { field = 'Valeur', min = 0, max = 1e10, integer = false } = {}) {
  const n = typeof value === 'string' ? Number(value.replace(',', '.').trim()) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw bad(`${field} invalide`);
  if (integer && !Number.isInteger(n)) throw bad(`${field} doit être un nombre entier`);
  if (n < min || n > max) throw bad(`${field} hors limites`);
  return n;
}

function bool(value) {
  return value === true || value === 'true' || value === 1 || value === 'on';
}

function oneOf(value, allowed, field = 'Valeur') {
  if (!allowed.includes(value)) throw bad(`${field} invalide`);
  return value;
}

function id(value) {
  return number(value, { field: 'Identifiant', min: 1, max: 2147483647, integer: true });
}

// Plage de dates envoyée par le client (bornes calculées dans son fuseau horaire).
function dateRange(query, maxDays = 400) {
  const from = new Date(query.from);
  const to = new Date(query.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    throw bad('Période invalide');
  }
  if (to - from > maxDays * 86400000) throw bad(`Période trop longue (${maxDays} jours max)`);
  return { from, to };
}

function placeholders(list, start = 1) {
  return list.map((_, i) => `$${i + start}`).join(', ');
}

module.exports = { HttpError, bad, text, number, bool, oneOf, id, dateRange, placeholders };
