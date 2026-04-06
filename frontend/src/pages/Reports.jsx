import { useEffect, useState } from 'react';

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };

export default function Reports() {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({ employee_id: '', date_from: firstOfMonth(), date_to: today() });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(setEmployees);
    search();
  }, []);

  const buildQS = () => {
    const p = new URLSearchParams();
    if (filters.employee_id) p.set('employee_id', filters.employee_id);
    if (filters.date_from)   p.set('date_from', filters.date_from);
    if (filters.date_to)     p.set('date_to', filters.date_to);
    return p.toString();
  };

  const search = async () => {
    setLoading(true);
    const res = await fetch(`/api/reports?${buildQS()}`);
    const data = await res.json();
    setRecords(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const exportCsv = () => {
    window.open(`/api/reports/export?${buildQS()}`, '_blank');
  };

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <div className="page-header">
        <h1>Relatorios</h1>
        <button className="btn btn-success" onClick={exportCsv}>Exportar CSV</button>
      </div>

      <div className="card">
        <div className="form-row">
          <div className="form-group">
            <label>Funcionario</label>
            <select value={filters.employee_id} onChange={e => set('employee_id', e.target.value)} style={{ width: 200 }}>
              <option value="">Todos</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Data inicio</label>
            <input type="date" value={filters.date_from} onChange={e => set('date_from', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Data fim</label>
            <input type="date" value={filters.date_to} onChange={e => set('date_to', e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={search} disabled={loading}>
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Resultados ({records.length} registros)</h3>
        <table>
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Funcionario</th>
              <th>Cargo</th>
              <th>Tipo</th>
              <th>Origem</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && !loading && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>Nenhum registro encontrado</td></tr>
            )}
            {records.map(r => (
              <tr key={r.id}>
                <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fmt(r.recorded_at)}</td>
                <td>{r.employee}</td>
                <td style={{ color: '#64748b' }}>{r.role || '-'}</td>
                <td><span className={`badge badge-${r.type}`}>{r.type === 'entry' ? 'Entrada' : 'Saida'}</span></td>
                <td style={{ color: '#64748b' }}>{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
