import { NavLink, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Ponto Eletronico</h2>
          <small>TechMag</small>
        </div>
        <nav>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Dashboard</NavLink>
          <NavLink to="/funcionarios" className={({ isActive }) => isActive ? 'active' : ''}>Funcionarios</NavLink>
          <NavLink to="/relatorios" className={({ isActive }) => isActive ? 'active' : ''}>Relatorios</NavLink>
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
