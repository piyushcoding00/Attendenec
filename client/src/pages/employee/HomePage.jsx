import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  QrCode,
  Clock,
  UserCheck,
  Home as HomeIcon,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { attendanceService } from '../../services/api';
import {
  formatDate,
  formatTime,
  formatDuration,
} from '../../utils/formatters';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import LiveDateTime from '../../components/ui/LiveDateTime';

// ─── Main HomePage ────────────────────────────────────────────────────────────
export const HomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [todayRecord, setTodayRecord] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleCheckOut = () => navigate('/employee/scanner');

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [todayRes, historyRes] = await Promise.all([
        attendanceService.getToday().catch(() => null),
        attendanceService.getMyHistory({ limit: 30 }).catch(() => ({ data: [] })),
      ]);

      const rec = todayRes && 'data' in todayRes ? todayRes.data : todayRes;
      setTodayRecord(rec || null);
      setHistory(historyRes?.data || historyRes?.records || []);
    } catch (err) {
      setError(err.message || 'Unable to load your attendance overview');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const monthlyPresent = history.filter((r) => r.status === 'present').length;
  const monthlyLate = history.filter((r) => r.status === 'late').length;
  const monthlyWFH = history.filter((r) => r.status === 'wfh').length;
  const totalDays = history.length;
  const attendedCount = monthlyPresent + monthlyLate + monthlyWFH;
  const attendanceRate = totalDays > 0 ? Math.round((attendedCount / totalDays) * 100) : 100;

  const isCheckedIn = Boolean(todayRecord?.checkIn);
  const isCheckedOut = Boolean(todayRecord?.checkOut);

  if (isLoading) {
    return <div className="py-24"><LoadingSpinner size="lg" message="Loading your attendance status..." /></div>;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6 animate-fade-in">
      {/* 1. Greeting Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-[clamp(1.5rem,6vw,1.875rem)] font-extrabold text-white tracking-tight">
            {getGreeting()},{' '}
            <span className="bg-gradient-to-r from-primary-400 to-cyan-400 bg-clip-text text-transparent">
              {user?.name?.split(' ')[0] || 'Team'}
            </span>!
          </h1>
          <LiveDateTime
            className="mt-1 text-xs text-gray-400 sm:text-sm"
            timeClassName="text-cyan-300"
          />
        </div>

        <Link to="/employee/wfh">
          <Button variant="outline" size="sm" icon={HomeIcon} className="self-start sm:self-auto text-xs border-white/20 hover:border-cyan-400">
            Request WFH
          </Button>
        </Link>
      </div>

      {/* 2. Today's Attendance Card */}
      <div className="relative min-w-0 overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 via-navy-900/90 to-primary-950/40 border border-white/15 p-4 sm:p-6 lg:p-8 shadow-2xl">
        <div className="relative z-10 flex min-w-0 flex-col md:flex-row md:items-center md:justify-between gap-5 sm:gap-6">
          <div className="min-w-0 space-y-3">
            <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Today's Attendance Status</span>
              <Badge status={todayRecord?.status || 'not_checked_in'} size="md" dot={true} />
            </div>

            {!isCheckedIn ? (
              <div className="pt-1 min-w-0">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
                  <h2 className="text-[clamp(1.35rem,6vw,1.875rem)] font-extrabold leading-tight text-white">Not Marked Today</h2>
                </div>
                <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-md">
                  Scan your office QR code. The office kiosk will capture your attendance photo.
                </p>
              </div>
            ) : !isCheckedOut ? (
              <div className="pt-1 min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
                  <h2 className="text-[clamp(1.35rem,6vw,1.875rem)] font-extrabold leading-tight text-emerald-400">Checked In Today</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs sm:text-sm">
                  <span className="text-gray-300 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    Check-In: <span className="font-mono font-bold text-white">{formatTime(todayRecord.checkIn)}</span>
                  </span>
                  <span className="text-gray-400">|</span>
                  <span className="text-amber-400 font-medium">Awaiting Check-Out</span>
                </div>
              </div>
            ) : (
              <div className="pt-1 min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
                  <h2 className="text-[clamp(1.35rem,6vw,1.875rem)] font-extrabold leading-tight text-cyan-400">Day Completed</h2>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs sm:text-sm text-gray-300">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    In: <span className="font-mono font-bold text-white">{formatTime(todayRecord.checkIn)}</span>
                  </span>
                  <span className="text-gray-500">•</span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    Out: <span className="font-mono font-bold text-cyan-300">{formatTime(todayRecord.checkOut)}</span>
                  </span>
                  {todayRecord.workingMinutes > 0 && (
                    <>
                      <span className="text-gray-500">•</span>
                      <span className="text-emerald-400 font-medium">Duration: {formatDuration(todayRecord.workingMinutes)}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {actionSuccessMsg && (
              <p className="text-xs text-emerald-400 font-medium pt-1 animate-fade-in">✓ {actionSuccessMsg}</p>
            )}
          </div>

          {/* Action CTA */}
          <div className="w-full min-w-0 md:w-auto md:shrink-0">
            {!isCheckedIn ? (
              <div className="flex flex-col gap-2">
                {/* Primary: QR Scanner modal */}
                <Button
                  variant="primary"
                  size="lg"
                  icon={QrCode}
                  onClick={() => navigate('/employee/scanner')}
                  className="w-full sm:w-auto px-4 sm:px-6 py-3.5 text-sm sm:text-base font-bold shadow-glow"
                >
                  Mark Attendance
                </Button>
              </div>
            ) : !isCheckedOut ? (
              <Button
                variant="danger"
                size="lg"
                icon={Clock}
                onClick={handleCheckOut}
                className="w-full sm:w-auto px-8 py-3.5 text-base font-bold shadow-lg bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white border border-red-400/30"
              >
                Check Out
              </Button>
            ) : (
              <div className="p-3.5 px-6 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-center">
                <span className="text-xs text-cyan-400 font-bold flex items-center justify-center gap-1.5">
                  <UserCheck className="w-4 h-4" /> Checked Out
                </span>
                <span className="text-[11px] text-gray-400 font-mono mt-0.5 block">{formatTime(todayRecord.checkOut)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Ambient blur */}
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 3. Monthly Stats */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">This Month's Summary</h3>

        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: 'Present', value: monthlyPresent, color: 'text-emerald-400' },
            { label: 'Late', value: monthlyLate, color: 'text-amber-400' },
            { label: 'WFH', value: monthlyWFH, color: 'text-cyan-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
              <span className={`text-xs font-medium block mb-1 ${color}`}>{label}</span>
              <span className="text-2xl sm:text-3xl font-bold text-white">{value}</span>
              <span className="text-[10px] text-gray-500 block mt-0.5">days</span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="text-gray-300 font-medium flex items-center">
              <TrendingUp className="w-4 h-4 mr-1.5 text-primary-400" />
              Monthly Attendance Adherence
            </span>
            <span className="text-base font-bold text-white">{attendanceRate}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-navy-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-600 via-primary-500 to-cyan-400 transition-all duration-700"
              style={{ width: `${Math.min(100, attendanceRate)}%` }}
            />
          </div>
        </Card>
      </div>

      {/* 4. Recent Attendance Log */}
      <Card
        title="Recent Attendance Log"
        subtitle="Your latest 5 recorded days"
        action={
          <Link to="/employee/attendance" className="text-xs text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center">
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </Link>
        }
      >
        {history.length === 0 ? (
          <p className="text-xs text-gray-500 py-6 text-center">No past attendance records found</p>
        ) : (
          <div className="divide-y divide-white/5">
            {history.slice(0, 5).map((rec) => (
              <div key={rec._id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-white">{formatDate(rec.date, 'EEEE, MMM dd')}</p>
                  <p className="text-gray-400 font-mono text-[11px] mt-0.5">
                    {rec.checkIn ? formatTime(rec.checkIn) : '--:--'} —{' '}
                    {rec.checkOut ? formatTime(rec.checkOut) : '--:--'}
                  </p>
                </div>
                <div className="text-right">
                  <Badge status={rec.status} size="sm" />
                  {rec.workingMinutes > 0 && (
                    <span className="text-[10px] text-gray-400 block mt-0.5">{formatDuration(rec.workingMinutes)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default HomePage;
