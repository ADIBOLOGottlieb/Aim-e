import { get, post, del } from '../api.js';
import { isOwner } from '../state.js';
import {
  esc, icon, money, dateTime, toast, empty, loading, badge, openModal, confirmDialog,
  PERIODS, periodRange, rangeQuery, toDateInput,
} from '../ui.js';

const CATEGORIES = ['Fournisseurs', 'Salaires', 'Loyer', 'Électricité & eau', 'Gaz', 'Entretien', 'Transport', 'Taxes', 'Divers'];

export default {
  render(root, { actions }) {
    // Le gérant ne voit que les dépenses du jour ; le propriétaire choisit sa période.
    const owner = isOwner();
    let period = 'today';
    let rows = [];

    actions.innerHTML = `<button class="btn btn-primary" id="add">${icon('plus')} Nouvelle dépense</button>`;
    actions.querySelector('#add').addEventListener('click', add);

    root.innerHTML = `
      <p class="muted" style="margin-bottom:16px;max-width:720px">Enregistrez ici les dépenses hors stock (loyer, salaires, gaz, électricité…). Les achats de stock sont comptés automatiquement lors des réapprovisionnements.</p>
      ${owner ? '<div class="toolbar"><div class="chips" id="periods"></div></div>' : ''}
      <div id="sum"></div>
      <div class="card" id="list">${loading()}</div>`;

    const $ = (s) => root.querySelector(s);

    function drawPeriods() {
      if (!owner) return;
      $('#periods').innerHTML = ['today', 'week', 'month', 'lastmonth', 'year']
        .map((p) => `<button class="chip ${p === period ? 'active' : ''}" data-period="${p}">${PERIODS[p]}</button>`)
        .join('');
    }

    function draw() {
      const total = rows.reduce((s, r) => s + r.amount, 0);
      $('#sum').innerHTML = `<div class="kpis"><div class="card kpi"><div class="kpi-label">${icon('wallet', 15)} Total des dépenses</div><div class="kpi-value">${money(total)}</div><div class="kpi-sub">${rows.length} opération(s) · ${esc(PERIODS[period])}</div></div></div>`;
      $('#list').innerHTML = rows.length
        ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Date</th><th>Libellé</th><th class="hide-sm">Catégorie</th><th class="right">Montant</th><th class="hide-sm">Saisie par</th>${owner ? '<th></th>' : ''}</tr></thead>
          <tbody>${rows.map((r) => `<tr>
            <td class="num">${dateTime(r.spent_at)}</td>
            <td><strong>${esc(r.label)}</strong></td>
            <td class="hide-sm">${badge(r.category)}</td>
            <td class="right num"><strong>${money(r.amount)}</strong></td>
            <td class="hide-sm faint">${esc(r.user_name || '')}</td>
            ${owner ? `<td class="actions"><button class="btn btn-sm btn-ghost" data-delete="${r.id}" aria-label="Supprimer">${icon('trash', 15)}</button></td>` : ''}
          </tr>`).join('')}</tbody></table></div>`
        : empty('Aucune dépense', 'Rien d\'enregistré sur cette période.', 'wallet');
    }

    async function add() {
      const saved = await openModal({
        title: 'Nouvelle dépense',
        body: `
          <div class="field"><label for="e-label">Libellé</label><input class="input" id="e-label" name="label" required maxlength="120" placeholder="Bouteille de gaz, facture électricité…"></div>
          <div class="row">
            <div class="field"><label for="e-amount">Montant</label><input class="input" id="e-amount" name="amount" required inputmode="decimal"></div>
            <div class="field"><label for="e-cat">Catégorie</label><select class="select" id="e-cat" name="category">${CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label for="e-date">Date</label><input class="input" id="e-date" type="date" name="date" value="${toDateInput(new Date())}" max="${toDateInput(new Date())}"></div>`,
        onSubmit: (data) => {
          const today = toDateInput(new Date());
          // Date du jour : heure actuelle ; autre jour : midi local.
          const spent_at = !data.date || data.date === today ? new Date() : new Date(`${data.date}T12:00:00`);
          return post('/expenses', { label: data.label, amount: data.amount, category: data.category, spent_at: spent_at.toISOString() });
        },
      });
      if (saved) {
        toast('Dépense enregistrée');
        load();
      }
    }

    root.addEventListener('click', async (e) => {
      const p = e.target.closest('[data-period]');
      if (p) {
        period = p.dataset.period;
        drawPeriods();
        return load();
      }
      const d = e.target.closest('[data-delete]');
      if (d) {
        const r = rows.find((x) => x.id === Number(d.dataset.delete));
        if (!(await confirmDialog(`Supprimer la dépense « ${r.label} » (${money(r.amount)}) ?`, { title: 'Supprimer', confirmLabel: 'Supprimer' }))) return;
        try {
          await del(`/expenses/${r.id}`);
          toast('Dépense supprimée');
          load();
        } catch (err) {
          toast(err.message, 'error');
        }
      }
    });

    async function load() {
      try {
        rows = await get(`/expenses?${rangeQuery(periodRange(period))}`);
        draw();
      } catch (err) {
        $('#list').innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
      }
    }
    drawPeriods();
    load();
  },
};
