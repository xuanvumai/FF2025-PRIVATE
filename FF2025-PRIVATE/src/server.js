'use strict';

const express = require('express');
const path = require('node:path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const pool = require('./database/pool');
const migrate = require('./database/migrate');
const { authenticate, requireAdmin } = require('./middleware/auth');

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(env.corsOrigin ? { origin: env.corsOrigin.split(',').map(x => x.trim()) } : {}));
app.use(express.json({ limit: '32kb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ status: 'ok', service: 'FF2025-PRIVATE', database: 'connected' });
  } catch {
    return res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

app.use('/api/auth', require('./modules/auth'));
app.use('/api/profile', require('./modules/profile'));
app.use('/api/lobby', require('./modules/lobby'));
app.use('/api/inventory', require('./modules/inventory'));
app.use('/api/rooms', require('./modules/rooms'));
app.use('/api/matchmaking', require('./modules/matchmaking'));
app.use('/api/battles', require('./modules/battles'));
app.use('/api/ranking', require('./modules/ranking'));

app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
app.get('/api/admin/overview', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const [users, rooms, matches] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM users'),
      pool.query("SELECT COUNT(*)::int AS total FROM rooms WHERE status='waiting'"),
      pool.query('SELECT COUNT(*)::int AS total FROM matches')
    ]);
    return res.json({
      users: users.rows[0].total,
      waitingRooms: rooms.rows[0].total,
      matches: matches.rows[0].total
    });
  } catch (error) { return next(error); }
});

app.get('/api/admin/users', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id,email,username,role,level,xp,coins,wins,losses,created_at
       FROM users ORDER BY created_at DESC LIMIT 100`
    );
    return res.json({ users: result.rows });
  } catch (error) { return next(error); }
});

app.get('/', (_req, res) => res.redirect('/admin'));

app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === '23505') return res.status(409).json({ error: 'A record with that value already exists.' });
  return res.status(500).json({ error: 'Internal server error.' });
});

async function start() {
  await migrate();
  app.listen(env.port, '0.0.0.0', () => {
    console.log(`FF2025-PRIVATE listening on port ${env.port}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Startup failed:', error);
    process.exit(1);
  });
}

module.exports = app;
