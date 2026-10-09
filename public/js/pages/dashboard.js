import { get } from '../api.js';
import { state, isOwner } from '../state.js';
import { esc, icon, money, qty, elapsedLabel, empty, loading, badge, periodRange, rangeQuery, STATUS } from '../ui.js';
import { dailyChart } from '../chart.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 5 || h >= 18) return 'Bonsoir';
  return 'Bonjour';
}

export default {
  render(root, { actions }) {
    actions.innerHTML = `<a class="btn btn-primary" href="#/pos">${icon('plus')} Nouvelle commande</a>`;
    root.innerHTML = loading();

    (async () => {
      try {
        const owner = isOwner();
        const [today, open, stock, week] = await Promise.all([
          get(`/reports/summary?${rangeQuery(periodRange('today'))}`),
          get('/orders/open'),
          get('/stock'),
          owner ? get(`/reports/summary?${rangeQuery(periodRange('week'))}`) : Promise.resolve(null),
        ]);
        const low = stock.filter((i) => i.quantity <= i.alert_threshold);
        const inService = open.filter((o) => o.status === 'en_cours');
        const toCash = open.filter((o) => !o.paid);

        root.innerHTML = `
          <h2 class="section-title" style="margin-top:0">${greeting()}, ${esc(state.user.full_name.split(' ')[0])}.</h2>
          <div class="kpis">
            <div class="card kpi accent"><div class="kpi-label">${icon('coins', 15)} Recettes du jour</div><div class="kpi-value">${money(today.revenue)}</div><div class="kpi-sub">${today.orders} commande(s) encaissée(s)</div></div>
            <div class="card kpi"><div class="kpi-label">${icon('bell', 15)} En service</div><div class="kpi-value">${inService.length}</div><div class="kpi-sub">commande(s) à servir</div></div>
            <div class="card kpi"><div class="kpi-label">${icon('receipt', 15)} À encaisser</div><div class="kpi-value">${money(today.open_amount)}</div><div class="kpi-sub">${toCash.length} commande(s) non payée(s)</div></div>
            <div class="card kpi ${low.length ? 'negative' : ''}"><div class="kpi-label">${icon('alert', 15)} Alertes stock</div><div class="kpi-value">${low.length}</div><div class="kpi-sub">article(s) sous le seuil</div></div>
          </div>

          ${owner && week ? `
          <div class="card" style="margin-bottom:18px">
            <div class="card-head"><h3>Les 7 derniers jours</h3>
              <div class="row" style="gap:18px">
                <span class="muted">Recettes <strong class="num" style="color:var(--text)">${money(week.revenue)}</strong></span>
                <span class="muted">Résultat <strong class="num" style="color:${week.result >= 0 ? 'var(--success)' : 'var(--danger)'}">${money(week.result)}</strong></span>
                <a class="btn btn-sm" href="#/accounts">Voir les comptes</a>
              </div>
            </div>
            <div class="card-body">${dailyChart(week.daily)}</div>
          </div>` : ''}

          <div class="grid grid-2">
            <div class="card">
              <div class="card-head"><h3>Commandes ouvertes</h3><a class="btn btn-sm btn-ghost" href="#/orders">Tout voir</a></div>
              <div class="card-body">
                ${open.length ? open.slice(0, 7).map((o) => `
                  <div class="list-row">
                    <strong class="num" style="min-width:52px">N° ${o.id}</strong>
                    <div style="flex:1;min-width:0">
                      <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(o.items.map((i) => `${i.quantity}× ${i.name}`).join(', '))}</div>
                      <div class="faint" style="font-size:12.5px">${o.table_label ? esc(o.table_label) + ' · ' : ''}${elapsedLabel(o.created_at)}</div>
                    </div>
                    ${badge(STATUS[o.status]?.label || o.status, STATUS[o.status]?.cls)}
                    <span class="num" style="font-weight:700">${money(o.total)}</span>
                  </div>`).join('') : empty('Aucune commande ouverte', '', 'clipboard')}
              </div>
            </div>
            <div class="card">
              <div class="card-head"><h3>À réapprovisionner</h3><a class="btn btn-sm btn-ghost" href="#/stock">Gérer le stock</a></div>
              <div class="card-body">
                ${low.length ? low.slice(0, 8).map((i) => `
                  <div class="list-row">
                    <span style="flex:1">${esc(i.name)}</span>
                    <span class="num faint">seuil ${qty(i.alert_threshold)}</span>
                    ${badge(`${qty(i.quantity)} ${i.unit}`, i.quantity <= 0 ? 'danger' : 'warning')}
                  </div>`).join('') : empty('Stock en ordre', 'Aucun article sous son seuil d\'alerte.', 'check')}
              </div>
            </div>
          </div>

          ${today.top_items.length ? `
          <div class="card" style="margin-top:18px">
            <div class="card-head"><h3>Les plus demandés aujourd'hui</h3></div>
            <div class="card-body">${today.top_items.slice(0, 5).map((t, i) => `
              <div class="list-row"><span class="faint num" style="width:22px">${i + 1}.</span><span class="dotted-price" style="flex:1"><span>${esc(t.name)}</span><span class="num">${t.qty} vendu(s)</span></span></div>`).join('')}
            </div>
          </div>` : ''}`;
      } catch (err) {
        root.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
      }
    })();
  },
};
