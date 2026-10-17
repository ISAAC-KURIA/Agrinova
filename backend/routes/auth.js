const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

// POST /api/auth/register
router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, phone } = req.body;

    try {
      // Check if email already exists
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const id = uuidv4();
      const createdAt = new Date().toISOString();

      db.prepare(`
        INSERT INTO users (id, email, password_hash, name, phone, role, plan, scans_this_month, created_at)
        VALUES (?, ?, ?, ?, ?, 'farmer', 'free', 0, ?)
      `).run(id, email, passwordHash, name, phone || null, createdAt);

      const token = jwt.sign(
        { id, email, name, role: 'farmer', plan: 'free' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        token,
        user: { id, email, name, phone: phone || null, role: 'farmer', plan: 'free', created_at: createdAt }
      });
    } catch (err) {
      console.error('Register error:', err);
      return res.status(500).json({ error: 'Server error during registration' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const { password_hash, ...userWithoutPassword } = user;
      return res.json({ token, user: userWithoutPassword });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Server error during login' });
    }
  }
);

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, name, phone, role, plan, scans_this_month, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/auth/me — update name/phone
router.put('/me', authMiddleware, (req, res) => {
  try {
    const { name, phone } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' })
    }
    db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?')
      .run(name.trim(), phone?.trim() || null, req.user.id)
    const user = db.prepare('SELECT id, email, name, phone, role, plan, scans_this_month, created_at FROM users WHERE id = ?').get(req.user.id)
    return res.json({ user })
  } catch (err) {
    console.error('Update me error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router;
