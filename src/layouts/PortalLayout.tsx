import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/portal/Sidebar';
import PortalHeader from '../components/portal/PortalHeader';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/portal': { title: 'Dashboard', subtitle: 'Overview of your clinic activities' },
  '/portal/patients': { title: 'Patient Management', subtitle: 'Manage patient records and history' },
  '/portal/appointments': { title: 'Appointments', subtitle: 'Schedule and manage appointments' },
  '/portal/prescriptions': { title: 'Prescriptions', subtitle: 'Create and manage prescriptions' },
  '/portal/billing': { title: 'Billing & Invoices', subtitle: 'Manage invoices and payments' },
  '/portal/services': { title: 'Services', subtitle: 'Manage service categories and prices' },
  '/portal/medicines': { title: 'Medicine Master List', subtitle: 'Manage the medicines database' },
  '/portal/users': { title: 'User Management', subtitle: 'Manage staff accounts and roles' },
  '/portal/staff-roles': { title: 'Staff & Roles', subtitle: 'Manage staff roles and access permissions' },
  '/portal/clinics': { title: 'Clinics', subtitle: 'Manage clinic locations' },
};

export default function PortalLayout() {
  const location = useLocation();
  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'Portal', subtitle: '' };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PortalHeader title={pageInfo.title} subtitle={pageInfo.subtitle} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
