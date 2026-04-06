require('dotenv').config();
const express = require('express');
const cors = require('cors');
const migrate = require('./config/migrate');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/employees',  require('./routes/employees'));
app.use('/api/clock',      require('./routes/clock'));
app.use('/api/reports',    require('./routes/reports'));
app.use('/api/enrollment', require('./routes/enrollment'));

app.get('/api/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;

migrate()
  .then(() => app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`)))
  .catch(err => { console.error('[ERRO] Falha ao conectar/migrar banco:', err.message); process.exit(1); });
