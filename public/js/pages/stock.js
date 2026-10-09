import { get, post, put, del } from '../api.js';
import {
  esc, icon, money, qty, dateTime, toast, empty, loading, badge, openModal, confirmDialog,
  STOCK_CATEGORIES, MOVEMENT_TYPES,
} from '../ui.js';

export default {
  render(root, { actions, refreshBadges }) {
    let items = [];
    let tab = 'items';
    let filter = 'all';
    let search = '';

    actions.innerHTML = `<button class="btn btn-primary" id="add">${icon('plus')} Nouvel article</button>`;
    actions.querySelector('#add').addEventListener('click', () => editItem());

    root.innerHTML = `
      <div id="kpis"></div>
      <div class="tabs" role="tablist">
        <button class="tab active" data-tab="items" role="tab">Articles</button>
        <button class="tab" data-tab="moves" role="tab">Mouvements</button>
      </div>
      <div id="items-view">
        <div class="toolbar">
          <div class="chips" id="filters"></div>
          <div class="spacer"></div>
          <label class="search">${icon('search', 16)}<input class="input" id="q" type="search" placeholder="Rechercher…" aria-label="Rechercher un article"></label>
        </div>
        <div class="card" id="table">${loading()}</div>
      </div>
      <div id="moves-view" class="hidden"><div class="card" id="moves">${loading()}</div></div>`;

    const $ = (s) => root.querySelector(s);
    const isLow = (i) => i.quantity <= i.alert_threshold;

    function drawKpis() {
      const low = items.filter(isLow);
      const value = items.reduce((s, i) => s + Math.max(0, i.quantity) * i.unit_cost, 0);
      $('#kpis').innerHTML = `<div class="kpis">
        <div class="card kpi"><div class="kpi-label">${icon('box', 15)} Articles suivis</div><div class="kpi-value">${items.length}</div>
          <div class="kpi-sub">${items.filter((i) => i.category === 'boisson').length} boissons · ${items.filter((i) => i.category === 'ingredient').length} ingrédients</div></div>
        <div class="card kpi ${low.length ? 'negative' : ''}"><div class="kpi-label">${icon('alert', 15)} À réapprovisionner</div><div class="kpi-value">${low.length}</div>
          <div class="kpi-sub">${low.length ? esc(low.slice(0, 3).map((i) => i.name).join(', ')) + (low.length > 3 ? '…' : '') : 'Tout est en ordre'}</div></div>
        <div class="card kpi"><div class="kpi-label">${icon('coins', 15)} Valeur du stock</div><div class="kpi-value">${money(value)}</div><div class="kpi-sub">au coût d'achat</div></div>
      </div>`;
    }

    function drawFilters() {
      const opts = { all: 'Tous', boisson: 'Boissons', ingredient: 'Ingrédients', autre: 'Autres', low: 'En alerte' };
      $('#filters').innerHTML = Object.entries(opts)
        .map(([k, l]) => `<button class="chip ${k === filter ? 'active' : ''}" data-filter="${k}">${l}</button>`)
        .join('');
    }

    function drawTable() {
      const q = search.toLowerCase();
      const list = items.filter(
        (i) =>
          (filter === 'all' || (filter === 'low' ? isLow(i) : i.category === filter)) &&
          (!q || i.name.toLowerCase().includes(q))
      );
      if (!list.length) {
        $('#table').innerHTML = items.length
          ? empty('Aucun article', 'Aucun article ne correspond à ce filtre.', 'search')
          : empty('Stock vide', 'Ajoutez vos boissons, ingrédients et autres articles.', 'box');
        return;
      }
      $('#table').innerHTML = `<div class="table-wrap"><table class="table">
        <thead><tr><th>Article</th><th class="hide-sm">Catégorie</th><th class="right">Quantité</th><th class="right hide-sm">Seuil</th><th class="right hide-sm">Coût unit.</th><th class="actions">Actions</th></tr></thead>
        <tbody>${list.map((i) => `
          <tr class="${isLow(i) ? 'alert-row' : ''}">
            <td><strong>${esc(i.name)}</strong>${isLow(i) ? ` ${badge(i.quantity <= 0 ? 'Épuisé' : 'Bas', 'danger')}` : ''}</td>
            <td class="hide-sm">${badge(STOCK_CATEGORIES[i.category] || i.category, i.category === 'boisson' ? 'info' : i.category === 'ingredient' ? 'gold' : '')}</td>
            <td class="right num"><strong>${qty(i.quantity)}</strong> <span class="faint">${esc(i.unit)}</span></td>
            <td class="right num hide-sm faint">${qty(i.alert_threshold)}</td>
            <td class="right num hide-sm">${money(i.unit_cost)}</td>
            <td class="actions">
              <button class="btn btn-sm btn-success" data-move="entree" data-id="${i.id}" title="Réapprovisionner">${icon('arrowIn', 15)}<span class="hide-sm">Entrée</span></button>
              <button class="btn btn-sm" data-move="sortie" data-id="${i.id}" title="Sortie / perte">${icon('arrowOut', 15)}</button>
              <button class="btn btn-sm" data-move="inventaire" data-id="${i.id}" title="Inventaire (quantité comptée)">${icon('clipboard', 15)}</button>
              <button class="btn btn-sm btn-ghost" data-edit="${i.id}" title="Modifier" aria-label="Modifier">${icon('edit', 15)}</button>
              <button class="btn btn-sm btn-ghost" data-delete="${i.id}" title="Archiver" aria-label="Archiver">${icon('trash', 15)}</button>
            </td>
          </tr>`).join('')}</tbody></table></div>`;
    }

    function drawAll() {
      drawKpis();
      drawFilters();
      drawTable();
    }

    async function loadMoves() {
      try {
        const moves = await get('/stock/movements?limit=200');
        $('#moves').innerHTML = moves.length
          ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Date</th><th>Article</th><th>Type</th><th class="right">Quantité</th><th class="right hide-sm">Coût</th><th class="hide-sm">Par</th><th class="hide-sm">Note</th></tr></thead>
            <tbody>${moves.map((m) => {
              const t = MOVEMENT_TYPES[m.type] || { label: m.type, cls: '' };
              return `<tr>
                <td class="num">${dateTime(m.created_at)}</td>
                <td>${esc(m.item_name)}</td>
                <td>${badge(t.label, t.cls)}</td>
                <td class="right num" style="color:${m.quantity < 0 ? 'var(--danger)' : 'var(--success)'}">${m.quantity > 0 ? '+' : ''}${qty(m.quantity)} ${esc(m.unit)}</td>
                <td class="right num hide-sm">${m.type === 'entree' ? money(m.quantity * m.unit_cost) : ''}</td>
                <td class="hide-sm faint">${esc(m.user_name || '')}</td>
                <td class="hide-sm faint">${esc(m.note)}</td>
              </tr>`;
            }).join('')}</tbody></table></div>`
          : empty('Aucun mouvement', 'Les entrées, sorties et ventes apparaîtront ici.', 'clipboard');
      } catch (err) {
        $('#moves').innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
      }
    }

    async function editItem(item = null) {
      const saved = await openModal({
        title: item ? `Modifier « ${item.name} »` : 'Nouvel article',
        body: `
          <div class="field"><label for="s-name">Nom</label><input class="input" id="s-name" name="name" required maxlength="80" value="${esc(item?.name)}" placeholder="Coca-Cola 33cl"></div>
          <div class="row">
            <div class="field"><label for="s-cat">Catégorie</label><select class="select" id="s-cat" name="category">
              ${Object.entries(STOCK_CATEGORIES).map(([k, l]) => `<option value="${k}" ${item?.category === k ? 'selected' : ''}>${l}</option>`).join('')}
            </select></div>
            <div class="field"><label for="s-unit">Unité</label><input class="input" id="s-unit" name="unit" required maxlength="20" list="units" value="${esc(item?.unit || 'bouteille')}">
              <datalist id="units"><option value="bouteille"><option value="canette"><option value="kg"><option value="g"><option value="L"><option value="pièce"><option value="paquet"><option value="carton"></datalist></div>
          </div>
          <div class="row">
            ${item ? '' : '<div class="field"><label for="s-qty">Quantité initiale</label><input class="input" id="s-qty" name="quantity" inputmode="decimal" value="0"></div>'}
            <div class="field"><label for="s-alert">Seuil d'alerte</label><input class="input" id="s-alert" name="alert_threshold" inputmode="decimal" value="${item?.alert_threshold ?? 0}"></div>
            <div class="field"><label for="s-cost">Coût unitaire</label><input class="input" id="s-cost" name="unit_cost" inputmode="decimal" value="${item?.unit_cost ?? 0}"></div>
          </div>
          ${item ? '<p class="hint faint">Pour changer la quantité, utilisez Entrée, Sortie ou Inventaire : chaque mouvement est tracé.</p>' : ''}`,
        onSubmit: (data) => (item ? put(`/stock/${item.id}`, data) : post('/stock', data)),
      });
      if (saved) {
        toast(item ? 'Article mis à jour' : 'Article ajouté');
        load();
      }
    }

    async function move(item, type) {
      const titles = {
        entree: `Réapprovisionner — ${item.name}`,
        sortie: `Sortie / perte — ${item.name}`,
        inventaire: `Inventaire — ${item.name}`,
      };
      const body = {
        entree: `
          <div class="row">
            <div class="field"><label for="m-qty">Quantité reçue (${esc(item.unit)})</label><input class="input" id="m-qty" name="quantity" required inputmode="decimal"></div>
            <div class="field"><label for="m-cost">Coût unitaire</label><input class="input" id="m-cost" name="unit_cost" inputmode="decimal" value="${item.unit_cost}"></div>
          </div>
          <div class="change-box"><span>Montant de l'achat</span><span class="num" id="m-total">${money(0)}</span></div>
          <p class="hint faint" style="margin-top:8px">Cet achat sera compté dans les charges du restaurant.</p>`,
        sortie: `<div class="field"><label for="m-qty">Quantité sortie (${esc(item.unit)})</label><input class="input" id="m-qty" name="quantity" required inputmode="decimal"><span class="hint">Disponible : ${qty(item.quantity)} ${esc(item.unit)}</span></div>`,
        inventaire: `<div class="field"><label for="m-qty">Quantité réellement comptée (${esc(item.unit)})</label><input class="input" id="m-qty" name="quantity" required inputmode="decimal" value="${item.quantity}"><span class="hint">Le système indique ${qty(item.quantity)} ${esc(item.unit)}.</span></div>`,
      }[type];
      const saved = await openModal({
        title: titles[type],
        submitLabel: 'Valider',
        body: `${body}<div class="field" style="margin-top:14px"><label for="m-note">Note</label><input class="input" id="m-note" name="note" maxlength="200" placeholder="${type === 'entree' ? 'Fournisseur, n° de facture…' : type === 'sortie' ? 'Casse, péremption, usage interne…' : ''}"></div>`,
        onOpen: (form) => {
          if (type !== 'entree') return;
          const upd = () => {
            const n = (v) => Number(String(v).replace(',', '.')) || 0;
            form.querySelector('#m-total').textContent = money(n(form.quantity.value) * n(form.unit_cost.value));
          };
          form.addEventListener('input', upd);
        },
        onSubmit: (data) => post(`/stock/${item.id}/movements`, { ...data, type }),
      });
      if (saved) {
        toast('Stock mis à jour');
        load();
        refreshBadges();
      }
    }

    root.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) {
        tab = t.dataset.tab;
        root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b === t));
        $('#items-view').classList.toggle('hidden', tab !== 'items');
        $('#moves-view').classList.toggle('hidden', tab !== 'moves');
        if (tab === 'moves') loadMoves();
        return;
      }
      const f = e.target.closest('[data-filter]');
      if (f) {
        filter = f.dataset.filter;
        drawFilters();
        drawTable();
        return;
      }
      const byId = (id) => items.find((i) => i.id === Number(id));
      const m = e.target.closest('[data-move]');
      if (m) return move(byId(m.dataset.id), m.dataset.move);
      const ed = e.target.closest('[data-edit]');
      if (ed) return editItem(byId(ed.dataset.edit));
      const d = e.target.closest('[data-delete]');
      if (d) {
        const item = byId(d.dataset.delete);
        if (!(await confirmDialog(`Archiver « ${item.name} » ? Il ne sera plus suivi, l'historique est conservé.`, { title: 'Archiver l\'article', confirmLabel: 'Archiver' }))) return;
        try {
          await del(`/stock/${item.id}`);
          toast('Article archivé');
          load();
          refreshBadges();
        } catch (err) {
          toast(err.message, 'error');
        }
      }
    });

    $('#q').addEventListener('input', (e) => {
      search = e.target.value.trim();
      drawTable();
    });

    async function load() {
      try {
        items = await get('/stock');
        drawAll();
        if (tab === 'moves') loadMoves();
      } catch (err) {
        $('#table').innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
      }
    }
    load();
  },
};
