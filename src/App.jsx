import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth }        from './context/AuthContext';
import Login              from './pages/Login';
import AdminDashboard     from './pages/AdminDashboard';
import AssignWorkers      from './components/AssignWorkers';
import WorkerDashboard    from './pages/WorkerDashboard';
import WorkHistory        from './pages/WorkHistory';
import ProfilePage        from './pages/ProfilePage';

// ── Protected route ──────────────────────────────────────────
const Protected = ({ children, role }) => {
  const { user } = useAuth();
  if (!user)              return <Navigate to="/" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Login />} />

      {/* Supervisor */}
      <Route path="/supervisor/dashboard" element={
        <Protected role="supervisor"><AdminDashboard /></Protected>
      }/>
      <Route path="/supervisor/assign" element={
        <Protected role="supervisor"><AssignWorkers /></Protected>
      }/>

      {/* Worker */}
      <Route path="/worker/dashboard" element={
        <Protected role="worker"><WorkerDashboard /></Protected>
      }/>
      <Route path="/worker/history" element={
        <Protected role="worker"><WorkHistory /></Protected>
      }/>

      {/* Profile */}
      <Route path='/profile' element={<Protected><ProfilePage /></Protected>}/>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}