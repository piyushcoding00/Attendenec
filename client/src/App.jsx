import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ROLES } from './utils/constants';

// Layouts
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const EmployeeLayout = lazy(() => import('./layouts/EmployeeLayout'));

// Public / Common Pages
const LoginPage = lazy(() => import('./pages/LoginPage'));
const VerificationPage = lazy(() => import('./pages/VerificationPage'));
const UnauthorizedPage = lazy(() => import('./pages/UnauthorizedPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const QRDisplayPage = lazy(() => import('./pages/office/QRDisplayPage'));

// Admin Pages
const AdminDashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const AdminEmployeesPage = lazy(() => import('./pages/admin/EmployeesPage'));
const AdminAttendancePage = lazy(() => import('./pages/admin/AttendancePage'));
const AdminWFHPage = lazy(() => import('./pages/admin/WFHPage'));
const AdminPoliciesPage = lazy(() => import('./pages/admin/PoliciesPage'));
const AdminQRDisplaysPage = lazy(() => import('./pages/admin/QRDisplaysPage'));
const AdminAuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage'));
const AdminInvitesPage = lazy(() => import('./pages/admin/AdminInvitesPage'));

// Employee Pages
const EmployeeHomePage = lazy(() => import('./pages/employee/HomePage'));
const EmployeeScannerPage = lazy(() => import('./pages/employee/ScannerPage'));
const EmployeeAttendanceHistoryPage = lazy(() => import('./pages/employee/AttendanceHistoryPage'));
const EmployeeWFHPage = lazy(() => import('./pages/employee/WFHPage'));
const EmployeeProfilePage = lazy(() => import('./pages/employee/ProfilePage'));

// Global Fallback Loader
export const LoadingFallback = () => (
  <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center space-y-4">
    <div className="w-12 h-12 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin"></div>
    <p className="text-slate-400 text-sm font-medium tracking-wide">Loading VorldX...</p>
  </div>
);

// ProtectedRoute: Verifies user session and allowed role list
export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user.role?.toLowerCase();
    const hasRole = allowedRoles.map((r) => r.toLowerCase()).includes(userRole);
    if (!hasRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

// AdminRoute: Restricts access to privileged admin roles
export const AdminRoute = ({ children }) => {
  return <ProtectedRoute allowedRoles={[ROLES.HR_ADMIN, ROLES.SUPER_ADMIN]}>{children}</ProtectedRoute>;
};

const SuperAdminRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>{children}</ProtectedRoute>
);

// EmployeeRoute: Restricts access to EMPLOYEE role
export const EmployeeRoute = ({ children }) => {
  return <ProtectedRoute allowedRoles={[ROLES.EMPLOYEE]}>{children}</ProtectedRoute>;
};

// Root Redirect based on user authentication and role
const RootRedirect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if ([ROLES.HR_ADMIN, ROLES.SUPER_ADMIN].includes(user.role?.toLowerCase())) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Navigate to="/employee/home" replace />;
};

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Root redirect based on role */}
        <Route path="/" element={<RootRedirect />} />

        {/* Public auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify" element={<VerificationPage />} />

        {/* Office QR display kiosk route */}
        <Route
          path="/office/qr-display"
          element={
            <AdminRoute>
              <QRDisplayPage />
            </AdminRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="employees" element={<AdminEmployeesPage />} />
          <Route path="attendance" element={<AdminAttendancePage />} />
          <Route path="wfh" element={<AdminWFHPage />} />
          <Route path="policies" element={<AdminPoliciesPage />} />
          <Route path="qr-displays" element={<AdminQRDisplaysPage />} />
          <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          <Route
            path="admin-invites"
            element={
              <SuperAdminRoute>
                <AdminInvitesPage />
              </SuperAdminRoute>
            }
          />
        </Route>

        {/* Employee Routes */}
        <Route
          path="/employee"
          element={
            <EmployeeRoute>
              <EmployeeLayout />
            </EmployeeRoute>
          }
        >
          <Route index element={<Navigate to="/employee/home" replace />} />
          <Route path="home" element={<EmployeeHomePage />} />
          <Route path="scanner" element={<EmployeeScannerPage />} />
          <Route path="attendance" element={<EmployeeAttendanceHistoryPage />} />
          <Route path="wfh" element={<EmployeeWFHPage />} />
          <Route path="profile" element={<EmployeeProfilePage />} />
        </Route>

        {/* Access and Error fallback routes */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
