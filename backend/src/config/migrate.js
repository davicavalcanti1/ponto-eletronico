const db = require('./db');

const migrations = [
  `CREATE TABLE IF NOT EXISTS employees (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    name               VARCHAR(255) NOT NULL,
    cpf                VARCHAR(14),
    role               VARCHAR(100),
    fingerprint_id     INT UNIQUE,
    enrollment_pending TINYINT(1) NOT NULL DEFAULT 0,
    active             TINYINT(1) NOT NULL DEFAULT 1,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS time_records (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    type        ENUM('entry','exit') NOT NULL,
    source      VARCHAR(50) NOT NULL DEFAULT 'biometric',
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE INDEX IF NOT EXISTS idx_tr_employee ON time_records(employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_date     ON time_records(recorded_at)`,
];

async function migrate() {
  for (const sql of migrations) {
    try {
      await db.query(sql);
    } catch (err) {
      // IF NOT EXISTS garante idempotência, mas índices duplicados podem dar aviso — ignora
      if (!err.message.includes('Duplicate')) throw err;
    }
  }
  console.log('[DB] Tabelas prontas.');
}

module.exports = migrate;
