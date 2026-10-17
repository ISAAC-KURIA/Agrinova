const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/market/prices — return all latest prices (one per crop_type)
router.get('/prices', (req, res) => {
  try {
    const prices = db.prepare(`
      SELECT mp.*
      FROM market_prices mp
      INNER JOIN (
        SELECT crop_type, MAX(date) AS max_date
        FROM market_prices
        GROUP BY crop_type
      ) latest ON mp.crop_type = latest.crop_type AND mp.date = latest.max_date
      ORDER BY mp.crop_type ASC
    `).all();

    return res.json(prices);
  } catch (err) {
    console.error('Get market prices error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/market/prices/:crop — price history for a specific crop + trend
router.get('/prices/:crop', (req, res) => {
  try {
    const crop = req.params.crop;

    const history = db.prepare(`
      SELECT * FROM market_prices
      WHERE LOWER(crop_type) = LOWER(?)
      ORDER BY date DESC
    `).all(crop);

    if (history.length === 0) {
      return res.status(404).json({ error: 'No price data found for this crop' });
    }

    const latest = history[0];
    const trend = latest.trend || 'stable';

    return res.json({
      crop_type: crop,
      current_price: latest.price_per_kg,
      trend,
      history
    });
  } catch (err) {
    console.error('Get crop price history error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
