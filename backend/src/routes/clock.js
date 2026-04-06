const router = require('express').Router();
const db = require('../config/db');
const dayjs = require('dayjs');

const MINIMUM_INTERVAL_HOURS = 10;

async function resolveEmployee(fingerprintId, employeeId) {
  if (employeeId) return employeeId;
  const [rows] = await db.query(
    'SELECT id FROM employees WHERE fingerprint_id=? AND active=1',
    [fingerprintId]
  );
  if (!rows.length) return null;
  return rows[0].id;
}

async function registerClock(empId, source, res) {
  const today = dayjs().format('YYYY-MM-DD');

  const [records] = await db.query(
    `SELECT type, recorded_at FROM time_records
     WHERE employee_id=? AND DATE(recorded_at)=?
     ORDER BY recorded_at ASC`,
    [empId, today]
  );

  const [[emp]] = await db.query('SELECT name FROM employees WHERE id=?', [empId]);

  if (records.length === 0) {
    // First punch of the day → entry
    await db.query(
      'INSERT INTO time_records (employee_id, type, source) VALUES (?, ?, ?)',
      [empId, 'entry', source]
    );
    return res.json({ ok: true, type: 'entry', employee: emp.name, recorded_at: new Date() });
  }

  if (records.length === 1 && records[0].type === 'entry') {
    // Second punch → check 10h minimum
    const entryTime = new Date(records[0].recorded_at);
    const now = new Date();
    const diffMs = now - entryTime;
    const diffH = diffMs / 3600000;

    if (diffH < MINIMUM_INTERVAL_HOURS) {
      const remaining = MINIMUM_INTERVAL_HOURS - diffH;
      const h = Math.floor(remaining);
      const m = Math.round((remaining - h) * 60);
      const waitMsg = h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
      return res.status(400).json({
        error: `Saída não permitida ainda. Aguarde mais ${waitMsg}.`,
        entry_at: records[0].recorded_at,
        wait_hours: parseFloat(remaining.toFixed(2)),
      });
    }

    await db.query(
      'INSERT INTO time_records (employee_id, type, source) VALUES (?, ?, ?)',
      [empId, 'exit', source]
    );
    return res.json({ ok: true, type: 'exit', employee: emp.name, recorded_at: new Date() });
  }

  // Already has both entry and exit today
  return res.status(400).json({
    error: 'Ponto já completo para hoje (entrada e saída registrados).',
    employee: emp.name,
  });
}

// Called by the TechMag agent: { fingerprint_id: <int> }
router.post('/event', async (req, res) => {
  const { fingerprint_id, source } = req.body;
  if (fingerprint_id == null) return res.status(400).json({ error: 'fingerprint_id obrigatório' });

  try {
    const empId = await resolveEmployee(fingerprint_id, null);
    if (!empId) return res.status(404).json({ error: 'Digital não reconhecida. Funcionário não cadastrado.' });
    await registerClock(empId, source || 'biometric', res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual clock from browser: { employee_id, type? }
router.post('/manual', async (req, res) => {
  const { employee_id } = req.body;
  if (!employee_id) return res.status(400).json({ error: 'employee_id obrigatório' });

  try {
    await registerClock(parseInt(employee_id), 'manual', res);
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
