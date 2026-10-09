import { put } from '../api.js';
import { state } from '../state.js';
import { esc, toast } from '../ui.js';
import { reloadShell } from '../app.js';

export default {
  render(root) {
    root.innerHTML = `
      <div class="card card-pad" style="max-width:560px">
        <h2 style="font-size:26px;margin-bottom:16px">Le restaurant</h2>
        <form id="settings">
          <div class="form-error hidden" id="err" role="alert"></div>
          <div class="field"><label for="r-name">Nom du restaurant</label><input class="input" id="r-name" name="restaurant_name" required maxlength="80" value="${esc(state.settings.restaurant_name)}"></div>
          <div class="field"><label for="r-cur">Devise</label><input class="input" id="r-cur" name="currency" required maxlength="10" list="currencies" value="${esc(state.settings.currency)}">
            <datalist id="currencies"><option value="FCFA"><option value="€"><option value="$"><option value="MAD"><option value="DA"><option value="GNF"><option value="CDF"></datalist>
            <span class="hint">Affichée après chaque montant.</span></div>
          <button class="btn btn-primary" type="submit">Enregistrer</button>
        </form>
      </div>`;

    const form = root.querySelector('#settings');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = root.querySelector('#err');
      err.classList.add('hidden');
      try {
        state.settings = await put('/settings', Object.fromEntries(new FormData(form)));
        toast('Paramètres enregistrés');
        reloadShell();
        location.hash = '#/settings';
      } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove('hidden');
      }
    });
  },
};
