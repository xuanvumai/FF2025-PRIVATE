'use strict';

const bcrypt = require('bcryptjs');
const pool = require('./pool');
const env = require('../config/env');

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player','admin')),
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      coins INTEGER NOT NULL DEFAULT 1000,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
      UNIQUE(user_id, item_code)
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id BIGSERIAL PRIMARY KEY,
      room_code TEXT NOT NULL UNIQUE,
      owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','in_progress','finished')),
      max_players INTEGER NOT NULL DEFAULT 4 CHECK (max_players BETWEEN 2 AND 20),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS room_players (
      room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(room_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id BIGSERIAL PRIMARY KEY,
      room_id BIGINT REFERENCES rooms(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'finished',
      winner_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      result JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_users_rank ON users(level DESC, xp DESC, wins DESC);
    CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
    CREATE INDEX IF NOT EXISTS idx_matches_created ON matches(created_at DESC);
  `);

  if (env.adminEmail && env.adminPassword) {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [env.adminEmail]);
    if (existing.rowCount === 0) {
      const hash = await bcrypt.hash(env.adminPassword, 12);
      const username = 'admin_' + Date.now().toString().slice(-6);
      await pool.query(
        `INSERT INTO users(email, username, password_hash, role)
         VALUES($1, $2, $3, 'admin')`,
        [env.adminEmail, username, hash]
      );
      console.log('Bootstrap admin account created.');
    } else {
      await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [env.adminEmail]);
    }
  }
}

module.exports = migrate;
