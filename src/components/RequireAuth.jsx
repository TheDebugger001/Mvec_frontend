import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RequireAuth({ children, roles }) {
  const { user, loading, effectiveRole } = useAuth();
  const loc = useLocation();

  if (loading) return <div className="loading-screen">Loading MVEC…</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;

  if (roles && !roles.includes(effectiveRole || user.role)) {
    if (user.role === 'super_admin') return children;
    const home = {
      vendor: '/vendor',
      supplier: '/supplier',
      affiliate: '/affiliate',
      delivery: '/delivery',
      super_admin: '/admin'
    }[user.role] || '/';
    return <Navigate to={home} replace />;
  }

  return children;
}
