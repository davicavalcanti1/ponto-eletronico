import { useEffect, useState, useRef } from 'react';

const EMPTY = { name: '', cpf: '', role: '' };

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [modal, setModal] = useState(null); // null | 'create' | employee obj
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [enrollingId, setEnrollingId] = useState(null); // employee being enrolled
  const pollRef = useRef(null);

  const load = () =>
    fetch('/api/employees').then(r => r.json()).then(data => {
      setEmployees(Array.isArray(data) ? data : []);
    });

  useEffect(() => {
    load();
    return () => clearInterval(pollRef.current);
  }, []);

  // Poll employee list while someone is in enrollment_pending state
  useEffect(() => {
    clearInterval(pollRef.current);
    if (enrollingId) {
      pollRef.current = setInterval(async () => {
        const data = await fetch('/api/employees').then(r => r.json());
        if (!Array.isArray(data)) return;
        setEmployees(data);
        const emp = data.find(e => e.id === enrollingId);
        if (emp && !emp.enrollment_pending) {
          // Enrollment completed or cancelled
          setEnrollingId(null);
          if (emp.fingerprint_id != null) {
            flash('success', `Digital de ${emp.name} cadastrada com sucesso!`);
          }
        }
      }, 2000);
    }
    return () => clearInterval(pollRef.current);
  }, [enrollingId]);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const openModal = (emp) => {
    setForm(emp ? { name: emp.name, cpf: emp.cpf || '', role: emp.role || '' } : EMPTY);
    setModal(emp || 'create');
  };

  const save = async () => {
    const isNew = modal === 'create';
    const url = isNew ? '/api/employees' : `/api/employees/${modal.id}`;
    try {
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, active: 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flash('success', isNew ? 'Funcionário cadastrado!' : 'Atualizado!');
      setModal(null);
      load();
    } catch (e) {
      flash('error', e.message);
    }
  };

  const deactivate = async (id) => {
    if (!confirm('Desativar funcionário?')) return;
    await fetch(`/api/employees/${id}`, { method: 'DELETE' });
    load();
  };

  const startEnroll = async (emp) => {
    const res = await fetch(`/api/employees/${emp.id}/enroll/start`, { method: 'POST' });
    if (res.ok) {
      setEnrollingId(emp.id);
      load();
    } else {
      const d = await res.json();
      flash('error', d.error);
    }
  };

  const cancelEnroll = async (emp) => {
    await fetch(`/api/employees/${emp.id}/enroll/cancel`, { method: 'POST' });
    setEnrollingId(null);
    load();
  };

  const visible = employees.filter(e => showInactive ? true : e.active);

  const enrollStatus = (emp) => {
    if (emp.enrollment_pending) return 'pending';
    if (emp.fingerprint_id != null) return 'enrolled';
    return 'none';
  };

  return (
    <div>
      <div className="page-header">
        <h1>Funcionários</h1>
        <button className="btn btn-primary" onClick={() => openModal(null)}>+ Novo funcionário</button>
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
              <th>Digital</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>Nenhum funcionário cadastrado</td></tr>
            )}
            {visible.map(e => {
              const status = enrollStatus(e);
              return (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td style={{ color: '#64748b' }}>{e.cpf || '-'}</td>
                  <td style={{ color: '#64748b' }}>{e.role || '-'}</td>
                  <td>
                    {status === 'enrolled' && (
                      <span className="badge badge-active">Cadastrada</span>
                    )}
                    {status === 'pending' && (
                      <span className="badge" style={{ background: '#fef3c7', color: '#92400e', display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
                        <span style={{ animation: 'pulse 1s infinite' }}>●</span> Aguardando leitura...
                      </span>
                    )}
                    {status === 'none' && (
                      <span className="badge badge-off">Não cadastrada</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${e.active ? 'badge-active' : 'badge-off'}`}>
                      {e.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openModal(e)}>Editar</button>
                    {e.active && status !== 'pending' && (
                      <button
                        className="btn btn-sm"
                        style={{ background: '#7c3aed', color: '#fff' }}
                        onClick={() => startEnroll(e)}
                      >
                        {status === 'enrolled' ? 'Recadastrar digital' : 'Cadastrar digital'}
                      </button>
                    )}
                    {status === 'pending' && (
                      <button className="btn btn-outline btn-sm" onClick={() => cancelEnroll(e)}>Cancelar</button>
                    )}
                    {e.active && (
                      <button className="btn btn-danger btn-sm" onClick={() => deactivate(e.id)}>Desativar</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {enrollingId && (() => {
        const emp = employees.find(e => e.id === enrollingId);
        if (!emp) return null;
        return (
          <div className="modal-overlay">
            <div className="modal" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>☝</div>
              <h3>Cadastrando digital</h3>
              <p style={{ color: '#64748b', margin: '12px 0' }}>
                Peça para <strong>{emp.name}</strong> colocar o dedo no leitor TechMag.
              </p>
              <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>
                O sistema irá registrar automaticamente quando a leitura for feita.
              </p>
              <button className="btn btn-outline" onClick={() => cancelEnroll(emp)}>Cancelar</button>
            </div>
          </div>
        );
      })()}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <h3>{modal === 'create' ? 'Novo funcionário' : 'Editar funcionário'}</h3>
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
            {modal === 'create' && (
              <p style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>
                Após cadastrar, clique em "Cadastrar digital" na lista para vincular a digital do funcionário.
              </p>
            )}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
