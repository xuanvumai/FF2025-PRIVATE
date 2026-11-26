'use strict';

const express = require('express');
const pool = require('../database/pool');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT username,level,xp,wins,losses,
       ROW_NUMBER() OVER (ORDER BY wins DESC,level DESC,xp DESC) AS rank
       FROM users WHERE role='player'
       ORDER BY wins DESC,level DESC,xp DESC LIMIT 50`
    );
    return res.json({ ranking: result.rows });
  } catch (error) { return next(error); }
});

module.exports = router;
