import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Filter,
  CheckCircle,
  Clock,
  Home,
  XCircle,
  TrendingUp,
  Inbox,
} from 'lucide-react';
import { attendanceService } from '../../services/api';
import {
  formatDate,
  formatTime,
  formatDuration,
} from '../../utils/formatters';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';

const PRESETS = [
  { key: 'thisMonth', label: 'This Month' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'custom', label: 'Custom' },
];

export const AttendanceHistoryPage = () => {
  const [selectedPreset, setSelectedPreset] = useState('thisMonth');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper to compute date range from preset
  const calculatePresetDates = useCallback((preset) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'last7') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      return { start: toYMD(past), end: toYMD(now) };
    }
    if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: toYMD(firstDay), end: toYMD(now) };
    }
    if (preset === 'lastMonth') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: toYMD(firstDayLastMonth), end: toYMD(lastDayLastMonth) };
    }
    return { start: '', end: '' };
  }, []);

  const fetchHistory = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      setError(null);
      try {
        let s = startDate;
        let e = endDate;

        if (selectedPreset !== 'custom') {
          const range = calculatePresetDates(selectedPreset);
          s = range.start;
          e = range.end;
        }

        const params = {
          page,
          limit: 10,
        };
        if (s) params.startDate = s;
        if (e) params.endDate = e;

        const res = await attendanceService.getMyHistory(params);
        setRecords(res.data || res.records || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } catch (err) {
        console.error('Failed to load attendance history:', err);
        setError(err.message || 'Unable to retrieve your attendance logs');
      } finally {
        setIsLoading(false);
      }
    },
    [selectedPreset, startDate, endDate, calculatePresetDates]
  );

  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  const handlePresetClick = (presetKey) => {
    setSelectedPreset(presetKey);
    if (presetKey !== 'custom') {
      const range = calculatePresetDates(presetKey);
      setStartDate(range.start);
      setEndDate(range.end);
    }
  };

  // Compute summary stats from current records set
  const totalCount = records.length;
  const presentCount = records.filter((r) => r.status === 'present').length;
  const lateCount = records.filter((r) => r.status === 'late').length;
  const wfhCount = records.filter((r) => r.status === 'wfh').length;
  const absentCount = records.filter(
    (r) => r.status === 'incomplete' || r.status === 'not_checked_in'
  ).length;

  const attended = presentCount + lateCount + wfhCount;
  const attendanceRate =
    totalCount > 0 ? Math.round((attended / totalCount) * 100) : 100;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="min-w-0">
        <h1 className="text-[clamp(1.35rem,6vw,1.75rem)] font-bold leading-tight text-white tracking-tight">
          My Attendance History
        </h1>
        <p className="max-w-2xl text-xs sm:text-sm text-gray-400 mt-1 leading-relaxed">
          Review your recorded check-in times, shift durations, and remote days
        </p>
      </div>

      {/* Date Presets Row */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => handlePresetClick(p.key)}
            className={`min-h-10 w-full rounded-xl px-3 py-2 text-xs font-semibold transition-all sm:w-auto sm:px-3.5 ${
              selectedPreset === p.key
                ? 'bg-gradient-to-r from-primary-600 to-cyan-500 text-white shadow-glow'
                : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom Date Pickers when 'custom' selected */}
      {selectedPreset === 'custom' && (
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-white/5 p-3 sm:grid-cols-2 sm:p-4 animate-fade-in">
          <div>
            <label className="block text-xs text-gray-400 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg bg-navy-800 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg bg-navy-800 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>
        </div>
      )}

      {/* Summary Stats Row */}
      <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3">
        <div className="min-w-0 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 sm:p-3.5 text-center">
          <span className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold block mb-0.5">
            Present
          </span>
          <span className="text-xl sm:text-2xl font-bold text-emerald-400">
            {presentCount}
          </span>
        </div>

        <div className="min-w-0 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 sm:p-3.5 text-center">
          <span className="text-[11px] uppercase tracking-wider text-amber-300 font-semibold block mb-0.5">
            Late
          </span>
          <span className="text-xl sm:text-2xl font-bold text-amber-400">
            {lateCount}
          </span>
        </div>

        <div className="min-w-0 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3 sm:p-3.5 text-center">
          <span className="text-[11px] uppercase tracking-wider text-sky-300 font-semibold block mb-0.5">
            WFH
          </span>
          <span className="text-xl sm:text-2xl font-bold text-sky-400">
            {wfhCount}
          </span>
        </div>

        <div className="min-w-0 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 sm:p-3.5 text-center">
          <span className="text-[11px] uppercase tracking-wider text-red-300 font-semibold block mb-0.5">
            Absent
          </span>
          <span className="text-xl sm:text-2xl font-bold text-red-400">
            {absentCount}
          </span>
        </div>

        <div className="col-span-2 min-w-0 rounded-2xl border border-white/10 bg-white/5 p-3 sm:col-span-1 sm:p-3.5 text-center">
          <span className="text-[11px] uppercase tracking-wider text-cyan-300 font-semibold block mb-0.5">
            Rate
          </span>
          <span className="text-xl sm:text-2xl font-bold text-cyan-400">
            {attendanceRate}%
          </span>
        </div>
      </div>

      {/* Error state */}
      {error && <ErrorState message={error} onRetry={() => fetchHistory(1)} />}

      {/* Records List / Empty State */}
      {!error && (
        <div>
          {isLoading ? (
            <div className="py-16">
              <LoadingSpinner size="md" message="Loading records..." />
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No Attendance Records"
              message="No records found for the selected date range."
              className="px-4 py-8 sm:p-12"
            />
          ) : (
            <div className="space-y-3">
              {records.map((rec) => (
                <div
                  key={rec._id}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors hover:border-white/20"
                >
                  <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-navy-800 border border-white/10 flex flex-col items-center justify-center text-center shrink-0">
                      <span className="text-[10px] text-gray-400 uppercase font-semibold leading-none">
                        {formatDate(rec.date, 'MMM')}
                      </span>
                      <span className="text-sm font-bold text-white leading-none mt-0.5">
                        {formatDate(rec.date, 'dd')}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <p className="break-words font-semibold text-white text-sm">
                        {formatDate(rec.date, 'EEEE, MMMM dd, yyyy')}
                      </p>
                      <p className="break-words text-xs text-gray-400 font-mono mt-0.5">
                        Check-In: {rec.checkIn ? formatTime(rec.checkIn) : '--:--'} &bull; Check-Out: {rec.checkOut ? formatTime(rec.checkOut) : '--:--'}
                      </p>
                    </div>
                  </div>

                  <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end sm:gap-4">
                    {rec.workingMinutes > 0 && (
                      <span className="text-xs text-gray-300 font-medium">
                        {formatDuration(rec.workingMinutes)}
                      </span>
                    )}
                    <Badge status={rec.status} size="sm" />
                  </div>
                </div>
              ))}

              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={(p) => fetchHistory(p)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceHistoryPage;
