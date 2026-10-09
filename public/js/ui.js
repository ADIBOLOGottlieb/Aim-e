import { state } from './state.js';

/* ---------- Échappement & formats ---------- */

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const moneyFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const qtyFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

export const money = (n) => `${moneyFmt.format(Number(n) || 0)} ${state.settings.currency || ''}`.trim();
export const qty = (n) => qtyFmt.format(Number(n) || 0);
export const time = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
export const dateShort = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
export const dateTime = (d) =>
  new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const minutesSince = (d) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 60000));

export function elapsedLabel(d) {
  const m = minutesSince(d);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  return `il y a ${h} h ${String(m % 60).padStart(2, '0')}`;
}

/* ---------- Libellés métier ---------- */

export const STATUS = {
  en_cours: { label: 'En cours', cls: 'warning' },
  servie: { label: 'Servie', cls: 'info' },
  annulee: { label: 'Annulée', cls: 'danger' },
};

export const METHODS = {
  especes: 'Espèces',
  carte: 'Carte bancaire',
  mobile: 'Mobile money',
  autre: 'Autre',
};

export const STOCK_CATEGORIES = {
  boisson: 'Boisson',
  ingredient: 'Ingrédient',
  autre: 'Autre article',
};

export const MOVEMENT_TYPES = {
  entree: { label: 'Réapprovisionnement', cls: 'success' },
  sortie: { label: 'Sortie / perte', cls: 'danger' },
  inventaire: { label: 'Inventaire', cls: 'info' },
  vente: { label: 'Vente', cls: 'gold' },
  annulation: { label: 'Annulation', cls: '' },
};

/* ---------- Périodes ---------- */

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const PERIODS = {
  today: "Aujourd'hui",
  yesterday: 'Hier',
  week: '7 jours',
  month: 'Ce mois',
  lastmonth: 'Mois dernier',
  '90d': '90 jours',
  year: 'Cette année',
};

export function periodRange(key) {
  const today = startOfDay();
  switch (key) {
    case 'yesterday': return { from: addDays(today, -1), to: today };
    case 'week': return { from: addDays(today, -6), to: addDays(today, 1) };
    case 'month': return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: addDays(today, 1) };
    case 'lastmonth': return {
      from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      to: new Date(today.getFullYear(), today.getMonth(), 1),
    };
    case '90d': return { from: addDays(today, -89), to: addDays(today, 1) };
    case 'year': return { from: new Date(today.getFullYear(), 0, 1), to: addDays(today, 1) };
    default: return { from: today, to: addDays(today, 1) };
  }
}

export const rangeQuery = ({ from, to }) =>
  `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}&tz=${new Date().getTimezoneOffset()}`;

export const toDateInput = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/* ---------- Icônes (traits style Lucide) ---------- */

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  bell: '<path d="M3 18h18"/><path d="M5 18a7 7 0 0 1 14 0"/><path d="M12 8V6"/><path d="M10 6h4"/><path d="M2 21h20"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5"/><path d="M9 7h7"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
  wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v13H5a2 2 0 0 1-2-2V5"/><circle cx="16" cy="13.5" r="1.2"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14a6 6 0 0 1 3.5 6"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8"/><path d="m16 7 3 3"/><path d="m19 4 2 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  arrowIn: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  arrowOut: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.1 10.4A6 6 0 1 1 10.3 18"/><path d="M7 6h1v4"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  utensils: '<path d="M3 2v7a3 3 0 0 0 6 0V2"/><path d="M6 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3zm0 0v7"/>',
};

export const icon = (name, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ---------- Petits blocs ---------- */

export const loading = () => '<div class="loading"><div class="spinner"></div></div>';

export const empty = (title, text = '', iconName = 'utensils') =>
  `<div class="empty">${icon(iconName, 40)}<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}</div>`;

export const badge = (label, cls = '') => `<span class="badge ${cls}">${esc(label)}</span>`;

export function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

/* ---------- Notifications ---------- */

export function toast(message, type = 'success') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="t-icon">${icon(type === 'error' ? 'alert' : 'check')}</span><span>${esc(message)}</span>`;
  box.appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? 5000 : 3000);
}

/* ---------- Modale ---------- */

export function openModal({
  title,
  body,
  submitLabel = 'Enregistrer',
  cancelLabel = 'Annuler',
  danger = false,
  wide = false,
  hideSubmit = false,
  onSubmit,
  onOpen,
}) {
  const dlg = document.getElementById('modal');
  dlg.className = `modal${wide ? ' wide' : ''}`;
  dlg.innerHTML = `
    <form>
      <div class="modal-head">
        <h2>${esc(title)}</h2>
        <button type="button" class="btn btn-ghost icon-btn" data-close aria-label="Fermer">${icon('x')}</button>
      </div>
      <div class="modal-body"><div class="form-error hidden" role="alert"></div>${body}</div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" data-close>${esc(cancelLabel)}</button>
        ${hideSubmit ? '' : `<button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(submitLabel)}</button>`}
      </div>
    </form>`;

  return new Promise((resolve) => {
    let done = false;
    const form = dlg.querySelector('form');
    const errorBox = dlg.querySelector('.form-error');
    const close = (value) => {
      if (done) return;
      done = true;
      dlg.close();
      resolve(value);
    };
    dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => close(null)));
    dlg.oncancel = (e) => {
      e.preventDefault();
      close(null);
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      if (btn) btn.disabled = true;
      errorBox.classList.add('hidden');
      try {
        const data = Object.fromEntries(new FormData(form));
        const result = onSubmit ? await onSubmit(data, form) : true;
        if (result !== false) close(result ?? true);
      } catch (err) {
        errorBox.textContent = err.message || 'Erreur';
        errorBox.classList.remove('hidden');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    dlg.showModal();
    if (onOpen) onOpen(form, close);
    const first = form.querySelector('.modal-body input:not([type=hidden]):not([type=radio]), .modal-body select, .modal-body textarea');
    if (first) first.focus();
  });
}

export function confirmDialog(message, { title = 'Confirmer', confirmLabel = 'Confirmer', danger = true } = {}) {
  return openModal({
    title,
    body: `<p class="muted">${esc(message)}</p>`,
    submitLabel: confirmLabel,
    danger,
  }).then(Boolean);
}

/* ---------- Divers ---------- */

export function downloadCsv(filename, rows) {
  const csv = rows
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
