import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { UserRole } from '../lib/types';
import { PermissionKey, PERMISSION_DEFINITIONS } from '../lib/portalPermissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: PermissionKey;
}

export default function ProtectedRoute({ children, allowedRoles, requiredPermission }: ProtectedRouteProps) {
  const { user, profile, permissions, loading } = useAuth();

  const firstAllowedPath =
    PERMISSION_DEFINITIONS.find((perm) => perm.sidebarPath && permissions[perm.key] !== false)?.sidebarPath || '/staff-login';

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/staff-login" replace />;

  if (allowedRoles && !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (requiredPermission && !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (profile && profile.is_active === false) {
    return <Navigate to="/staff-login" replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/portal" replace />;
  }

  if (requiredPermission && permissions[requiredPermission] === false) {
    return <Navigate to={firstAllowedPath} replace />;
  }

  return <>{children}</>;
}
