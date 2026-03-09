import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import PublicLayout from './layouts/PublicLayout';
import PortalLayout from './layouts/PortalLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import LoadingSpinner from './components/ui/LoadingSpinner';

const HomePage = lazy(() => import('./pages/public/HomePage'));
const ServicesPage = lazy(() => import('./pages/public/ServicesPage'));
const BeforeAfterPage = lazy(() => import('./pages/public/BeforeAfterPage'));
const ReviewsPage = lazy(() => import('./pages/public/ReviewsPage'));
const AboutPage = lazy(() => import('./pages/public/AboutPage'));
const ContactPage = lazy(() => import('./pages/public/ContactPage'));
const StaffLoginPage = lazy(() => import('./pages/StaffLoginPage'));

const DashboardPage = lazy(() => import('./pages/portal/DashboardPage'));
const PatientsPage = lazy(() => import('./pages/portal/PatientsPage'));
const AppointmentsPage = lazy(() => import('./pages/portal/AppointmentsPage'));
const PrescriptionsPage = lazy(() => import('./pages/portal/PrescriptionsPage'));
const BillingPage = lazy(() => import('./pages/portal/BillingPage'));
const MedicinesPage = lazy(() => import('./pages/portal/MedicinesPage'));
const DentalServicesPage = lazy(() => import('./pages/portal/DentalServicesPage'));
const UsersPage = lazy(() => import('./pages/portal/UsersPage'));
const StaffRolesPage = lazy(() => import('./pages/portal/StaffRolesPage'));
const ClinicsPage = lazy(() => import('./pages/portal/ClinicsPage'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <LoadingSpinner size="lg" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { borderRadius: '12px', fontSize: '14px', fontWeight: '500' },
            success: { style: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' } },
            error: { style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' } },
          }}
        />

        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<HomePage />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="before-after" element={<BeforeAfterPage />} />
              <Route path="reviews" element={<ReviewsPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="contact" element={<ContactPage />} />
            </Route>

            <Route path="staff-login" element={<StaffLoginPage />} />

            <Route
              path="portal"
              element={
                <ProtectedRoute>
                  <PortalLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="patients" element={<PatientsPage />} />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route
                path="prescriptions"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'doctor']}>
                    <PrescriptionsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="billing"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'doctor']}>
                    <BillingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="medicines"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'clinic_admin', 'doctor']}>
                    <MedicinesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="services"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'doctor', 'receptionist']}>
                    <DentalServicesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="users"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="staff-roles"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'clinic_admin']}>
                    <StaffRolesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="clinics"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ClinicsPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
