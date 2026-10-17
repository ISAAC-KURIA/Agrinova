const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');
const { analyzeImage } = require('../services/aiAnalysis');

// All routes protected
router.use(authMiddleware);

// POST /api/scans — create scan with image upload
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { field_id } = req.body;

    if (!field_id) {
      return res.status(400).json({ error: 'field_id is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    // Verify field belongs to user
    const field = db.prepare('SELECT * FROM fields WHERE id = ? AND user_id = ?').get(field_id, req.user.id);
    if (!field) {
      return res.status(404).json({ error: 'Field not found or access denied' });
    }

    // Check scan limit for free plan
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (user.plan === 'free' && user.scans_this_month >= 5) {
      return res.status(403).json({ error: 'Monthly scan limit reached. Upgrade to Pro for unlimited scans.' });
    }

    // Increment scans_this_month
    db.prepare('UPDATE users SET scans_this_month = scans_this_month + 1 WHERE id = ?').run(req.user.id);

    const imagePath = req.file.path;
    const imageRelPath = 'uploads/' + req.file.filename;

    // Run AI analysis
    const analysis = await analyzeImage(imagePath, field);

    const scanId = uuidv4();
    const createdAt = new Date().toISOString();

    // Save scan
    db.prepare(`
      INSERT INTO scans (
        id, field_id, user_id, image_path, status,
        crop_type, growth_stage, health_score, issues,
        severity, urgency, yield_impact, recommendations,
        ai_confidence, roi, summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      scanId,
      field_id,
      req.user.id,
      imageRelPath,
      'completed',
      analysis.crop_type,
      analysis.growth_stage,
      analysis.health_score,
      JSON.stringify(analysis.issues),
      analysis.severity,
      analysis.urgency,
      analysis.yield_impact,
      JSON.stringify(analysis.recommendations),
      analysis.ai_confidence,
      JSON.stringify(analysis.roi),
      analysis.summary,
      createdAt
    );

    // Save treatments
    if (analysis.recommendations && analysis.recommendations.length > 0) {
      const insertTreatment = db.prepare(`
        INSERT INTO treatments (id, scan_id, name, type, dosage, cost_per_ha, effectiveness, pre_harvest_interval, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const rec of analysis.recommendations) {
        insertTreatment.run(
          uuidv4(),
          scanId,
          rec.product || rec.action,
          rec.category,
          rec.dosage,
          rec.cost_per_ha,
          rec.effectiveness_percent,
          rec.pre_harvest_interval,
          rec.notes
        );
      }
    }

    const scan = db.prepare('SELECT * FROM scans WHERE id = ?').get(scanId);
    return res.status(201).json({
      ...scan,
      issues: JSON.parse(scan.issues || '[]'),
      recommendations: JSON.parse(scan.recommendations || '[]'),
      roi: JSON.parse(scan.roi || '{}')
    });
  } catch (err) {
    console.error('Create scan error:', err.message);
    console.error('Stack:', err.stack);
    return res.status(500).json({ error: err.message || 'Server error during scan analysis' });
  }
});

// GET /api/scans — list scans for user
router.get('/', (req, res) => {
  try {
    const scans = db.prepare(`
      SELECT s.*, f.name AS field_name
      FROM scans s
      LEFT JOIN fields f ON s.field_id = f.id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
      LIMIT 50
    `).all(req.user.id);

    return res.json(scans.map(s => ({
      ...s,
      issues: (() => { try { return JSON.parse(s.issues || '[]'); } catch (e) { return []; } })(),
      recommendations: (() => { try { return JSON.parse(s.recommendations || '[]'); } catch (e) { return []; } })(),
      roi: (() => { try { return JSON.parse(s.roi || '{}'); } catch (e) { return {}; } })()
    })));
  } catch (err) {
    console.error('List scans error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/scans/field/:fieldId — scans for a specific field
// IMPORTANT: this route is defined BEFORE /api/scans/:id to avoid conflict
router.get('/field/:fieldId', (req, res) => {
  try {
    // Verify field ownership
    const field = db.prepare('SELECT * FROM fields WHERE id = ? AND user_id = ?').get(req.params.fieldId, req.user.id);
    if (!field) {
      return res.status(404).json({ error: 'Field not found or access denied' });
    }

    const scans = db.prepare(`
      SELECT * FROM scans
      WHERE field_id = ?
      ORDER BY created_at DESC
    `).all(req.params.fieldId);

    return res.json(scans.map(s => ({
      ...s,
      issues: (() => { try { return JSON.parse(s.issues || '[]'); } catch (e) { return []; } })(),
      recommendations: (() => { try { return JSON.parse(s.recommendations || '[]'); } catch (e) { return []; } })(),
      roi: (() => { try { return JSON.parse(s.roi || '{}'); } catch (e) { return {}; } })()
    })));
  } catch (err) {
    console.error('Get field scans error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/scans/:id — scan detail with treatments
router.get('/:id', (req, res) => {
  try {
    const scan = db.prepare(`
      SELECT s.*, f.name AS field_name
      FROM scans s
      LEFT JOIN fields f ON s.field_id = f.id
      WHERE s.id = ? AND s.user_id = ?
    `).get(req.params.id, req.user.id);

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    const treatments = db.prepare('SELECT * FROM treatments WHERE scan_id = ?').all(req.params.id);

    return res.json({
      ...scan,
      issues: (() => { try { return JSON.parse(scan.issues || '[]'); } catch (e) { return []; } })(),
      recommendations: (() => { try { return JSON.parse(scan.recommendations || '[]'); } catch (e) { return []; } })(),
      roi: (() => { try { return JSON.parse(scan.roi || '{}'); } catch (e) { return {}; } })(),
      treatments
    });
  } catch (err) {
    console.error('Get scan error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/scans/:id/pdf — generate and stream PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const scan = db.prepare('SELECT * FROM scans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    const field = db.prepare('SELECT * FROM fields WHERE id = ?').get(scan.field_id);
    const user = db.prepare('SELECT id, name, email, phone FROM users WHERE id = ?').get(req.user.id);

    let generateScanPDF;
    try {
      ({ generateScanPDF } = require('../services/pdfGenerator'));
    } catch (e) {
      return res.status(503).json({ error: 'PDF generation is not available. html-pdf-node may not be installed.' });
    }

    const pdfBuffer = await generateScanPDF(scan, field || {}, user || {});

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="agrinova-scan-${scan.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    return res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

module.exports = router;
