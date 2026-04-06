import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Reports from './pages/Reports';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="funcionarios" element={<Employees />} />
          <Route path="relatorios" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
