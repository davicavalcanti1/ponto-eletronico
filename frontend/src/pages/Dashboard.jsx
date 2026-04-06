import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [r, e] = await Promise.all([
      fetch('/api/clock/today').then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
    ]);
    setRecords(Array.isArray(r) ? r : []);
    setEmployees(Array.isArray(e) ? e.filter(x => x.active && x.fingerprint_id != null) : []);
  };

  useEffect(() => { load(); }, []);

  const entries = records.filter(r => r.type === 'entry').length;
  const exits   = records.filter(r => r.type === 'exit').length;
  const present = Math.max(0, entries - exits);

  const handleManual = async () => {
    if (!selected) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/clock/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: parseInt(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Show specific 10h wait message
        setMsg({ type: 'error', text: data.error });
        return;
      }
      setMsg({ type: 'success', text: `${data.type === 'entry' ? 'Entrada' : 'Saída'} registrada — ${data.employee}` });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const fmt = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Build status per employee for today (entry time, exit time, present/absent)
  const statusByEmployee = {};
  [...records].reverse().forEach(r => {
    if (!statusByEmployee[r.name]) statusByEmployee[r.name] = {};
    statusByEmployee[r.name][r.type] = r.recorded_at;
  });

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <span style={{ color: '#64748b', fontSize: '13px' }}>{today}</span>
      </div>

      <div className="stats">
        <div className="stat-card">
          <div className="number">{entries}</div>
          <div className="label">Entradas hoje</div>
        </div>
        <div className="stat-card">
          <div className="number">{exits}</div>
          <div className="label">Saídas hoje</div>
        </div>
        <div className="stat-card">
          <div className="number" style={{ color: present > 0 ? '#16a34a' : '#64748b' }}>{present}</div>
          <div className="label">Presentes agora</div>
        </div>
      </div>

      <div className="card">
        <h3>Registrar ponto manualmente</h3>
        <p style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>
          Apenas para casos em que o leitor não está disponível. O sistema aplica a mesma regra de 10h de intervalo.
        </p>
        {msg && (
          <div className={`alert alert-${msg.type}`} style={{ whiteSpace: 'pre-line' }}>
            {msg.text}
          </div>
        )}
        <div className="form-row">
          <div className="form-group">
            <label>Funcionário</label>
            <select value={selected} onChange={e => setSelected(e.target.value)} style={{ width: 240 }}>
              <option value="">Selecione...</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleManual} disabled={loading || !selected}>
            {loading ? 'Registrando...' : 'Registrar ponto'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Batidas de hoje ({records.length})</h3>
        <table>
          <thead>
            <tr>
              <th>Hora</th>
              <th>Funcionário</th>
              <th>Tipo</th>
              <th>Origem</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8' }}>Nenhum registro hoje</td></tr>
            )}
            {records.map(r => (
              <tr key={r.id}>
                <td style={{ fontFamily: 'monospace' }}>{fmt(r.recorded_at)}</td>
                <td>{r.name}</td>
                <td><span className={`badge badge-${r.type}`}>{r.type === 'entry' ? 'Entrada' : 'Saída'}</span></td>
                <td style={{ color: '#64748b' }}>{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
