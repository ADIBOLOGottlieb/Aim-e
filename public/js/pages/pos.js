import { get, post } from '../api.js';
import { esc, icon, money, toast, empty } from '../ui.js';

export default {
  render(root, { refreshBadges }) {
    let menu = [];
    let category = 'Tout';
    let search = '';
    const ticket = new Map(); // menu_item_id -> quantité

    root.innerHTML = `
      <div class="pos">
        <section>
          <div class="pos-toolbar">
            <div class="chips" id="cats" role="tablist" aria-label="Catégories"></div>
            <div class="spacer"></div>
            <label class="search">${icon('search', 16)}<input class="input" id="q" type="search" placeholder="Rechercher un plat…" aria-label="Rechercher un plat"></label>
          </div>
          <div id="dishes"></div>
        </section>
        <aside class="card ticket" id="ticket" aria-label="Commande en cours">
          <div class="ticket-head">
            <h3>Nouvelle commande</h3>
            <div class="faint">— Bon de commande —</div>
            <input class="input" id="table" placeholder="Table, client ou « à emporter »" maxlength="40" aria-label="Table ou client">
          </div>
          <div class="ticket-lines" id="lines"></div>
          <div class="ticket-foot">
            <textarea class="textarea" id="note" rows="2" maxlength="300" placeholder="Note (sans piment, bien cuit…)" aria-label="Note"></textarea>
            <div class="ticket-total"><span>Total</span><strong id="total">${money(0)}</strong></div>
            <button class="btn btn-primary btn-lg btn-block" id="send" disabled>${icon('check')} Enregistrer la commande</button>
            <button class="btn btn-ghost btn-block" id="clear" style="margin-top:6px">Vider le ticket</button>
          </div>
        </aside>
      </div>
      <button class="pos-mobile-bar hidden" id="mobile-bar" type="button"><span id="mobile-count"></span><strong id="mobile-total"></strong></button>`;

    const $ = (s) => root.querySelector(s);

    const byId = (id) => menu.find((m) => m.id === id);

    // Quantité maximale commandable (suivi de stock) en tenant compte du ticket.
    function remaining(item) {
      if (item.portions === null) return Infinity;
      return item.portions - (ticket.get(item.id) || 0);
    }

    function categories() {
      return ['Tout', ...new Set(menu.map((m) => m.category))];
    }

    function renderCats() {
      $('#cats').innerHTML = categories()
        .map((c) => `<button type="button" class="chip ${c === category ? 'active' : ''}" data-cat="${esc(c)}" role="tab" aria-selected="${c === category}">${esc(c)}</button>`)
        .join('');
    }

    function dishCard(m) {
      const count = ticket.get(m.id) || 0;
      const out = !m.available || remaining(m) <= 0;
      let stockBadge = '';
      if (!m.available) stockBadge = '<span class="badge">Indisponible</span>';
      else if (m.portions === 0) stockBadge = '<span class="badge danger">Rupture</span>';
      else if (m.portions !== null && m.portions <= 5) stockBadge = `<span class="badge warning">Reste ${m.portions}</span>`;
      return `<button type="button" class="dish ${out ? 'disabled' : ''}" data-id="${m.id}" ${out ? 'aria-disabled="true"' : ''}>
          ${count ? `<span class="dish-count">${count}</span>` : ''}
          <span class="dish-name">${esc(m.name)}</span>
          ${m.description ? `<span class="dish-desc">${esc(m.description)}</span>` : ''}
          <span class="dish-price">${money(m.price)}</span>
          ${stockBadge && !count ? `<span class="dish-stock">${stockBadge}</span>` : ''}
        </button>`;
    }

    function renderDishes() {
      const q = search.toLowerCase();
      const list = menu.filter(
        (m) => (category === 'Tout' || m.category === category) && (!q || m.name.toLowerCase().includes(q))
      );
      if (!list.length) {
        $('#dishes').innerHTML = menu.length
          ? empty('Aucun plat trouvé', 'Essayez une autre catégorie ou recherche.', 'search')
          : empty('La carte est vide', 'Ajoutez des plats dans « La carte » pour commencer.', 'book');
        return;
      }
      const groups = {};
      for (const m of list) (groups[m.category] ||= []).push(m);
      $('#dishes').innerHTML = Object.entries(groups)
        .map(([cat, items]) => `<div class="dish-group"><h3>${esc(cat)}</h3><div class="dish-grid">${items.map(dishCard).join('')}</div></div>`)
        .join('');
    }

    function total() {
      let t = 0;
      for (const [id, n] of ticket) t += (byId(id)?.price || 0) * n;
      return t;
    }

    function renderTicket() {
      const lines = [...ticket.entries()];
      $('#lines').innerHTML = lines.length
        ? lines
            .map(([id, n]) => {
              const m = byId(id);
              return `<div class="ticket-line">
                <div><div class="name">${esc(m.name)}</div><div class="unit">${money(m.price)} l'unité</div></div>
                <div class="price">${money(m.price * n)}</div>
                <div></div>
                <div class="qty-ctrl">
                  <button type="button" data-dec="${id}" aria-label="Retirer un ${esc(m.name)}">${icon(n === 1 ? 'trash' : 'minus', 14)}</button>
                  <span>${n}</span>
                  <button type="button" data-inc="${id}" aria-label="Ajouter un ${esc(m.name)}">${icon('plus', 14)}</button>
                </div>
              </div>`;
            })
            .join('')
        : '<div class="ticket-empty"><span class="script">Le ticket est vide</span>Touchez un plat pour l\'ajouter.</div>';
      const t = total();
      const count = lines.reduce((s, [, n]) => s + n, 0);
      $('#total').textContent = money(t);
      $('#send').disabled = !lines.length;
      $('#mobile-bar').classList.toggle('hidden', !lines.length);
      $('#mobile-count').textContent = `${count} article${count > 1 ? 's' : ''} · Voir le ticket`;
      $('#mobile-total').textContent = money(t);
    }

    function add(id) {
      const m = byId(id);
      if (!m || !m.available) return;
      if (remaining(m) <= 0) {
        toast(`Stock insuffisant pour « ${m.name} »`, 'error');
        return;
      }
      ticket.set(id, (ticket.get(id) || 0) + 1);
      renderDishes();
      renderTicket();
      const card = root.querySelector(`.dish[data-id="${id}"]`);
      if (card) card.classList.add('pulse');
    }

    function dec(id) {
      const n = (ticket.get(id) || 0) - 1;
      if (n <= 0) ticket.delete(id);
      else ticket.set(id, n);
      renderDishes();
      renderTicket();
    }

    root.addEventListener('click', (e) => {
      const dish = e.target.closest('.dish');
      if (dish) return add(Number(dish.dataset.id));
      const cat = e.target.closest('[data-cat]');
      if (cat) {
        category = cat.dataset.cat;
        renderCats();
        renderDishes();
        return;
      }
      const inc = e.target.closest('[data-inc]');
      if (inc) return add(Number(inc.dataset.inc));
      const d = e.target.closest('[data-dec]');
      if (d) return dec(Number(d.dataset.dec));
    });

    $('#q').addEventListener('input', (e) => {
      search = e.target.value.trim();
      renderDishes();
    });

    $('#clear').addEventListener('click', () => {
      ticket.clear();
      $('#note').value = '';
      $('#table').value = '';
      renderDishes();
      renderTicket();
    });

    $('#mobile-bar').addEventListener('click', () => $('#ticket').scrollIntoView({ behavior: 'smooth' }));

    $('#send').addEventListener('click', async () => {
      const btn = $('#send');
      btn.disabled = true;
      try {
        const order = await post('/orders', {
          table_label: $('#table').value,
          note: $('#note').value,
          items: [...ticket.entries()].map(([menu_item_id, quantity]) => ({ menu_item_id, quantity })),
        });
        toast(`Commande n° ${order.id} enregistrée — ${money(order.total)}`);
        ticket.clear();
        $('#note').value = '';
        $('#table').value = '';
        await load();
        refreshBadges();
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
        await load();
      }
    });

    async function load() {
      try {
        menu = await get('/menu');
        // Retire du ticket ce qui n'est plus disponible.
        for (const id of ticket.keys()) if (!byId(id)) ticket.delete(id);
        if (!categories().includes(category)) category = 'Tout';
        renderCats();
        renderDishes();
        renderTicket();
      } catch (err) {
        $('#dishes').innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
      }
    }

    load();
  },
};
