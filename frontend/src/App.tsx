import { Routes, Route, Link, Navigate } from 'react-router-dom';
import PublicLayout from './components/PublicLayout';
import Home from './pages/public/Home';
import Projects from './pages/public/Projects';
import States from './pages/public/States';
import About from './pages/public/About';
import Compare from './pages/public/Compare';
import Policy from './pages/public/Policy';
import ForgotPassword from './pages/public/ForgotPassword';
import ResetPassword from './pages/public/ResetPassword';
import AdminLogin from './pages/admin/AdminLogin';
import Dashboard from './pages/admin/Dashboard';
import AnomalyExplorer from './pages/admin/AnomalyExplorer';
import Datasets from './pages/admin/Datasets';
import Investigation from './pages/admin/Investigation';
import Reports from './pages/admin/Reports';
import AuditLog from './pages/admin/AuditLog';
import Security from './pages/admin/Security';
import AiSettings from './pages/admin/AiSettings';
import { RequireAdmin } from './components/ProtectedRoute';
import { EmptyState } from './components/Shared';

function NotFound() {
  return (
    <PublicLayout>
      <EmptyState
        icon="◌"
        title="Page not found"
        description="The page you are looking for does not exist on the PRAMANA portal."
        action={
          <>
            <Link to="/" className="btn-primary">Return to home</Link>
            <Link to="/projects" className="btn-secondary">Search records</Link>
          </>
        }
      />
    </PublicLayout>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public portal */}
      <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
      <Route path="/projects" element={<PublicLayout><Projects /></PublicLayout>} />
      <Route path="/states" element={<PublicLayout><States /></PublicLayout>} />
      <Route path="/compare" element={<PublicLayout wide><Compare /></PublicLayout>} />
      <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
      <Route path="/policy" element={<PublicLayout><Policy /></PublicLayout>} />
      <Route path="/privacy" element={<PublicLayout><Policy /></PublicLayout>} />

      {/* Account recovery for official/administrator accounts. The public portal has
          no accounts: every page above is open without signing in. */}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/login" element={<Navigate to="/admin/login" replace />} />
      <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />

      {/* Administrator portal */}
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<RequireAdmin><Dashboard /></RequireAdmin>} />
      <Route path="/admin/anomalies" element={<RequireAdmin><AnomalyExplorer /></RequireAdmin>} />
      <Route path="/admin/datasets" element={<RequireAdmin><Datasets /></RequireAdmin>} />
      <Route path="/admin/investigation" element={<RequireAdmin><Investigation /></RequireAdmin>} />
      <Route path="/admin/reports" element={<RequireAdmin><Reports /></RequireAdmin>} />
      <Route path="/admin/audit" element={<RequireAdmin><AuditLog /></RequireAdmin>} />
      <Route path="/admin/security" element={<RequireAdmin><Security /></RequireAdmin>} />
      <Route path="/admin/ai" element={<RequireAdmin><AiSettings /></RequireAdmin>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
