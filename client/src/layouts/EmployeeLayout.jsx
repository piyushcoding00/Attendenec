import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Camera,
  CalendarCheck,
  CalendarDays,
  User,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { label: 'Home', path: '/employee/home', icon: Home },
  { label: 'Attendance', path: '/employee/scanner', icon: Camera, isSpecial: true },
  { label: 'History', path: '/employee/attendance', icon: CalendarDays },
  { label: 'WFH', path: '/employee/wfh', icon: CalendarCheck },
  { label: 'Profile', path: '/employee/profile', icon: User },
];

export const EmployeeLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Extract page title from route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/scanner')) return 'Mark Attendance';
    if (path.includes('/attendance')) return 'My History';
    if (path.includes('/wfh')) return 'WFH Portal';
    if (path.includes('/profile')) return 'My Profile';
    return 'Attendance Portal';
  };

  return (
    <div className="min-h-screen min-h-[100dvh] min-w-0 bg-navy-950 text-slate-100 flex flex-col md:flex-row">
      {/* Desktop Sidebar (visible on md and up) */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-navy-900/90 backdrop-blur-md border-r border-white/10 p-5 shrink-0 fixed inset-y-0 left-0 z-30">
        <div>
          {/* Logo */}
          <div className="flex items-center space-x-3 mb-8 px-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary-600 via-primary-500 to-cyan-400 flex items-center justify-center font-black text-white text-base shadow-glow">
              VX
            </div>
            <div>
              <h1 className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent leading-none">
                VORLDX
              </h1>
              <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-semibold">
                Employee Hub
              </span>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                      isActive
                        ? 'bg-gradient-to-r from-primary-600/25 to-cyan-500/10 text-cyan-300 border-l-2 border-cyan-400 shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                    }`
                  }
                >
                  <Icon
                    className={`w-5 h-5 mr-3 transition-transform group-hover:scale-110 ${
                      item.isSpecial ? 'text-cyan-400' : ''
                    }`}
                  />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="pt-4 border-t border-white/10">
          <div className="flex items-center space-x-3 px-2 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-600 to-cyan-500 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-md">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'EM'}
            </div>
            <div className="truncate">
              <p className="text-sm font-semibold text-white truncate">
                {user?.name || 'Staff Member'}
              </p>
              <p className="text-xs text-gray-400 font-mono">
                {user?.employeeId || 'VX-0000'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="min-w-0 flex-1 flex flex-col md:pl-64 min-h-screen min-h-[100dvh]">
        {/* Mobile Header Bar */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-navy-900/90 px-4 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-600 to-cyan-400 flex items-center justify-center font-bold text-white text-xs shadow-glow">
              VX
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-white text-sm leading-tight">
                {getPageTitle()}
              </h2>
              <span className="block truncate text-[11px] text-cyan-400 font-mono">
                {user?.employeeId || 'VorldX'}
              </span>
            </div>
          </div>

          {/* User Avatar */}
          <NavLink
            to="/employee/profile"
            aria-label="Open profile"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-navy-800 font-bold text-xs text-white"
          >
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </NavLink>
        </header>

        {/* Content Body: pb-24 on mobile to prevent overlap with bottom nav */}
        <main className="min-w-0 flex-1 p-3 sm:p-6 lg:p-8 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-8 max-w-5xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Mobile Fixed Bottom Navigation Bar */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-center justify-items-center border-t border-white/10 bg-navy-900/95 px-2 pt-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
          style={{ minHeight: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
          aria-label="Employee navigation"
        >
          {navItems.map((item) => {
            const Icon = item.icon;

            if (item.isSpecial) {
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className="flex h-full min-w-0 w-full flex-col items-center justify-center text-white transition-transform active:scale-95"
                  aria-label="Mark attendance"
                >
                  {({ isActive }) => (
                    <>
                      <span className={`-mt-5 flex h-14 w-14 max-w-full flex-col items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-tr from-primary-600 to-cyan-500 text-white shadow-glow ${
                        isActive ? 'ring-2 ring-white ring-offset-2 ring-offset-navy-950' : ''
                      }`}>
                        <Icon className="h-6 w-6 shrink-0" />
                      </span>
                      <span className="-mt-0.5 max-w-full whitespace-nowrap text-[9px] font-bold leading-none">Attendance</span>
                    </>
                  )}
                </NavLink>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `relative flex h-full min-w-0 w-full flex-col items-center justify-center gap-1 py-1.5 transition-colors ${
                    isActive
                      ? 'text-cyan-400 font-semibold'
                      : 'text-gray-400 hover:text-slate-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute top-0 w-6 h-0.5 bg-cyan-400 rounded-full" />
                    )}
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="max-w-full truncate text-[10px] leading-none">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default EmployeeLayout;
