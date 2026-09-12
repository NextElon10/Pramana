import type { ReactNode } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from './Shared';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><LoadingState label="Verifying session…" /></div>;
  }
  if (!user) return <Navigate to="/admin/login" replace />;

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-sunken px-4">
        <div className="card max-w-md p-8 text-center">
          <div className="mb-3 text-3xl text-navy-200" aria-hidden="true">⚿</div>
          <h1 className="text-base">Administrator access required</h1>
          <p className="prose-note mt-2">
            Administrative functions are restricted to authorised administrator accounts. The public portal is
            open to everyone and needs no sign-in.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link to="/" className="btn-primary">Return to public portal</Link>
            <Link to="/admin/login" className="btn-secondary">Administrator sign in</Link>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
