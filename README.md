# La Belle Table — gestion de restaurant

Application web de gestion d'un restaurant : prise de commande, carte, stock (boissons, ingrédients, autres articles), dépenses et comptes, avec deux rôles et un thème clair / sombre.

## Rôles

| Rôle | Accès |
|------|-------|
| **Gérant** | Prise de commande, commandes (servir, encaisser, annuler), carte, stock, dépenses du jour, tableau de bord du jour |
| **Propriétaire** | Tout ce que fait le gérant **+** comptes sur n'importe quelle période, historique des dépenses, personnel, paramètres |

## Fonctionnement

1. **Prise de commande** : le gérant touche un plat (ex. « Spaghetti bolognaise ») et il s'ajoute au ticket. Il indique la table, puis enregistre la commande.
2. À l'enregistrement, le **stock est décompté** automatiquement selon la recette du plat (ex. 1 Coca-Cola vendu = 1 bouteille « Coca-Cola 33cl » en moins). Si le stock est insuffisant, la commande est refusée.
3. Dans **Commandes**, le gérant marque la commande *servie*, puis l'**encaisse** (espèces avec calcul de la monnaie, carte, mobile money). Un reçu imprimable est disponible.
4. Une commande non payée peut être **annulée** : le stock est alors restitué.
5. **Stock** : entrées (réapprovisionnement avec coût d'achat), sorties / pertes et inventaires. Chaque mouvement est tracé et des alertes signalent les articles sous leur seuil.
6. **Comptes** (propriétaire) : chiffre d'affaires, achats de stock, dépenses, résultat, graphique jour par jour, plats les plus vendus, modes de paiement et export CSV.

## Déploiement sur Render

Le fichier [`render.yaml`](render.yaml) crée un service web Node.js et une base PostgreSQL.

1. Poussez ce dépôt sur GitHub.
2. Sur [dashboard.render.com](https://dashboard.render.com), choisissez **New → Blueprint** et sélectionnez le dépôt.
3. Render demande la valeur de **`OWNER_PASSWORD`** : c'est le mot de passe du compte propriétaire créé au premier démarrage (identifiant : `proprietaire`).
4. Validez. Une fois le déploiement terminé, ouvrez l'URL du service et connectez-vous.
5. Dans **Personnel**, créez les comptes des gérants. Dans **Paramètres**, réglez le nom du restaurant et la devise.

> Plan gratuit Render : le service s'endort après 15 minutes d'inactivité (premier chargement lent), et la base PostgreSQL gratuite expire au bout de 30 jours. Pour un usage réel, passez la base sur un plan payant.

### Variables d'environnement

| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | Connexion PostgreSQL (fournie automatiquement par Render) |
| `JWT_SECRET` | Secret des sessions (généré automatiquement par Render) |
| `OWNER_USERNAME` / `OWNER_PASSWORD` | Compte propriétaire créé au premier démarrage |
| `RESTAURANT_NAME`, `CURRENCY` | Valeurs initiales des paramètres |
| `SEED_DEMO` | `true` pour ajouter une carte, un stock et un compte gérant de démonstration |
| `PGSSL` | `true` si la base est externe et exige SSL |

## Développement local

```bash
npm install
npm run dev
```

Sans `DATABASE_URL`, l'application utilise une base **en mémoire** préremplie (données perdues à l'arrêt) avec les comptes :

- `proprietaire` / `proprietaire123`
- `gerant` / `gerant123`

Pour utiliser PostgreSQL en local, copiez `.env.example`, définissez `DATABASE_URL`, puis lancez `npm start`.

## Structure

```
server/
  index.js        serveur Express, sécurité, routes
  db.js           connexion PostgreSQL, migration, données initiales
  schema.sql      tables
  auth.js         sessions (cookie JWT) et contrôle des rôles
  routes/         auth, users, settings, menu, stock, orders, expenses, reports
public/
  index.html      application (une seule page)
  css/style.css   thème clair / sombre
  js/             routeur, API, composants et pages
render.yaml       blueprint Render
```
