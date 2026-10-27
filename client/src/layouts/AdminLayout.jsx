import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Home,
  Settings,
  QrCode,
  Shield,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

const navItems = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Employees', path: '/admin/employees', icon: Users },
  { label: 'Attendance', path: '/admin/attendance', icon: ClipboardList },
  { label: 'WFH Requests', path: '/admin/wfh', icon: Home },
  { label: 'Policies', path: '/admin/policies', icon: Settings },
  { label: 'QR Displays', path: '/admin/qr-displays', icon: QrCode },
  { label: 'Audit Logs', path: '/admin/audit-logs', icon: Shield },
  { label: 'Admin Invites', path: '/admin/admin-invites', icon: UserPlus, superAdminOnly: true },
];

export const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutError('');
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to sign out:', error);
      setLogoutError(error.message || 'Unable to sign out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="h-[100dvh] min-h-screen bg-navy-950 text-slate-100 flex relative overflow-hidden">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy-950/80 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar: Fixed 64px on mobile (or sliding drawer on open), 256px on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col justify-between bg-navy-900/95 backdrop-blur-md border-r border-white/10 transition-all duration-300 ${
          mobileMenuOpen
            ? 'w-[min(18rem,calc(100vw-2rem))] translate-x-0'
            : '-translate-x-full lg:translate-x-0 w-16 lg:w-64'
        }`}
      >
        {/* Top: Logo & App Brand */}
        <div>
          <div className="h-16 flex items-center justify-between px-3.5 lg:px-6 border-b border-white/10">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 via-primary-500 to-cyan-400 flex items-center justify-center font-black text-white text-base shadow-glow shrink-0">
                VX
              </div>
              <div className={`${mobileMenuOpen ? 'block' : 'hidden lg:block'} min-w-0 truncate`}>
                <h1 className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-400 bg-clip-text text-transparent leading-none">
                  VORLDX
                </h1>
                <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-semibold">
                  Admin Portal
                </span>
              </div>
            </div>

            {/* Close button inside mobile open drawer */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-2 lg:p-4 space-y-1.5">
            {navItems
              .filter((item) => !item.superAdminOnly || user?.role === 'super_admin')
              .map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center rounded-xl text-sm font-medium transition-all duration-200 group px-3 py-2.5 ${
                        isActive
                          ? 'bg-gradient-to-r from-primary-600/20 to-cyan-500/10 text-cyan-300 border-l-2 border-cyan-400 shadow-sm'
                          : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                      }`
                    }
                    title={item.label}
                  >
                    <Icon className="w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                    <span className={`ml-3 min-w-0 truncate ${mobileMenuOpen ? 'block' : 'hidden lg:block'}`}>
                      {item.label}
                    </span>
                  </NavLink>
                );
              })}
          </nav>
        </div>

        {/* Bottom: User Info & Logout */}
        <div className="p-2 lg:p-4 border-t border-white/10 bg-navy-950/40">
          <div className="flex items-center space-x-3 px-1 lg:px-2 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-600 to-cyan-500 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-md">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AD'}
            </div>
            <div className={`${mobileMenuOpen ? 'block' : 'hidden lg:block'} min-w-0 truncate`}>
              <p className="text-sm font-semibold text-white truncate">
                {user?.name || 'Administrator'}
              </p>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <Badge
                  status={user?.role || 'hr_admin'}
                  size="sm"
                  label={user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'hr_admin' ? 'HR Admin' : 'Admin'}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setLogoutError('');
              setLogoutConfirmOpen(true);
            }}
            className="w-full flex items-center justify-center lg:justify-start px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={`ml-2 ${mobileMenuOpen ? 'inline' : 'hidden lg:inline'}`}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 lg:pl-64 transition-all duration-300">
        {/* Mobile Header Bar */}
        <header className="sticky top-0 z-30 h-16 shrink-0 bg-navy-900/95 backdrop-blur-md border-b border-white/10 px-4 flex items-center justify-between lg:hidden">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 focus:outline-none"
              aria-label="Open navigation menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-primary-600 to-cyan-400 flex items-center justify-center font-black text-white text-xs">
                VX
              </div>
              <span className="font-bold text-white tracking-tight">VORLDX</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Badge
              status={user?.role || 'hr_admin'}
              size="sm"
              label={user?.role === 'super_admin' ? 'Super Admin' : 'HR Admin'}
            />
          </div>
        </header>

        {/* Content Outlet */}
        <main
          ref={contentRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:p-6 lg:p-8 max-w-7xl w-full mx-auto"
        >
          <Suspense
            fallback={
              <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3" role="status" aria-live="polite">
                <div className="h-9 w-9 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-400" />
                <p className="text-sm font-medium text-slate-400">Loading page...</p>
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>

      <Modal
        isOpen={logoutConfirmOpen}
        onClose={() => !isLoggingOut && setLogoutConfirmOpen(false)}
        title="Confirm sign out"
        size="sm"
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-white">Are you sure you want to sign out?</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-400">
                You will need to sign in again to access the admin portal.
              </p>
            </div>
          </div>

          {logoutError && (
            <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              {logoutError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setLogoutConfirmOpen(false)}
              disabled={isLoggingOut}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-red-500 hover:to-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? 'Signing out...' : 'Yes, sign out'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminLayout;
