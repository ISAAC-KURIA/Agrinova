const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

// All routes protected
router.use(authMiddleware);

// GET /api/fields — list fields for user with latest health score
router.get('/', (req, res) => {
  try {
    const fields = db.prepare(`
      SELECT f.*,
        (SELECT s.health_score FROM scans s WHERE s.field_id = f.id ORDER BY s.created_at DESC LIMIT 1) AS latest_health_score,
        (SELECT s.severity FROM scans s WHERE s.field_id = f.id ORDER BY s.created_at DESC LIMIT 1) AS latest_severity
      FROM fields f
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `).all(req.user.id);

    return res.json(fields);
  } catch (err) {
    console.error('Get fields error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/fields — create field
router.post('/', (req, res) => {
  try {
    const { name, location_lat, location_lng, size_ha, crop_type, planting_date, soil_type } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Field name is required' });
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO fields (id, user_id, name, location_lat, location_lng, size_ha, crop_type, planting_date, soil_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.user.id,
      name,
      location_lat || null,
      location_lng || null,
      size_ha || null,
      crop_type || null,
      planting_date || null,
      soil_type || null,
      createdAt
    );

    const field = db.prepare('SELECT * FROM fields WHERE id = ?').get(id);
    return res.status(201).json(field);
  } catch (err) {
    console.error('Create field error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/fields/:id — get field with last 5 scans
router.get('/:id', (req, res) => {
  try {
    const field = db.prepare('SELECT * FROM fields WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    const scans = db.prepare(`
      SELECT id, crop_type, growth_stage, health_score, severity, urgency, yield_impact, summary, ai_confidence, status, created_at
      FROM scans
      WHERE field_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(req.params.id);

    return res.json({ ...field, scans });
  } catch (err) {
    console.error('Get field error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/fields/:id — update field
router.put('/:id', (req, res) => {
  try {
    const field = db.prepare('SELECT * FROM fields WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    const { name, location_lat, location_lng, size_ha, crop_type, planting_date, soil_type } = req.body;

    db.prepare(`
      UPDATE fields SET
        name = COALESCE(?, name),
        location_lat = COALESCE(?, location_lat),
        location_lng = COALESCE(?, location_lng),
        size_ha = COALESCE(?, size_ha),
        crop_type = COALESCE(?, crop_type),
        planting_date = COALESCE(?, planting_date),
        soil_type = COALESCE(?, soil_type)
      WHERE id = ? AND user_id = ?
    `).run(
      name || null,
      location_lat !== undefined ? location_lat : null,
      location_lng !== undefined ? location_lng : null,
      size_ha !== undefined ? size_ha : null,
      crop_type || null,
      planting_date || null,
      soil_type || null,
      req.params.id,
      req.user.id
    );

    const updated = db.prepare('SELECT * FROM fields WHERE id = ?').get(req.params.id);
    return res.json(updated);
  } catch (err) {
    console.error('Update field error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/fields/:id — delete field
router.delete('/:id', (req, res) => {
  try {
    const field = db.prepare('SELECT * FROM fields WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    db.prepare('DELETE FROM fields WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    return res.json({ message: 'Field deleted successfully' });
  } catch (err) {
    console.error('Delete field error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
