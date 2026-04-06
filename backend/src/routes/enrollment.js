const router = require('express').Router();
const db = require('../config/db');

// Agent polls this to know if there's an enrollment waiting
router.get('/pending', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name FROM employees WHERE enrollment_pending=1 LIMIT 1'
    );
    if (!rows.length) return res.json(null);
    res.json({ employee_id: rows[0].id, employee_name: rows[0].name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agent calls this after capturing the fingerprint from the reader
// Body: { employee_id, fingerprint_id }
router.post('/complete', async (req, res) => {
  const { employee_id, fingerprint_id } = req.body;
  if (!employee_id || fingerprint_id == null) {
    return res.status(400).json({ error: 'employee_id e fingerprint_id obrigatórios' });
  }
  try {
    await db.query(
      'UPDATE employees SET fingerprint_id=?, enrollment_pending=0 WHERE id=?',
      [fingerprint_id, employee_id]
    );
    const [[emp]] = await db.query('SELECT name FROM employees WHERE id=?', [employee_id]);
    res.json({ ok: true, employee: emp.name, fingerprint_id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Esse ID de digital já está em uso por outro funcionário' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Agent or UI can report enrollment failure
router.post('/failed', async (req, res) => {
  const { employee_id } = req.body;
  try {
    await db.query('UPDATE employees SET enrollment_pending=0 WHERE id=?', [employee_id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
