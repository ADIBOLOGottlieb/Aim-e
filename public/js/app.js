import { get, post } from './api.js';
import { state, ROLE_LABELS, isOwner } from './state.js';
import { esc, icon, initials, openModal, toast, loading } from './ui.js';
import loginPage from './pages/login.js';
import dashboard from './pages/dashboard.js';
import pos from './pages/pos.js';
import orders from './pages/orders.js';
import menu from './pages/menu.js';
import stock from './pages/stock.js';
import expenses from './pages/expenses.js';
import accounts from './pages/accounts.js';
import staff from './pages/staff.js';
import settings from './pages/settings.js';

const ROUTES = {
  dashboard: { page: dashboard, label: 'Tableau de bord', icon: 'home', group: 'Service' },
  pos: { page: pos, label: 'Prise de commande', icon: 'bell', group: 'Service' },
  orders: { page: orders, label: 'Commandes', icon: 'receipt', group: 'Service', badge: 'orders' },
  menu: { page: menu, label: 'La carte', icon: 'book', group: 'Gestion' },
  stock: { page: stock, label: 'Stock', icon: 'box', group: 'Gestion', badge: 'stock' },
  expenses: { page: expenses, label: 'Dépenses', icon: 'wallet', group: 'Gestion' },
  accounts: { page: accounts, label: 'Comptes', icon: 'chart', group: 'Direction', owner: true },
  staff: { page: staff, label: 'Personnel', icon: 'users', group: 'Direction', owner: true },
  settings: { page: settings, label: 'Paramètres', icon: 'cog', group: 'Direction', owner: true },
};

const app = document.getElementById('app');
let cleanup = null;
let badgeTimer = null;

/* ---------- Thème ---------- */

function currentTheme() {
  const forced = document.documentElement.getAttribute('data-theme');
  if (forced) return forced;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('theme', next); } catch { /* ignoré */ }
  document.querySelectorAll('[data-theme-icon]').forEach((el) => {
    el.innerHTML = icon(next === 'dark' ? 'sun' : 'moon', 16);
  });
  document.querySelectorAll('[data-theme-label]').forEach((el) => {
    el.textContent = next === 'dark' ? 'Clair' : 'Sombre';
  });
}

export const themeButtonContent = () =>
  `<span data-theme-icon>${icon(currentTheme() === 'dark' ? 'sun' : 'moon', 16)}</span><span data-theme-label>${currentTheme() === 'dark' ? 'Clair' : 'Sombre'}</span>`;

/* ---------- Session ---------- */

async function boot() {
  try {
    const { user } = await get('/auth/me');
    state.user = user;
    state.settings = await get('/settings');
    renderShell();
  } catch {
    showLogin();
  }
}

function showLogin() {
  stopPage();
  clearInterval(badgeTimer);
  state.user = null;
  document.title = 'Connexion — Gestion du restaurant';
  loginPage.render(app, async (user) => {
    state.user = user;
    state.settings = await get('/settings');
    if (!location.hash) location.hash = '#/dashboard';
    renderShell();
  });
}

window.addEventListener('auth:lost', () => {
  if (state.user) toast('Session expirée, veuillez vous reconnecter', 'error');
  showLogin();
});

async function logout() {
  await post('/auth/logout').catch(() => {});
  location.hash = '';
  showLogin();
}

function changePassword() {
  openModal({
    title: 'Changer mon mot de passe',
    submitLabel: 'Mettre à jour',
    body: `
      <div class="field"><label for="pw-cur">Mot de passe actuel</label><input id="pw-cur" class="input" type="password" name="current" required autocomplete="current-password"></div>
      <div class="field"><label for="pw-new">Nouveau mot de passe</label><input id="pw-new" class="input" type="password" name="next" required minlength="8" autocomplete="new-password"><span class="hint">8 caractères minimum</span></div>`,
    onSubmit: async (data) => {
      await post('/auth/password', data);
      toast('Mot de passe modifié');
    },
  });
}

/* ---------- Coquille ---------- */

function allowedRoutes() {
  return Object.entries(ROUTES).filter(([, r]) => !r.owner || isOwner());
}

function renderShell() {
  const groups = {};
  for (const [key, r] of allowedRoutes()) (groups[r.group] ||= []).push([key, r]);

  const nav = Object.entries(groups)
    .map(([group, items]) => `<div class="nav-label">${esc(group)}</div>` +
      items.map(([key, r]) => `<a href="#/${key}" data-route="${key}">${icon(r.icon)}<span>${esc(r.label)}</span>${r.badge ? `<span class="badge-count hidden" data-badge="${r.badge}"></span>` : ''}</a>`).join(''))
    .join('');

  const name = esc(state.settings.restaurant_name);
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar" aria-label="Navigation">
        <div class="brand">
          <div class="brand-mark">${icon('utensils', 22)}</div>
          <div class="brand-name">${name}</div>
          <div class="brand-sub">Maison &amp; table</div>
        </div>
        <div class="ornament">${icon('dots', 14)}</div>
        <nav class="nav">${nav}</nav>
        <div class="sidebar-foot">
          <div class="user-chip">
            <div class="avatar">${esc(initials(state.user.full_name))}</div>
            <div><div class="name">${esc(state.user.full_name)}</div><div class="role">${esc(ROLE_LABELS[state.user.role] || state.user.role)}</div></div>
          </div>
          <div class="sidebar-actions">
            <button type="button" data-action="theme" title="Changer de thème">${themeButtonContent()}</button>
            <button type="button" data-action="password" title="Mot de passe">${icon('key', 16)}</button>
            <button type="button" data-action="logout" title="Se déconnecter">${icon('logout', 16)}</button>
          </div>
        </div>
      </aside>
      <div class="scrim" data-action="close-nav"></div>
      <div class="main">
        <div class="mobile-bar">
          <button type="button" data-action="open-nav" aria-label="Ouvrir le menu">${icon('menu', 22)}</button>
          <span class="brand-name">${name}</span>
          <button type="button" data-action="theme" aria-label="Changer de thème"><span data-theme-icon>${icon(currentTheme() === 'dark' ? 'sun' : 'moon', 20)}</span></button>
        </div>
        <header class="topbar">
          <div><div class="eyebrow" id="page-eyebrow"></div><h1 id="page-title"></h1></div>
          <div class="topbar-actions" id="page-actions"></div>
        </header>
        <main class="content" id="page"></main>
      </div>
    </div>`;

  const shell = app.querySelector('.shell');
  app.querySelectorAll('[data-action]').forEach((el) =>
    el.addEventListener('click', () => {
      const action = el.dataset.action;
      if (action === 'theme') toggleTheme();
      if (action === 'logout') logout();
      if (action === 'password') changePassword();
      if (action === 'open-nav') shell.classList.add('nav-open');
      if (action === 'close-nav') shell.classList.remove('nav-open');
    })
  );
  app.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => shell.classList.remove('nav-open')));

  route();
  refreshBadges();
  clearInterval(badgeTimer);
  badgeTimer = setInterval(refreshBadges, 30000);
}

export async function refreshBadges() {
  if (!state.user) return;
  try {
    const [open, items] = await Promise.all([get('/orders/open'), get('/stock')]);
    setBadge('orders', open.length);
    setBadge('stock', items.filter((i) => i.quantity <= i.alert_threshold).length);
  } catch { /* silencieux */ }
}

function setBadge(name, count) {
  const el = app.querySelector(`[data-badge="${name}"]`);
  if (!el) return;
  el.textContent = count;
  el.classList.toggle('hidden', !count);
}

/* ---------- Routage ---------- */

function stopPage() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
}

function route() {
  if (!state.user) return;
  const key = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'dashboard';
  const allowed = Object.fromEntries(allowedRoutes());
  if (!allowed[key]) {
    location.hash = '#/dashboard';
    return;
  }
  const r = allowed[key];
  stopPage();
  app.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === key));
  document.title = `${r.label} — ${state.settings.restaurant_name}`;
  app.querySelector('#page-title').textContent = r.label;
  app.querySelector('#page-eyebrow').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const actions = app.querySelector('#page-actions');
  actions.innerHTML = '';
  const page = app.querySelector('#page');
  page.innerHTML = loading();
  try {
    cleanup = r.page.render(page, { actions, refreshBadges });
  } catch (err) {
    console.error(err);
    page.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);

export function reloadShell() {
  renderShell();
}

boot();
