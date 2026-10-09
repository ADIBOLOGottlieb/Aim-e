import { post } from '../api.js';
import { esc, icon } from '../ui.js';
import { toggleTheme, themeButtonContent } from '../app.js';

export default {
  render(root, onLogin) {
    root.innerHTML = `
      <div class="login">
        <section class="login-art">
          <div>
            <div class="brand-mark">${icon('utensils', 26)}</div>
            <h1>L'art de<br><em>recevoir</em>,<br>bien géré.</h1>
            <p>Commandes, carte, stock et comptes : tout le service de votre restaurant, en un seul endroit.</p>
          </div>
          <p class="quote">« La cuisine, c'est quand les choses ont le goût de ce qu'elles sont. »</p>
        </section>
        <section class="login-form-wrap">
          <button type="button" class="btn btn-ghost btn-sm login-theme" id="theme">${themeButtonContent()}</button>
          <form class="login-form" id="login" novalidate>
            <h2>Bienvenue</h2>
            <p class="muted">Connectez-vous pour prendre votre service.</p>
            <div class="form-error hidden" id="err" role="alert"></div>
            <div class="field">
              <label for="username">Identifiant</label>
              <input class="input" id="username" name="username" autocomplete="username" autocapitalize="none" required>
            </div>
            <div class="field">
              <label for="password">Mot de passe</label>
              <input class="input" id="password" name="password" type="password" autocomplete="current-password" required>
            </div>
            <button class="btn btn-primary btn-lg btn-block" type="submit">Se connecter</button>
          </form>
        </section>
      </div>`;

    root.querySelector('#theme').addEventListener('click', toggleTheme);
    const form = root.querySelector('#login');
    const err = root.querySelector('#err');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      err.classList.add('hidden');
      try {
        const { user } = await post('/auth/login', {
          username: form.username.value.trim(),
          password: form.password.value,
        });
        await onLogin(user);
      } catch (ex) {
        err.innerHTML = esc(ex.message);
        err.classList.remove('hidden');
        btn.disabled = false;
      }
    });
    root.querySelector('#username').focus();
  },
};
