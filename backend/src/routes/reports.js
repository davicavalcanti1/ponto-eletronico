const router = require('express').Router();
const db = require('../config/db');
const { Parser } = require('json2csv');
const dayjs = require('dayjs');

const buildQuery = (filters) => {
  const conditions = [];
  const params = [];

  if (filters.employee_id) {
    conditions.push('tr.employee_id = ?');
    params.push(filters.employee_id);
  }
  if (filters.date_from) {
    conditions.push('DATE(tr.recorded_at) >= ?');
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    conditions.push('DATE(tr.recorded_at) <= ?');
    params.push(filters.date_to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
};

// Get records with filters
router.get('/', async (req, res) => {
  const { employee_id, date_from, date_to } = req.query;
  const { where, params } = buildQuery({ employee_id, date_from, date_to });
  try {
    const [rows] = await db.query(
      `SELECT tr.id, e.name AS employee, e.role, tr.type, tr.recorded_at, tr.source
       FROM time_records tr
       JOIN employees e ON e.id = tr.employee_id
       ${where}
       ORDER BY tr.recorded_at DESC
       LIMIT 1000`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export CSV
router.get('/export', async (req, res) => {
  const { employee_id, date_from, date_to } = req.query;
  const { where, params } = buildQuery({ employee_id, date_from, date_to });
  try {
    const [rows] = await db.query(
      `SELECT e.name AS funcionario, e.role AS cargo,
              tr.type AS tipo,
              DATE_FORMAT(tr.recorded_at, '%d/%m/%Y') AS data,
              DATE_FORMAT(tr.recorded_at, '%H:%i:%s') AS hora,
              tr.source AS origem
       FROM time_records tr
       JOIN employees e ON e.id = tr.employee_id
       ${where}
       ORDER BY tr.recorded_at`,
      params
    );

    const parser = new Parser({ delimiter: ';' });
    const csv = parser.parse(rows);
    const filename = `ponto_${dayjs().format('YYYY-MM-DD')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
