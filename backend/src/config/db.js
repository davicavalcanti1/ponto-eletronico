/**
 * Adaptador de banco de dados.
 * - Sem DB_HOST configurado → SQLite via sql.js (WASM, sem compilação)
 * - Com DB_HOST configurado → MySQL via mysql2 (produção/EasyPanel)
 */

const USE_SQLITE = !process.env.DB_HOST;

let adapterPromise;

if (USE_SQLITE) {
  const fs   = require('fs');
  const path = require('path');
  const DB_PATH = path.join(__dirname, '..', '..', '..', 'ponto-dev.sqlite');

  adapterPromise = (async () => {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();

    let db;
    if (fs.existsSync(DB_PATH)) {
      db = new SQL.Database(fs.readFileSync(DB_PATH));
    } else {
      db = new SQL.Database();
    }

    function save() {
      fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
    }

    function normalizeSql(sql) {
      return sql
        .replace(/ENGINE\s*=\s*\S+/gi, '')
        .replace(/DEFAULT\s+CHARSET\s*=\s*\S+/gi, '')
        .replace(/COLLATE\s*\S+/gi, '')
        .replace(/COMMENT\s+'[^']*'/gi, '')
        .replace(/TINYINT\(\d+\)/gi, 'INTEGER')
        .replace(/INT\s+AUTO_INCREMENT/gi, 'INTEGER')
        .replace(/AUTO_INCREMENT/gi, '')
        .replace(/ENUM\([^)]+\)/gi, 'TEXT')
        .replace(/VARCHAR\(\d+\)/gi, 'TEXT')
        .replace(/DATE_FORMAT\(([^,]+),\s*'%d\/%m\/%Y'\)/g, "strftime('%d/%m/%Y', $1)")
        .replace(/DATE_FORMAT\(([^,]+),\s*'%H:%i:%s'\)/g, "strftime('%H:%M:%S', $1)");
    }

    const adapter = {
      query: async (sql, params = []) => {
        const normalized = normalizeSql(sql.trim());
        const upper = normalized.replace(/\/\*[\s\S]*?\*\//g, '').trimStart().toUpperCase();
        try {
          if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
            const stmt = db.prepare(normalized);
            stmt.bind(params);
            const rows = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            stmt.free();
            return [rows];
          } else {
            db.run(normalized, params);
            save();
            if (upper.startsWith('INSERT')) {
              const [[{ id }]] = [db.exec('SELECT last_insert_rowid() AS id')[0]?.values ?? [[0]]];
              return [{ insertId: id, affectedRows: 1 }];
            }
            return [{}];
          }
        } catch (err) {
          if (err.message?.includes('UNIQUE constraint failed')) {
            err.code = 'ER_DUP_ENTRY';
          }
          throw err;
        }
      },
    };

    console.log(`[DB] SQLite (dev) → ${DB_PATH}`);
    return adapter;
  })();
} else {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'ponto',
    waitForConnections: true,
    connectionLimit: 10,
  });
  console.log(`[DB] MySQL → ${process.env.DB_HOST}/${process.env.DB_NAME || 'ponto'}`);
  adapterPromise = Promise.resolve(pool);
}

// Proxy que resolve o adapter antes de cada chamada
module.exports = {
  query: async (...args) => {
    const adapter = await adapterPromise;
    return adapter.query(...args);
  },
};
