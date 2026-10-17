const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

// All routes protected
router.use(authMiddleware);

// GET /api/dashboard/stats
router.get('/stats', (req, res) => {
  try {
    const userId = req.user.id;

    // Total fields
    const totalFields = db.prepare('SELECT COUNT(*) AS count FROM fields WHERE user_id = ?').get(userId).count;

    // Total scans
    const totalScans = db.prepare('SELECT COUNT(*) AS count FROM scans WHERE user_id = ?').get(userId).count;

    // Average health score
    const avgRow = db.prepare('SELECT AVG(health_score) AS avg FROM scans WHERE user_id = ? AND health_score IS NOT NULL').get(userId);
    const avgHealthScore = avgRow.avg !== null ? Math.round(avgRow.avg * 10) / 10 : null;

    // Alerts count: severity high/critical in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const alertsCount = db.prepare(`
      SELECT COUNT(*) AS count FROM scans
      WHERE user_id = ? AND severity IN ('high', 'critical') AND created_at >= ?
    `).get(userId, thirtyDaysAgo).count;

    // Recent scans (last 5) with field name
    const recentScans = db.prepare(`
      SELECT s.id, s.crop_type, s.health_score, s.severity, s.created_at, s.urgency, f.name AS field_name
      FROM scans s
      LEFT JOIN fields f ON s.field_id = f.id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
      LIMIT 5
    `).all(userId);

    // Field health: list of fields with name, crop_type, latest health_score
    const fieldHealth = db.prepare(`
      SELECT f.id, f.name, f.crop_type,
        (SELECT s.health_score FROM scans s WHERE s.field_id = f.id ORDER BY s.created_at DESC LIMIT 1) AS latest_health_score,
        (SELECT s.severity FROM scans s WHERE s.field_id = f.id ORDER BY s.created_at DESC LIMIT 1) AS latest_severity
      FROM fields f
      WHERE f.user_id = ?
      ORDER BY f.name ASC
    `).all(userId);

    // Monthly scans: last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString();

    const monthlyScansRaw = db.prepare(`
      SELECT
        substr(created_at, 1, 7) AS month,
        COUNT(*) AS count
      FROM scans
      WHERE user_id = ? AND created_at >= ?
      GROUP BY substr(created_at, 1, 7)
      ORDER BY month ASC
    `).all(userId, sixMonthsAgoStr);

    // Fill in missing months
    const monthlyScans = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().substr(0, 7);
      const found = monthlyScansRaw.find(r => r.month === key);
      monthlyScans.push({ month: key, count: found ? found.count : 0 });
    }

    return res.json({
      total_fields: totalFields,
      total_scans: totalScans,
      avg_health_score: avgHealthScore,
      alerts_count: alertsCount,
      recent_scans: recentScans,
      field_health: fieldHealth,
      monthly_scans: monthlyScans
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
