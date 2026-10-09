import { get, post, put, patch, del } from '../api.js';
import { esc, icon, money, qty, toast, empty, loading, badge, openModal, confirmDialog } from '../ui.js';

const DEFAULT_CATEGORIES = ['Entrées', 'Plats', 'Accompagnements', 'Desserts', 'Boissons'];

export default {
  render(root, { actions }) {
    let menu = [];
    let stock = [];

    actions.innerHTML = `<button class="btn btn-primary" id="add">${icon('plus')} Nouveau plat</button>`;
    actions.querySelector('#add').addEventListener('click', () => edit());

    root.innerHTML = `
      <p class="muted" style="margin-bottom:18px;max-width:720px">
        Définissez les plats proposés et activez ou retirez-les du service en un geste.
        Liez un plat à des articles du stock (recette) pour que chaque vente décompte automatiquement le stock.
      </p>
      <div id="list">${loading()}</div>`;

    const $ = (s) => root.querySelector(s);

    function recipeText(m) {
      if (!m.components.length) return '';
      return m.components.map((c) => `${qty(c.quantity)} ${esc(c.unit)} ${esc(c.name)}`).join(' · ');
    }

    function draw() {
      if (!menu.length) {
        $('#list').innerHTML = `<div class="card">${empty('Votre carte est vide', 'Ajoutez votre premier plat avec « Nouveau plat ».', 'book')}</div>`;
        return;
      }
      const groups = {};
      for (const m of menu) (groups[m.category] ||= []).push(m);
      $('#list').innerHTML = `<div class="card card-pad">${Object.entries(groups)
        .map(([cat, items]) => `
          <section class="menu-cat">
            <h2 class="menu-cat-title">${esc(cat)}</h2>
            ${items.map((m) => `
              <div class="menu-item ${m.available ? '' : 'off'}">
                <div>
                  <div class="mi-name">${esc(m.name)}
                    ${m.portions === 0 ? badge('Rupture de stock', 'danger') : m.portions !== null && m.portions <= 5 ? badge(`${m.portions} portion(s)`, 'warning') : ''}
                  </div>
                  ${m.description ? `<div class="mi-desc">${esc(m.description)}</div>` : ''}
                  ${m.components.length ? `<div class="mi-recipe">${icon('box', 13)} ${recipeText(m)}</div>` : ''}
                </div>
                <div class="mi-side">
                  <span class="mi-price">${money(m.price)}</span>
                  <label class="switch" title="${m.available ? 'Disponible' : 'Indisponible'}">
                    <input type="checkbox" data-toggle="${m.id}" ${m.available ? 'checked' : ''} aria-label="Disponible : ${esc(m.name)}"><span></span>
                  </label>
                  <button class="btn btn-ghost icon-btn" data-edit="${m.id}" aria-label="Modifier ${esc(m.name)}">${icon('edit', 16)}</button>
                  <button class="btn btn-ghost icon-btn" data-delete="${m.id}" aria-label="Retirer ${esc(m.name)}">${icon('trash', 16)}</button>
                </div>
              </div>`).join('')}
          </section>`)
        .join('')}</div>`;
    }

    function componentRow(c = {}) {
      return `<div class="comp-row">
        <select class="select" name="comp_stock" aria-label="Article de stock">
          <option value="">— Article —</option>
          ${stock.map((s) => `<option value="${s.id}" ${s.id === c.stock_item_id ? 'selected' : ''}>${esc(s.name)} (${esc(s.unit)})</option>`).join('')}
        </select>
        <input class="input" name="comp_qty" inputmode="decimal" placeholder="Qté" value="${c.quantity ?? ''}" aria-label="Quantité par portion">
        <button type="button" class="btn btn-ghost icon-btn" data-remove-comp aria-label="Retirer">${icon('x', 16)}</button>
      </div>`;
    }

    async function edit(m = null) {
      if (!stock.length) stock = await get('/stock').catch(() => []);
      const cats = [...new Set([...DEFAULT_CATEGORIES, ...menu.map((x) => x.category)])];
      const saved = await openModal({
        title: m ? `Modifier « ${m.name} »` : 'Nouveau plat',
        wide: true,
        body: `
          <div class="row">
            <div class="field" style="flex:2"><label for="f-name">Nom</label><input class="input" id="f-name" name="name" required maxlength="80" value="${esc(m?.name)}" placeholder="Spaghetti bolognaise"></div>
            <div class="field"><label for="f-price">Prix</label><input class="input" id="f-price" name="price" required inputmode="decimal" value="${m?.price ?? ''}"></div>
          </div>
          <div class="row">
            <div class="field"><label for="f-cat">Catégorie</label><input class="input" id="f-cat" name="category" required maxlength="40" list="cats" value="${esc(m?.category || 'Plats')}">
              <datalist id="cats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
            <div class="field" style="flex:0 0 auto;justify-content:flex-end"><label>Disponible</label>
              <label class="switch"><input type="checkbox" name="available" ${m?.available === false ? '' : 'checked'}><span></span></label></div>
          </div>
          <div class="field"><label for="f-desc">Description</label><input class="input" id="f-desc" name="description" maxlength="300" value="${esc(m?.description)}" placeholder="Sauce maison, parmesan…"></div>
          <div class="field">
            <label>Recette / articles consommés par portion</label>
            <span class="hint">Ex. : Coca-Cola → 1 bouteille de « Coca-Cola 33cl ». Laisser vide si le plat n'est pas suivi en stock.</span>
            <div id="comps" style="margin-top:8px">${(m?.components || []).map(componentRow).join('')}</div>
            <button type="button" class="btn btn-sm" id="add-comp" style="align-self:flex-start">${icon('plus', 14)} Ajouter un article</button>
          </div>`,
        onOpen: (form) => {
          form.querySelector('#add-comp').addEventListener('click', () => {
            if (!stock.length) {
              toast('Ajoutez d\'abord des articles dans le Stock', 'error');
              return;
            }
            form.querySelector('#comps').insertAdjacentHTML('beforeend', componentRow());
          });
          form.addEventListener('click', (e) => {
            const r = e.target.closest('[data-remove-comp]');
            if (r) r.closest('.comp-row').remove();
          });
        },
        onSubmit: async (data, form) => {
          const components = [...form.querySelectorAll('.comp-row')]
            .map((row) => ({ stock_item_id: Number(row.querySelector('select').value), quantity: row.querySelector('input').value }))
            .filter((c) => c.stock_item_id);
          const body = {
            name: data.name,
            price: data.price,
            category: data.category,
            description: data.description,
            available: form.available.checked,
            components,
          };
          return m ? put(`/menu/${m.id}`, body) : post('/menu', body);
        },
      });
      if (saved) {
        toast(m ? 'Plat mis à jour' : 'Plat ajouté à la carte');
        load();
      }
    }

    root.addEventListener('change', async (e) => {
      const t = e.target.closest('[data-toggle]');
      if (!t) return;
      const m = menu.find((x) => x.id === Number(t.dataset.toggle));
      try {
        await patch(`/menu/${m.id}/available`, { available: t.checked });
        m.available = t.checked;
        toast(`${m.name} : ${t.checked ? 'disponible' : 'retiré du service'}`);
        draw();
      } catch (err) {
        t.checked = !t.checked;
        toast(err.message, 'error');
      }
    });

    root.addEventListener('click', async (e) => {
      const ed = e.target.closest('[data-edit]');
      if (ed) return edit(menu.find((x) => x.id === Number(ed.dataset.edit)));
      const d = e.target.closest('[data-delete]');
      if (d) {
        const m = menu.find((x) => x.id === Number(d.dataset.delete));
        if (!(await confirmDialog(`Retirer « ${m.name} » de la carte ? L'historique des ventes est conservé.`, { title: 'Retirer le plat', confirmLabel: 'Retirer' }))) return;
        try {
          await del(`/menu/${m.id}`);
          toast('Plat retiré de la carte');
          load();
        } catch (err) {
          toast(err.message, 'error');
        }
      }
    });

    async function load() {
      try {
        [menu, stock] = await Promise.all([get('/menu'), get('/stock')]);
        draw();
      } catch (err) {
        $('#list').innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
      }
    }
    load();
  },
};
