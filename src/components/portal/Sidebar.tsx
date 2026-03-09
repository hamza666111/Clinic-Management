import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smile, LayoutDashboard, Users, Calendar, FileText, Receipt,
  Pill, UserCog, Building2, LogOut, ChevronLeft, Menu, X, Stethoscope, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';

const navItems = [
  { to: '/portal', label: 'Dashboard', icon: LayoutDashboard, permissionKey: 'view_dashboard', exact: true },
  { to: '/portal/patients', label: 'Patients', icon: Users, permissionKey: 'manage_patients' },
  { to: '/portal/appointments', label: 'Appointments', icon: Calendar, permissionKey: 'manage_appointments' },
  { to: '/portal/prescriptions', label: 'Prescriptions', icon: FileText, permissionKey: 'manage_prescriptions' },
  { to: '/portal/billing', label: 'Billing', icon: Receipt, permissionKey: 'manage_billing' },
  { to: '/portal/services', label: 'Services', icon: Stethoscope, permissionKey: 'manage_services' },
  { to: '/portal/medicines', label: 'Medicines', icon: Pill, permissionKey: 'manage_medicines' },
  { to: '/portal/users', label: 'Users', icon: UserCog, permissionKey: 'manage_users' },
  { to: '/portal/staff-roles', label: 'Staff Roles', icon: ShieldCheck, permissionKey: 'manage_staff_roles' },
  { to: '/portal/clinics', label: 'Clinics', icon: Building2, permissionKey: 'manage_clinics' },
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  clinic_admin: 'Clinic Admin',
  doctor: 'Doctor',
  assistant: 'Assistant',
  receptionist: 'Receptionist',
};

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, permissions, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    navigate('/staff-login');
  };

  const allowedItems = navItems.filter((item) => permissions[item.permissionKey] === true);

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col h-full ${mobile ? '' : ''}`}>
      <div className={`flex items-center gap-3 p-5 border-b border-gray-100 ${collapsed && !mobile ? 'justify-center px-3' : ''}`}>
        <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-cyan-600 rounded-xl flex items-center justify-center shrink-0">
          <Smile className="w-5 h-5 text-white" />
        </div>
        {(!collapsed || mobile) && (
          <div>
            <p className="font-bold text-gray-900 text-sm">PearlSmile</p>
            <p className="text-xs text-sky-600">Staff Portal</p>
          </div>
        )}
        {!mobile && (
          <button onClick={() => setCollapsed(!collapsed)} className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {(!collapsed || mobile) && profile && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3 bg-sky-50 rounded-xl p-3">
            <div className="w-9 h-9 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0">
              {profile.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{profile.name}</p>
              <p className="text-xs text-sky-600">{ROLE_LABELS[profile.role] || profile.role}</p>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {allowedItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            onClick={() => mobile && setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-500/25'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              } ${collapsed && !mobile ? 'justify-center px-2' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                {(!collapsed || mobile) && <span>{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={`p-3 border-t border-gray-100 ${collapsed && !mobile ? 'flex justify-center' : ''}`}>
        <button
          onClick={handleSignOut}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 transition-all w-full ${collapsed && !mobile ? 'justify-center' : ''}`}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {(!collapsed || mobile) && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.2 }}
        className="hidden lg:flex flex-col bg-white border-r border-gray-100 h-screen sticky top-0 overflow-hidden shrink-0"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile Toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center shadow-sm"
      >
        <Menu className="w-5 h-5 text-gray-600" />
      </button>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-64 bg-white z-50 overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-sky-400 to-cyan-600 rounded-lg flex items-center justify-center">
                    <Smile className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-gray-900">PearlSmile</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <SidebarContent mobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
