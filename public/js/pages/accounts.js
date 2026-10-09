import { get } from '../api.js';
import {
  esc, icon, money, loading, empty, PERIODS, periodRange, rangeQuery, toDateInput, addDays, METHODS, downloadCsv,
} from '../ui.js';
import { dailyChart, barList } from '../chart.js';

export default {
  render(root, { actions }) {
    let period = 'month';
    let range = periodRange(period);
    let data = null;

    actions.innerHTML = `<button class="btn" id="csv">${icon('download')} Exporter (CSV)</button>`;
    actions.querySelector('#csv').addEventListener('click', exportCsv);

    root.innerHTML = `
      <div class="toolbar">
        <div class="chips" id="periods"></div>
        <div class="spacer"></div>
        <div class="row" style="gap:8px">
          <input class="input" type="date" id="from" aria-label="Du" style="width:auto">
          <span class="faint">→</span>
          <input class="input" type="date" id="to" aria-label="Au" style="width:auto">
          <button class="btn btn-sm" id="apply">Appliquer</button>
        </div>
      </div>
      <div id="report">${loading()}</div>`;

    const $ = (s) => root.querySelector(s);

    function drawPeriods() {
      $('#periods').innerHTML = ['today', 'week', 'month', 'lastmonth', '90d', 'year']
        .map((p) => `<button class="chip ${p === period ? 'active' : ''}" data-period="${p}">${PERIODS[p]}</button>`)
        .join('');
      $('#from').value = toDateInput(range.from);
      $('#to').value = toDateInput(addDays(range.to, -1));
    }

    function draw() {
      const d = data;
      const resultCls = d.result >= 0 ? 'positive' : 'negative';
      const margin = d.revenue ? Math.round((d.result / d.revenue) * 100) : 0;
      $('#report').innerHTML = `
        <div class="kpis">
          <div class="card kpi accent"><div class="kpi-label">${icon('coins', 15)} Chiffre d'affaires</div><div class="kpi-value">${money(d.revenue)}</div><div class="kpi-sub">${d.orders} commande(s) · ticket moyen ${money(d.average_ticket)}</div></div>
          <div class="card kpi"><div class="kpi-label">${icon('box', 15)} Achats de stock</div><div class="kpi-value">${money(d.purchases)}</div><div class="kpi-sub">réapprovisionnements</div></div>
          <div class="card kpi"><div class="kpi-label">${icon('wallet', 15)} Autres dépenses</div><div class="kpi-value">${money(d.expenses)}</div><div class="kpi-sub">loyer, salaires, énergie…</div></div>
          <div class="card kpi ${resultCls}"><div class="kpi-label">${icon('chart', 15)} Résultat</div><div class="kpi-value">${money(d.result)}</div><div class="kpi-sub">${d.revenue ? `marge ${margin} %` : 'recettes − charges'}</div></div>
        </div>

        <div class="card" style="margin-bottom:18px">
          <div class="card-head"><h3>Recettes & charges par jour</h3></div>
          <div class="card-body">${d.daily.length > 1 ? dailyChart(d.daily) : `<p class="muted">Choisissez une période de plusieurs jours pour voir l'évolution.</p>`}</div>
        </div>

        <div class="grid grid-3">
          <div class="card">
            <div class="card-head"><h3>Plats les plus vendus</h3></div>
            <div class="card-body">${d.top_items.length
              ? barList(d.top_items, { label: (r) => `${r.name} (${r.qty})`, value: (r) => r.amount, format: money })
              : empty('Aucune vente', '', 'utensils')}</div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Modes de paiement</h3></div>
            <div class="card-body">${d.by_method.length
              ? barList(d.by_method, { label: (r) => METHODS[r.method] || r.method, value: (r) => r.amount, format: money })
              : empty('Aucun encaissement', '', 'coins')}</div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Dépenses par poste</h3></div>
            <div class="card-body">${d.by_expense_category.length || d.purchases
              ? barList([...(d.purchases ? [{ category: 'Achats de stock', amount: d.purchases }] : []), ...d.by_expense_category], { label: (r) => r.category, value: (r) => r.amount, format: money })
              : empty('Aucune dépense', '', 'wallet')}</div>
          </div>
        </div>

        <div class="kpis" style="margin-top:18px">
          <div class="card kpi"><div class="kpi-label">À encaisser (actuellement)</div><div class="kpi-value">${money(d.open_amount)}</div><div class="kpi-sub">${d.open_orders} commande(s) non payée(s)</div></div>
          <div class="card kpi"><div class="kpi-label">Valeur du stock</div><div class="kpi-value">${money(d.stock_value)}</div><div class="kpi-sub">au coût d'achat</div></div>
          <div class="card kpi"><div class="kpi-label">Commandes annulées</div><div class="kpi-value">${d.cancelled}</div><div class="kpi-sub">sur la période</div></div>
        </div>`;
    }

    function exportCsv() {
      if (!data) return;
      const rows = [['Jour', 'Commandes', 'Recettes', 'Charges', 'Résultat']];
      for (const d of data.daily) rows.push([d.day, d.orders, d.revenue, d.costs, Math.round((d.revenue - d.costs) * 100) / 100]);
      rows.push([]);
      rows.push(['Total', data.orders, data.revenue, data.purchases + data.expenses, data.result]);
      downloadCsv(`comptes_${toDateInput(range.from)}_${toDateInput(addDays(range.to, -1))}.csv`, rows);
    }

    async function load() {
      $('#report').innerHTML = loading();
      try {
        data = await get(`/reports/summary?${rangeQuery(range)}`);
        draw();
      } catch (err) {
        $('#report').innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
      }
    }

    root.addEventListener('click', (e) => {
      const p = e.target.closest('[data-period]');
      if (p) {
        period = p.dataset.period;
        range = periodRange(period);
        drawPeriods();
        load();
      }
    });

    $('#apply').addEventListener('click', () => {
      const from = new Date(`${$('#from').value}T00:00:00`);
      const to = addDays(new Date(`${$('#to').value}T00:00:00`), 1);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) return;
      period = null;
      range = { from, to };
      drawPeriods();
      load();
    });

    drawPeriods();
    load();
  },
};
