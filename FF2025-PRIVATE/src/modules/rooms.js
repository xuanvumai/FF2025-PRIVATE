'use strict';

const express = require('express');
const crypto = require('node:crypto');
const pool = require('../database/pool');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

function roomCode() { return crypto.randomBytes(3).toString('hex').toUpperCase(); }

router.post('/', authenticate, async (req, res, next) => {
  const title = String(req.body.title || 'Private Room').trim().slice(0, 40);
  const maxPlayers = Number(req.body.maxPlayers || 4);
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 20) {
    return res.status(400).json({ error: 'maxPlayers must be between 2 and 20.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let code = roomCode();
    for (let i = 0; i < 5; i++) {
      const exists = await client.query('SELECT 1 FROM rooms WHERE room_code=$1', [code]);
      if (!exists.rowCount) break;
      code = roomCode();
    }
    const created = await client.query(
      `INSERT INTO rooms(room_code,owner_id,title,max_players)
       VALUES($1,$2,$3,$4) RETURNING id,room_code,title,status,max_players`,
      [code, req.user.id, title, maxPlayers]
    );
    await client.query('INSERT INTO room_players(room_id,user_id) VALUES($1,$2)', [created.rows[0].id, req.user.id]);
    await client.query('COMMIT');
    return res.status(201).json({ room: created.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally { client.release(); }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT r.room_code,r.title,r.status,r.max_players,
       COUNT(rp.user_id)::int AS player_count
       FROM rooms r LEFT JOIN room_players rp ON rp.room_id=r.id
       WHERE r.status='waiting' GROUP BY r.id ORDER BY r.created_at DESC LIMIT 50`
    );
    return res.json({ rooms: result.rows });
  } catch (error) { return next(error); }
});

router.post('/:code/join', authenticate, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM rooms WHERE room_code=$1 FOR UPDATE', [String(req.params.code).toUpperCase()]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Room not found.' }); }
    const room = found.rows[0];
    if (room.status !== 'waiting') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Room is not accepting players.' }); }
    const count = await client.query('SELECT COUNT(*)::int AS n FROM room_players WHERE room_id=$1', [room.id]);
    const already = await client.query('SELECT 1 FROM room_players WHERE room_id=$1 AND user_id=$2', [room.id, req.user.id]);
    if (!already.rowCount && count.rows[0].n >= room.max_players) {
      await client.query('ROLLBACK'); return res.status(409).json({ error: 'Room is full.' });
    }
    await client.query(
      'INSERT INTO room_players(room_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [room.id, req.user.id]
    );
    await client.query('COMMIT');
    return res.json({ joined: true, roomCode: room.room_code });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally { client.release(); }
});

module.exports = router;
