import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserCheck,
  Clock,
  Home,
  AlertCircle,
  TrendingUp,
  Check,
  X,
  Calendar,
  Building,
  Activity,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import { dashboardService, wfhService } from '../../services/api';
import { formatDate, formatTime, formatDuration } from '../../utils/formatters';
import StatsCard from '../../components/ui/StatsCard';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import LiveDateTime from '../../components/ui/LiveDateTime';

// Custom Tooltip for Recharts
const CustomChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-navy-900/95 backdrop-blur-md border border-white/15 p-3 rounded-xl shadow-xl text-xs space-y-1">
        <p className="font-semibold text-white border-b border-white/10 pb-1 mb-1">
          {label}
        </p>
        {payload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center justify-between space-x-4">
            <span className="flex items-center space-x-1.5" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="capitalize">{entry.name}:</span>
            </span>
            <span className="font-bold text-white">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState({});

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await dashboardService.getSummary();
      setData(res.data || res);
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
      setError(err.message || 'Failed to load dashboard overview');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Inline decision handler for recent WFH items
  const handleQuickDecision = async (requestId, status) => {
    setDecisionLoading((prev) => ({ ...prev, [requestId]: true }));
    try {
      await wfhService.makeDecision(requestId, {
        status,
        reviewComment: `Reviewed from dashboard as ${status}`,
      });
      // Refetch summary to update stats & list
      await fetchSummary();
    } catch (err) {
      alert(err.message || `Failed to ${status} request`);
    } finally {
      setDecisionLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="py-24">
        <LoadingSpinner size="lg" message="Loading dashboard metrics..." />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchSummary} />;
  }

  const { overview = {}, deptAttendance = [], attendanceTrend = [], recentActivity = [], recentWFH = [] } =
    data || {};
  const visibleWFH = recentWFH.filter((request) => request.employee?.name);
  const visibleActivity = recentActivity.filter((record) => record.employee?.name);

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* Top Banner / Welcome */}
      <div className="relative flex min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-navy-900/90 via-navy-900/70 to-primary-950/30 p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6">
        <div className="relative z-10 min-w-0">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400 sm:text-xs">
            VorldX • Workforce overview
          </p>
          <h1 className="text-[clamp(1.35rem,5vw,1.875rem)] font-bold leading-tight text-white tracking-tight">
            Executive Attendance Dashboard
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-400 sm:text-sm">
            Real-time workplace occupancy, shift attendance trends, and approval queues
          </p>
        </div>
        <LiveDateTime
          className="relative z-10 self-start rounded-xl border border-white/10 bg-navy-950/60 px-3 py-2 text-xs text-gray-300 sm:shrink-0 sm:self-auto sm:px-3.5"
          dateClassName="text-gray-300"
          timeClassName="text-cyan-300"
        />
        <div className="pointer-events-none absolute -right-12 -top-20 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      {/* 1. Stats Row (5 StatsCards) */}
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
        <StatsCard
          title="Total Employees"
          value={overview.totalEmployees ?? 0}
          subtitle="Registered staff"
          icon={Users}
          color="blue"
        />
        <StatsCard
          title="Present Today"
          value={overview.presentToday ?? 0}
          subtitle={`${overview.attendanceRate ?? 0}% attendance rate`}
          icon={UserCheck}
          color="green"
          trend={`${overview.attendanceRate ?? 0}%`}
          trendUp={true}
        />
        <StatsCard
          title="Late Arrivals"
          value={overview.lateToday ?? 0}
          subtitle="Past shift start"
          icon={Clock}
          color="yellow"
        />
        <StatsCard
          title="WFH Today"
          value={overview.wfhToday ?? 0}
          subtitle="Approved remote"
          icon={Home}
          color="cyan"
        />
        <StatsCard
          title="Pending WFH"
          value={overview.pendingWFH ?? 0}
          subtitle="Awaiting review"
          icon={AlertCircle}
          color="purple"
        />
      </div>

      {/* 2 & 3. Trend Chart + Department Breakdown */}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Attendance Trend (2 cols on lg) */}
        <Card
          className="min-w-0 lg:col-span-2"
          title="7-Day Attendance Trend"
          subtitle="Daily present, late, and work-from-home distributions"
        >
          <div className="h-64 min-w-0 w-full pt-3 sm:h-72 sm:pt-4">
            {attendanceTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={attendanceTrend}
                  margin={{ top: 10, right: 4, left: -26, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#eab308" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#eab308" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorWFH" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    tickFormatter={(val) => {
                      try {
                        const parts = val.split('-');
                        return `${parts[1]}/${parts[2]}`;
                      } catch {
                        return val;
                      }
                    }}
                  />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={30} />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="present"
                    name="Present"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPresent)"
                  />
                  <Area
                    type="monotone"
                    dataKey="late"
                    name="Late"
                    stroke="#eab308"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorLate)"
                  />
                  <Area
                    type="monotone"
                    dataKey="wfh"
                    name="WFH"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorWFH)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-500">
                No trend data available
              </div>
            )}
          </div>
        </Card>

        {/* Department Attendance (1 col on lg) */}
        <Card
          title="Department Attendance"
          subtitle="Staff checked in today by department"
        >
          <div className="min-h-48 max-h-72 min-w-0 w-full overflow-y-auto pt-2 sm:h-72">
            {deptAttendance.length > 0 ? (
              <div className="space-y-3.5">
                {deptAttendance.map((item, idx) => (
                  <div key={idx} className="min-w-0 space-y-1.5">
                    <div className="flex min-w-0 items-start justify-between gap-3 text-xs">
                      <span className="min-w-0 break-words font-medium text-gray-300">
                        {item.department || 'General'}
                      </span>
                      <span className="font-bold text-white">
                        {item.count}{' '}
                        <span className="text-[10px] text-gray-500 font-normal">present</span>
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-navy-800/80 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary-600 to-cyan-400 transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (item.count / Math.max(1, overview.presentToday || 1)) * 100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-gray-500">
                <Building className="w-8 h-8 text-gray-600 mb-2" />
                No department check-ins recorded yet today
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 4 & 5. Recent WFH Requests + Recent Activity Feed */}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Recent WFH Requests with inline Approve/Reject */}
        <Card
          title="Recent WFH Requests"
          subtitle="Latest requests from your employee records"
        >
          {visibleWFH.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-4 py-10 text-center">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-gray-500">
                <Home className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-gray-300">No WFH requests yet</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-gray-500">
                New employee requests will appear here when they are submitted.
              </p>
            </div>
          ) : (
            <div className="max-h-[26rem] divide-y divide-white/[0.07] overflow-y-auto pr-1">
              {visibleWFH.map((req) => (
                <div
                  key={req._id}
                  className="group flex min-w-0 flex-col gap-3 rounded-xl py-4 text-xs transition-colors first:pt-1 last:pb-1 hover:bg-white/[0.02] sm:flex-row sm:items-start sm:justify-between sm:px-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                      <span className="max-w-full break-words text-sm font-semibold text-white">
                        {req.employee.name}
                      </span>
                      {req.employee.employeeId && (
                        <span className="break-all font-mono text-[10px] text-gray-500">
                          {req.employee.employeeId}
                        </span>
                      )}
                      <Badge status={req.status} size="sm" />
                    </div>
                    {req.employee.department && (
                      <p className="mt-1 text-[11px] text-gray-500">{req.employee.department}</p>
                    )}
                    <p className="mt-2 flex items-start gap-1.5 leading-relaxed text-gray-400">
                      <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500" />
                      <span className="min-w-0 break-words">
                        {formatDate(req.requestedDate, 'MMM dd, yyyy')}
                        {req.reason && <><span className="mx-1.5 text-gray-600">·</span>{req.reason}</>}
                      </span>
                    </p>
                  </div>

                  {req.status === 'pending' ? (
                    <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleQuickDecision(req._id, 'approved')}
                        disabled={decisionLoading[req._id]}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-1.5 text-emerald-400 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                        aria-label="Approve WFH request"
                        title="Approve"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDecision(req._id, 'rejected')}
                        disabled={decisionLoading[req._id]}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/15 p-1.5 text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                        aria-label="Reject WFH request"
                        title="Reject"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Activity Feed (Last check-ins) */}
        <Card
          title="Recent Activity Feed"
          subtitle="Latest attendance recorded by employees"
        >
          {visibleActivity.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-4 py-10 text-center">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-gray-500">
                <Activity className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-gray-300">No attendance activity yet</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-gray-500">
                Employee check-ins will appear here once recorded.
              </p>
            </div>
          ) : (
            <div className="max-h-[26rem] divide-y divide-white/[0.07] overflow-y-auto pr-1">
              {visibleActivity.map((record) => (
                <div
                  key={record._id}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-xl py-3.5 text-xs transition-colors hover:bg-white/[0.02] sm:px-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-400/15 bg-cyan-400/[0.07] font-semibold text-cyan-300">
                      {record.employee.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-white">
                        {record.employee.name}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-gray-400">
                        {record.employee.department && <span>{record.employee.department}</span>}
                        {record.employee.department && <span className="text-gray-600">·</span>}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-cyan-500" />
                          {record.checkIn && formatTime(record.checkIn)}
                        </span>
                        <span className="text-gray-600">·</span>
                        <span>{formatDate(record.date, 'MMM dd')}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge status={record.status} size="sm" />
                    {record.workingMinutes > 0 && (
                      <p className="text-[10px] font-medium text-gray-400">
                        {formatDuration(record.workingMinutes)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
