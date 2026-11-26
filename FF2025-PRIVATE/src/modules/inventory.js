'use strict';

const express = require('express');
const pool = require('../database/pool');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT item_code,item_name,quantity FROM inventory WHERE user_id=$1 ORDER BY item_name',
      [req.user.id]
    );
    return res.json({ items: result.rows });
  } catch (error) { return next(error); }
});

module.exports = router;
