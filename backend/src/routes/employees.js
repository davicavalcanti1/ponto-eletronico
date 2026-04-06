const router = require('express').Router();
const db = require('../config/db');

// List all employees
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, cpf, role, fingerprint_id, active, created_at FROM employees ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create employee
router.post('/', async (req, res) => {
  const { name, cpf, role, fingerprint_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const [result] = await db.query(
      'INSERT INTO employees (name, cpf, role, fingerprint_id) VALUES (?, ?, ?, ?)',
      [name, cpf || null, role || null, fingerprint_id || null]
    );
    res.status(201).json({ id: result.insertId, name, cpf, role, fingerprint_id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'fingerprint_id já cadastrado' });
    res.status(500).json({ error: err.message });
  }
});

// Update employee
router.put('/:id', async (req, res) => {
  const { name, cpf, role, fingerprint_id, active } = req.body;
  try {
    await db.query(
      'UPDATE employees SET name=?, cpf=?, role=?, fingerprint_id=?, active=? WHERE id=?',
      [name, cpf || null, role || null, fingerprint_id || null, active ?? 1, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'fingerprint_id já cadastrado' });
    res.status(500).json({ error: err.message });
  }
});

// Delete (deactivate) employee
router.delete('/:id', async (req, res) => {
  try {
    await db.query('UPDATE employees SET active=0 WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
