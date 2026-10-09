import { get, post } from '../api.js';
import { state } from '../state.js';
import {
  esc, icon, money, time, dateTime, elapsedLabel, minutesSince, toast, empty, loading, badge,
  openModal, confirmDialog, STATUS, METHODS, PERIODS, periodRange, rangeQuery,
} from '../ui.js';

const METHOD_ICONS = { especes: 'coins', carte: 'card', mobile: 'phone', autre: 'dots' };

export default {
  render(root, { actions, refreshBadges }) {
    let tab = 'open';
    let period = 'today';
    let timer = null;

    actions.innerHTML = `<a class="btn btn-primary" href="#/pos">${icon('plus')} Nouvelle commande</a>`;

    root.innerHTML = `
      <div class="tabs" role="tablist">
        <button class="tab active" data-tab="open" role="tab">À traiter</button>
        <button class="tab" data-tab="history" role="tab">Historique</button>
      </div>
      <div class="toolbar hidden" id="periods"></div>
      <div id="summary"></div>
      <div id="list">${loading()}</div>`;

    const $ = (s) => root.querySelector(s);

    function orderCard(o) {
      const st = STATUS[o.status] || { label: o.status, cls: '' };
      const late = o.status === 'en_cours' && minutesSince(o.created_at) >= 30;
      const canAct = o.status !== 'annulee';
      const buttons = [];
      if (o.status === 'en_cours') buttons.push(`<button class="btn btn-sm" data-serve="${o.id}">${icon('check', 15)} Servie</button>`);
      if (canAct && !o.paid) buttons.push(`<button class="btn btn-sm btn-primary" data-pay="${o.id}">${icon('coins', 15)} Encaisser</button>`);
      if (o.paid) buttons.push(`<button class="btn btn-sm btn-ghost" data-receipt="${o.id}" title="Reçu">${icon('printer', 15)}</button>`);
      if (canAct && !o.paid) buttons.push(`<button class="btn btn-sm btn-ghost" data-cancel="${o.id}" title="Annuler la commande" aria-label="Annuler la commande">${icon('x', 15)}</button>`);

      return `<article class="card order-card ${o.status === 'annulee' ? 'cancelled' : ''}">
        <div class="oc-head">
          <div>
            <div class="oc-num">N° ${o.id}</div>
            <div class="oc-table">${o.table_label ? esc(o.table_label) + ' · ' : ''}<span class="elapsed ${late ? 'late' : ''}">${tab === 'open' ? elapsedLabel(o.created_at) : dateTime(o.created_at)}</span></div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            ${badge(st.label, st.cls)}
            ${o.paid ? badge(`Payée · ${METHODS[o.payment_method] || ''}`, 'success') : o.status !== 'annulee' ? badge('Non payée', 'gold') : ''}
          </div>
        </div>
        <div class="oc-items"><ul>${o.items.map((i) => `<li><span><strong>${i.quantity} ×</strong> ${esc(i.name)}</span><span class="num muted">${money(i.unit_price * i.quantity)}</span></li>`).join('')}</ul></div>
        ${o.note ? `<div class="oc-note">${esc(o.note)}</div>` : ''}
        <div class="oc-foot">
          <div class="oc-total num">${money(o.total)}</div>
          <div class="oc-actions">${buttons.join('')}</div>
        </div>
      </article>`;
    }

    let current = [];

    async function load() {
      try {
        current = tab === 'open' ? await get('/orders/open') : await get(`/orders?${rangeQuery(periodRange(period))}`);
        draw();
      } catch (err) {
        $('#list').innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
      }
    }

    function draw() {
      if (tab === 'history') {
        const valid = current.filter((o) => o.status !== 'annulee');
        const paid = valid.filter((o) => o.paid);
        $('#summary').innerHTML = `<div class="kpis">
          <div class="card kpi"><div class="kpi-label">Commandes</div><div class="kpi-value">${valid.length}</div><div class="kpi-sub">${current.length - valid.length} annulée(s)</div></div>
          <div class="card kpi"><div class="kpi-label">Encaissé</div><div class="kpi-value">${money(paid.reduce((s, o) => s + o.total, 0))}</div><div class="kpi-sub">${paid.length} commande(s) payée(s)</div></div>
        </div>`;
      } else {
        $('#summary').innerHTML = '';
      }
      $('#list').innerHTML = current.length
        ? `<div class="order-grid">${current.map(orderCard).join('')}</div>`
        : tab === 'open'
          ? empty('Tout est à jour', 'Aucune commande en attente de service ou de paiement.', 'clipboard')
          : empty('Aucune commande', 'Rien sur cette période.', 'receipt');
    }

    function drawPeriods() {
      $('#periods').innerHTML = `<div class="chips">${['today', 'yesterday', 'week', 'month']
        .map((p) => `<button class="chip ${p === period ? 'active' : ''}" data-period="${p}">${PERIODS[p]}</button>`)
        .join('')}</div>`;
    }

    const find = (id) => current.find((o) => o.id === Number(id));

    async function pay(o) {
      const done = await openModal({
        title: `Encaisser la commande n° ${o.id}`,
        submitLabel: `Encaisser ${money(o.total)}`,
        body: `
          <p class="muted" style="margin-bottom:14px">${o.table_label ? esc(o.table_label) + ' · ' : ''}${o.items.length} ligne(s)</p>
          <div class="pay-methods">
            ${Object.entries(METHODS).map(([k, label], i) => `
              <div class="pay-method"><input type="radio" name="method" id="pm-${k}" value="${k}" ${i === 0 ? 'checked' : ''}>
              <label for="pm-${k}">${icon(METHOD_ICONS[k], 22)}${label}</label></div>`).join('')}
          </div>
          <div class="field" id="cash-field"><label for="given">Montant reçu (facultatif)</label><input class="input" id="given" inputmode="decimal" placeholder="${o.total}"></div>
          <div class="change-box"><span>Monnaie à rendre</span><span class="num" id="change">${money(0)}</span></div>`,
        onOpen: (form) => {
          const given = form.querySelector('#given');
          const update = () => {
            const isCash = form.method.value === 'especes';
            form.querySelector('#cash-field').classList.toggle('hidden', !isCash);
            form.querySelector('.change-box').classList.toggle('hidden', !isCash);
            const v = Number(String(given.value).replace(',', '.'));
            form.querySelector('#change').textContent = money(v > o.total ? v - o.total : 0);
          };
          form.addEventListener('input', update);
          form.addEventListener('change', update);
        },
        onSubmit: async (data) => {
          await post(`/orders/${o.id}/pay`, { method: data.method });
          return true;
        },
      });
      if (done) {
        toast(`Commande n° ${o.id} encaissée`);
        await load();
        refreshBadges();
      }
    }

    function receipt(o) {
      openModal({
        title: 'Reçu',
        submitLabel: 'Imprimer',
        cancelLabel: 'Fermer',
        body: `<div class="receipt">
          <h4>${esc(state.settings.restaurant_name)}</h4>
          <div class="center">Commande n° ${o.id}${o.table_label ? ' · ' + esc(o.table_label) : ''}</div>
          <div class="center">${dateTime(o.paid_at || o.created_at)}</div>
          <hr>
          ${o.items.map((i) => `<div class="line"><span>${i.quantity} × ${esc(i.name)}</span><span>${money(i.unit_price * i.quantity)}</span></div>`).join('')}
          <hr>
          <div class="line total"><span>TOTAL</span><span>${money(o.total)}</span></div>
          <div class="line"><span>Paiement</span><span>${esc(METHODS[o.payment_method] || '')}</span></div>
          <hr>
          <div class="center">Merci de votre visite !</div>
        </div>`,
        onSubmit: () => {
          window.print();
          return false;
        },
      });
    }

    root.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) {
        tab = t.dataset.tab;
        root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b === t));
        $('#periods').classList.toggle('hidden', tab !== 'history');
        drawPeriods();
        $('#list').innerHTML = loading();
        return load();
      }
      const p = e.target.closest('[data-period]');
      if (p) {
        period = p.dataset.period;
        drawPeriods();
        return load();
      }
      const btn = e.target.closest('button[data-serve], button[data-pay], button[data-cancel], button[data-receipt]');
      if (!btn) return;
      const { serve, cancel, receipt: rec } = btn.dataset;
      const o = find(btn.dataset.serve || btn.dataset.pay || btn.dataset.cancel || btn.dataset.receipt);
      if (!o) return;
      try {
        if (serve) {
          btn.disabled = true;
          await post(`/orders/${o.id}/serve`);
          toast(`Commande n° ${o.id} servie`);
          await load();
          refreshBadges();
        } else if (btn.dataset.pay) {
          await pay(o);
        } else if (rec) {
          receipt(o);
        } else if (cancel) {
          const ok = await confirmDialog(`Annuler la commande n° ${o.id} (${money(o.total)}) ? Les articles seront remis en stock.`, {
            title: 'Annuler la commande',
            confirmLabel: 'Annuler la commande',
          });
          if (!ok) return;
          await post(`/orders/${o.id}/cancel`);
          toast(`Commande n° ${o.id} annulée`);
          await load();
          refreshBadges();
        }
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
      }
    });

    load();
    timer = setInterval(() => {
      if (tab === 'open' && !document.getElementById('modal').open) load();
    }, 20000);
    return () => clearInterval(timer);
  },
};
