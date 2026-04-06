const router = require('express').Router();
const db = require('../config/db');
const dayjs = require('dayjs');

// Called by the TechMag agent when a fingerprint is recognized
// Body: { fingerprint_id: <int> }  OR  { employee_id: <int> }
router.post('/event', async (req, res) => {
  const { fingerprint_id, employee_id, source } = req.body;

  try {
    let empId = employee_id;

    if (!empId && fingerprint_id != null) {
      const [rows] = await db.query(
        'SELECT id FROM employees WHERE fingerprint_id=? AND active=1',
        [fingerprint_id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Funcionário não encontrado para esse ID de digital' });
      empId = rows[0].id;
    }

    if (!empId) return res.status(400).json({ error: 'fingerprint_id ou employee_id obrigatório' });

    // Determine type: if last record today is 'entry', next is 'exit', and vice-versa
    const today = dayjs().format('YYYY-MM-DD');
    const [last] = await db.query(
      `SELECT type FROM time_records
       WHERE employee_id=? AND DATE(recorded_at)=?
       ORDER BY recorded_at DESC LIMIT 1`,
      [empId, today]
    );
    const type = (!last.length || last[0].type === 'exit') ? 'entry' : 'exit';

    await db.query(
      'INSERT INTO time_records (employee_id, type, source) VALUES (?, ?, ?)',
      [empId, type, source || 'biometric']
    );

    const [[emp]] = await db.query('SELECT name FROM employees WHERE id=?', [empId]);
    res.json({ ok: true, employee: emp.name, type, recorded_at: new Date() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual clock (from browser)
router.post('/manual', async (req, res) => {
  const { employee_id, type } = req.body;
  if (!employee_id || !type) return res.status(400).json({ error: 'employee_id e type obrigatórios' });
  try {
    await db.query(
      'INSERT INTO time_records (employee_id, type, source) VALUES (?, ?, ?)',
      [employee_id, type, 'manual']
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Today's records
router.get('/today', async (req, res) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const [rows] = await db.query(
      `SELECT tr.id, e.name, tr.type, tr.recorded_at, tr.source
       FROM time_records tr
       JOIN employees e ON e.id = tr.employee_id
       WHERE DATE(tr.recorded_at) = ?
       ORDER BY tr.recorded_at DESC`,
      [today]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
