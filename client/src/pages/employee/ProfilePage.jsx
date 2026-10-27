import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Building,
  Briefcase,
  Calendar,
  Shield,
  LogOut,
  Sparkles,
  KeyRound,
  Laptop,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/formatters';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

export const ProfilePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'VX';
    return name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="mx-auto min-w-0 max-w-2xl space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header Profile Hero */}
      <div className="relative flex min-w-0 items-center gap-4 overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-navy-900 via-navy-900/90 to-primary-950/40 p-4 text-left shadow-2xl sm:gap-6 sm:p-8">
        {/* Large Gradient Avatar */}
        <div className="h-16 w-16 shrink-0 rounded-full bg-gradient-to-tr from-primary-600 via-primary-500 to-cyan-400 p-1 shadow-glow sm:h-24 sm:w-24">
          <div className="w-full h-full rounded-full bg-navy-950 flex items-center justify-center font-black text-2xl sm:text-3xl text-cyan-300">
            {getInitials(user?.name)}
          </div>
        </div>

        <div className="relative z-10 min-w-0 flex-1 space-y-1.5">
          <h2 className="break-words text-xl font-bold leading-tight text-white tracking-tight sm:text-2xl">
            {user?.name || 'VorldX Team Member'}
          </h2>
          <p className="break-all text-xs font-mono text-cyan-400">
            {user?.employeeId || 'VX-0000'}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge
              status={user?.role || 'employee'}
              size="sm"
              label={user?.role === 'hr_admin' ? 'HR Admin' : 'Employee'}
            />
            {user?.designation && (
              <span className="max-w-full break-words rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300">
                {user.designation}
              </span>
            )}
          </div>
        </div>

        <div className="absolute -right-8 -top-8 w-40 h-40 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* 1. Personal & Contact Information */}
      <Card title="Personal Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
          <div className="min-w-0 rounded-xl border border-white/5 bg-navy-950/60 p-3 space-y-1">
            <span className="text-gray-400 flex items-center text-xs">
              <User className="w-3.5 h-3.5 mr-1 shrink-0 text-primary-400" /> Full Name
            </span>
            <p className="break-words font-semibold text-white">{user?.name || '-'}</p>
          </div>

          <div className="min-w-0 rounded-xl border border-white/5 bg-navy-950/60 p-3 space-y-1">
            <span className="text-gray-400 flex items-center text-xs">
              <Mail className="w-3.5 h-3.5 mr-1 shrink-0 text-primary-400" /> Work Email
            </span>
            <p className="break-all font-semibold text-white">
              {user?.email || 'Not configured'}
            </p>
          </div>
        </div>
      </Card>

      {/* 2. Employment & Work Info */}
      <Card title="Work & Department Assignment">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
          <div className="min-w-0 rounded-xl border border-white/5 bg-navy-950/60 p-3 space-y-1">
            <span className="text-gray-400 flex items-center text-xs">
              <Building className="w-3.5 h-3.5 mr-1 shrink-0 text-cyan-400" /> Department
            </span>
            <p className="break-words font-semibold text-white">
              {user?.department || 'General'}
            </p>
          </div>

          <div className="min-w-0 rounded-xl border border-white/5 bg-navy-950/60 p-3 space-y-1">
            <span className="text-gray-400 flex items-center text-xs">
              <Briefcase className="w-3.5 h-3.5 mr-1 shrink-0 text-cyan-400" /> Designation
            </span>
            <p className="break-words font-semibold text-white">
              {user?.designation || 'Staff'}
            </p>
          </div>

          <div className="min-w-0 rounded-xl border border-white/5 bg-navy-950/60 p-3 space-y-1">
            <span className="text-gray-400 flex items-center text-xs">
              <Laptop className="w-3.5 h-3.5 mr-1 shrink-0 text-cyan-400" /> Work Mode
            </span>
            <p className="font-semibold text-white capitalize">
              {user?.workType || 'Office'}
            </p>
          </div>

          <div className="min-w-0 rounded-xl border border-white/5 bg-navy-950/60 p-3 space-y-1">
            <span className="text-gray-400 flex items-center text-xs">
              <Calendar className="w-3.5 h-3.5 mr-1 shrink-0 text-cyan-400" /> Joining Date
            </span>
            <p className="font-semibold text-white">
              {user?.joiningDate ? formatDate(user.joiningDate, 'MMMM dd, yyyy') : '-'}
            </p>
          </div>
        </div>
      </Card>

      {/* 3. Account Security Info */}
      <Card title="Account Credentials & Security">
        <div className="space-y-3 text-xs sm:text-sm">
          <div className="flex min-w-0 flex-col items-start gap-2 rounded-xl border border-white/5 bg-navy-950/60 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="text-white font-medium block">Account Status</span>
              <span className="block break-words text-gray-400 text-xs">
                Verification completed and credential activated
              </span>
            </div>
            <Badge status="active" size="sm" label="Active" />
          </div>

          <div className="flex min-w-0 flex-col items-start gap-2 rounded-xl border border-white/5 bg-navy-950/60 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="text-white font-medium block">WFH Privileges</span>
              <span className="block break-words text-gray-400 text-xs">
                Eligibility for remote attendance
              </span>
            </div>
            <span
              className={`max-w-full break-words text-xs font-semibold px-2.5 py-1 rounded-full border ${
                user?.wfhEligible
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
              }`}
            >
              {user?.wfhEligible ? 'Eligible' : 'Office Standard'}
            </span>
          </div>
        </div>
      </Card>

      {/* Logout Action */}
      <div className="pt-1">
        <Button
          variant="danger"
          size="lg"
          onClick={handleLogout}
          icon={LogOut}
          className="min-h-12 w-full whitespace-normal shadow-sm"
        >
          Sign Out of VorldX
        </Button>
      </div>
    </div>
  );
};

export default ProfilePage;
