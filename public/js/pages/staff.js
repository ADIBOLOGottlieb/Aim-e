import { get, post, patch } from '../api.js';
import { state, ROLE_LABELS } from '../state.js';
import { esc, icon, dateTime, initials, toast, empty, loading, badge, openModal } from '../ui.js';

const ROLE_HELP = {
  gerant: 'Prend les commandes, encaisse, gère la carte, le stock et les dépenses.',
  proprietaire: 'Accès complet : comptes, personnel et paramètres.',
};

export default {
  render(root, { actions }) {
    let users = [];

    actions.innerHTML = `<button class="btn btn-primary" id="add">${icon('plus')} Ajouter un membre</button>`;
    actions.querySelector('#add').addEventListener('click', () => edit());

    root.innerHTML = `<div class="card" id="list">${loading()}</div>`;
    const $ = (s) => root.querySelector(s);

    function draw() {
      $('#list').innerHTML = users.length
        ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Membre</th><th>Rôle</th><th class="hide-sm">Créé le</th><th>Statut</th><th></th></tr></thead>
          <tbody>${users.map((u) => `<tr>
            <td><div class="row" style="gap:10px;flex-wrap:nowrap"><div class="avatar" style="width:32px;height:32px;font-size:12px">${esc(initials(u.full_name))}</div>
              <div><strong>${esc(u.full_name)}</strong>${u.id === state.user.id ? ' <span class="faint">(vous)</span>' : ''}<div class="faint" style="font-size:12.5px">@${esc(u.username)}</div></div></div></td>
            <td>${badge(ROLE_LABELS[u.role] || u.role, u.role === 'proprietaire' ? 'gold' : 'info')}</td>
            <td class="hide-sm faint">${dateTime(u.created_at)}</td>
            <td>${u.active ? badge('Actif', 'success') : badge('Désactivé')}</td>
            <td class="actions"><button class="btn btn-sm btn-ghost" data-edit="${u.id}" aria-label="Modifier">${icon('edit', 15)}</button></td>
          </tr>`).join('')}</tbody></table></div>`
        : empty('Aucun membre', '', 'users');
    }

    function roleOptions(selected) {
      return Object.entries(ROLE_LABELS)
        .map(([k, l]) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${l}</option>`)
        .join('');
    }

    async function edit(u = null) {
      const self = u && u.id === state.user.id;
      const saved = await openModal({
        title: u ? `Modifier ${u.full_name}` : 'Nouveau membre',
        body: `
          <div class="field"><label for="u-name">Nom complet</label><input class="input" id="u-name" name="full_name" required maxlength="80" value="${esc(u?.full_name)}"></div>
          ${u ? '' : `<div class="field"><label for="u-login">Identifiant de connexion</label><input class="input" id="u-login" name="username" required maxlength="40" pattern="[a-zA-Z0-9._\\-]{3,40}" autocapitalize="none" placeholder="ex. awa.gerante"><span class="hint">Lettres, chiffres, point, tiret — 3 caractères minimum.</span></div>`}
          <div class="field"><label for="u-role">Rôle</label><select class="select" id="u-role" name="role" ${self ? 'disabled' : ''}>${roleOptions(u?.role || 'gerant')}</select>
            <span class="hint" id="role-help">${ROLE_HELP[u?.role || 'gerant']}</span></div>
          <div class="field"><label for="u-pw">${u ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe'}</label><input class="input" id="u-pw" type="password" name="password" ${u ? '' : 'required'} minlength="8" autocomplete="new-password"></div>
          ${u && !self ? `<div class="row" style="justify-content:space-between"><label for="u-active" style="font-weight:600">Compte actif</label><label class="switch"><input type="checkbox" id="u-active" name="active" ${u.active ? 'checked' : ''}><span></span></label></div>` : ''}`,
        onOpen: (form) => {
          form.role.addEventListener('change', () => {
            form.querySelector('#role-help').textContent = ROLE_HELP[form.role.value];
          });
        },
        onSubmit: (data, form) => {
          if (!u) return post('/users', data);
          const body = { full_name: data.full_name };
          if (!self) {
            body.role = form.role.value;
            body.active = form.active ? form.active.checked : u.active;
          }
          if (data.password) body.password = data.password;
          return patch(`/users/${u.id}`, body);
        },
      });
      if (saved) {
        toast(u ? 'Membre mis à jour' : 'Membre ajouté');
        load();
      }
    }

    root.addEventListener('click', (e) => {
      const ed = e.target.closest('[data-edit]');
      if (ed) edit(users.find((u) => u.id === Number(ed.dataset.edit)));
    });

    async function load() {
      try {
        users = await get('/users');
        draw();
      } catch (err) {
        $('#list').innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
      }
    }
    load();
  },
};
