const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { init } = require('./db');
const { requireAuth } = require('./auth');
const { HttpError } = require('./util');

const app = express();
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/healthz', (req, res) => res.json({ ok: true }));

// Protection CSRF simple : toute écriture doit venir de notre propre fetch().
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.get('X-Requested-With') !== 'fetch') {
    throw new HttpError(403, 'Requête refusée');
  }
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api', requireAuth);
app.use('/api/settings', require('./routes/settings'));
app.use('/api/users', require('./routes/users'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/reports', require('./routes/reports'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue' }));

app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide' });
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

const PORT = process.env.PORT || 3000;

init()
  .then(() => {
    app.listen(PORT, () => console.log(`Restaurant prêt sur http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Échec du démarrage :', err);
    process.exit(1);
  });
