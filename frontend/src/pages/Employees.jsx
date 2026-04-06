import { useEffect, useState } from 'react';

const EMPTY = { name: '', cpf: '', role: '', fingerprint_id: '' };

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [modal, setModal] = useState(null); // null | 'create' | employee obj
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  const load = () => fetch('/api/employees').then(r => r.json()).then(setEmployees);
  useEffect(() => { load(); }, []);

  const open = (emp) => {
    setForm(emp ? { name: emp.name, cpf: emp.cpf || '', role: emp.role || '', fingerprint_id: emp.fingerprint_id ?? '' } : EMPTY);
    setModal(emp || 'create');
  };

  const save = async () => {
    const payload = {
      ...form,
      fingerprint_id: form.fingerprint_id !== '' ? parseInt(form.fingerprint_id) : null,
    };
    const isNew = modal === 'create';
    const url = isNew ? '/api/employees' : `/api/employees/${modal.id}`;
    const method = isNew ? 'POST' : 'PUT';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, active: 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'success', text: isNew ? 'Funcionario criado!' : 'Atualizado!' });
      setModal(null);
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const deactivate = async (id) => {
    if (!confirm('Desativar funcionario?')) return;
    await fetch(`/api/employees/${id}`, { method: 'DELETE' });
    load();
  };

  const visible = employees.filter(e => showInactive ? true : e.active);

  return (
    <div>
      <div className="page-header">
        <h1>Funcionarios</h1>
        <button className="btn btn-primary" onClick={() => open(null)}>+ Novo funcionario</button>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#64748b' }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Mostrar inativos
          </label>
        </div>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>Cargo</th>
              <th>ID Digital</th>
              <th>Status</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>Nenhum funcionario cadastrado</td></tr>
            )}
            {visible.map(e => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td style={{ color: '#64748b' }}>{e.cpf || '-'}</td>
                <td style={{ color: '#64748b' }}>{e.role || '-'}</td>
                <td>
                  {e.fingerprint_id != null
                    ? <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>#{e.fingerprint_id}</span>
                    : <span style={{ color: '#94a3b8' }}>nao cadastrado</span>}
                </td>
                <td>
                  <span className={`badge ${e.active ? 'badge-active' : 'badge-off'}`}>
                    {e.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td>
                  <button className="btn btn-outline btn-sm" onClick={() => open(e)} style={{ marginRight: 6 }}>Editar</button>
                  {e.active && <button className="btn btn-danger btn-sm" onClick={() => deactivate(e.id)}>Desativar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <h3>{modal === 'create' ? 'Novo funcionario' : 'Editar funcionario'}</h3>
            <div className="form-group">
              <label>Nome *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" />
            </div>
            <div className="form-group">
              <label>CPF</label>
              <input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
            </div>
            <div className="form-group">
              <label>Cargo</label>
              <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Ex: Operador" />
            </div>
            <div className="form-group">
              <label>ID da digital no leitor TechMag</label>
              <input
                type="number"
                value={form.fingerprint_id}
                onChange={e => setForm(f => ({ ...f, fingerprint_id: e.target.value }))}
                placeholder="Ex: 1, 2, 3..."
              />
              <small style={{ color: '#64748b', fontSize: 11 }}>
                ID cadastrado no proprio leitor. Consulte o software TechMag para ver os IDs.
              </small>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
