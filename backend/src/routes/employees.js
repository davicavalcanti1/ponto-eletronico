const router = require('express').Router();
const db = require('../config/db');

// List all
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, cpf, role, fingerprint_id, enrollment_pending, active, created_at
       FROM employees ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create employee (no fingerprint yet — enrollment is a separate step)
router.post('/', async (req, res) => {
  const { name, cpf, role } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });
  try {
    const [result] = await db.query(
      'INSERT INTO employees (name, cpf, role) VALUES (?, ?, ?)',
      [name, cpf || null, role || null]
    );
    res.status(201).json({ id: result.insertId, name, cpf, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update employee info
router.put('/:id', async (req, res) => {
  const { name, cpf, role, active } = req.body;
  try {
    await db.query(
      'UPDATE employees SET name=?, cpf=?, role=?, active=? WHERE id=?',
      [name, cpf || null, role || null, active ?? 1, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deactivate
router.delete('/:id', async (req, res) => {
  try {
    await db.query('UPDATE employees SET active=0 WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger digital enrollment for this employee
router.post('/:id/enroll/start', async (req, res) => {
  try {
    // Cancel any other pending enrollment first
    await db.query('UPDATE employees SET enrollment_pending=0 WHERE enrollment_pending=1');
    await db.query(
      'UPDATE employees SET enrollment_pending=1, fingerprint_id=NULL WHERE id=?',
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel pending enrollment
router.post('/:id/enroll/cancel', async (req, res) => {
  try {
    await db.query('UPDATE employees SET enrollment_pending=0 WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
