import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Filter,
  Search,
  Calendar,
  Lock,
  Clock,
  Globe,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { auditLogService } from '../../services/api';
import { formatDateTime } from '../../utils/formatters';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Pagination from '../../components/ui/Pagination';
import ErrorState from '../../components/ui/ErrorState';

// Helper to determine badge styling for various audit actions
const getActionBadge = (action = '') => {
  const act = action.toUpperCase();

  if (act.includes('LOGIN') || act.includes('LOGOUT')) {
    return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  }
  if (act.includes('CHECK_IN') || act.includes('CHECK_OUT') || act.includes('ATTENDANCE_CHECK')) {
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  }
  if (act.includes('CORRECTED')) {
    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  }
  if (act.startsWith('WFH_')) {
    return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
  }
  if (act.includes('FAILED') || act.includes('DEACTIVATED') || act.includes('BLOCKED')) {
    return 'bg-red-500/15 text-red-400 border-red-500/30';
  }
  if (act.startsWith('POLICY_')) {
    return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
  }

  return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
};

export const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = {
          page,
          limit: 20,
        };
        if (actionFilter) params.action = actionFilter;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const res = await auditLogService.getAll(params);
        setLogs(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } catch (err) {
        console.error('Failed to load audit logs:', err);
        setError(err.message || 'Unable to retrieve audit logs');
      } finally {
        setIsLoading(false);
      }
    },
    [actionFilter, startDate, endDate]
  );

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const columns = [
    {
      key: 'timestamp',
      label: 'Timestamp',
      render: (row) => (
        <span className="font-mono text-xs text-gray-300">
          {formatDateTime(row.timestamp || row.createdAt)}
        </span>
      ),
    },
    {
      key: 'actor',
      label: 'Actor ID',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-cyan-400">
          {row.actorEmployeeId || row.actor?.employeeId || 'SYSTEM'}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border ${getActionBadge(
            row.action
          )}`}
        >
          {row.action}
        </span>
      ),
    },
    {
      key: 'target',
      label: 'Target Entity',
      render: (row) => (
        <div className="text-xs">
          <span className="text-gray-300 font-medium">
            {row.targetType || 'System'}
          </span>
          {row.targetEmployeeId && (
            <span className="text-gray-500 block font-mono">
              ({row.targetEmployeeId})
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'ip',
      label: 'Client IP',
      render: (row) => (
        <span className="font-mono text-xs text-gray-400">
          {row.ipAddress || row.ip || '127.0.0.1'}
        </span>
      ),
    },
    {
      key: 'details',
      label: 'Details & Metadata',
      render: (row) => {
        const meta = row.metadata;
        if (!meta || Object.keys(meta).length === 0) {
          return <span className="text-xs text-gray-600">-</span>;
        }
        return (
          <span
            className="text-xs text-gray-400 truncate max-w-xs block font-mono"
            title={JSON.stringify(meta, null, 2)}
          >
            {JSON.stringify(meta)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Immutable System Audit Logs
            </h1>
            <span className="p-1 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/30">
              <Shield className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Tamper-proof ledger recording authentication attempts, attendance scans, approvals, and admin corrections
          </p>
        </div>
      </div>

      {/* Read-Only Disclaimer Note */}
      <div className="p-4 rounded-2xl bg-navy-900/60 border border-white/10 flex items-center space-x-3 text-xs text-gray-300">
        <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
        <span>
          <strong className="text-white">Security Policy:</strong> Audit logs cannot be modified, edited, or deleted under any circumstance. All system state mutations generate an append-only entry.
        </span>
      </div>

      {/* Filter Row */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Select
          label="Action Type"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="All Recorded Actions"
          options={[
            { value: '', label: 'All Actions' },
            { value: 'LOGIN', label: 'LOGIN' },
            { value: 'LOGOUT', label: 'LOGOUT' },
            { value: 'FAILED_LOGIN', label: 'FAILED_LOGIN' },
            { value: 'ATTENDANCE_CHECK_IN', label: 'ATTENDANCE_CHECK_IN' },
            { value: 'ATTENDANCE_CHECK_OUT', label: 'ATTENDANCE_CHECK_OUT' },
            { value: 'ATTENDANCE_CORRECTED', label: 'ATTENDANCE_CORRECTED' },
            { value: 'WFH_REQUESTED', label: 'WFH_REQUESTED' },
            { value: 'WFH_APPROVED', label: 'WFH_APPROVED' },
            { value: 'WFH_REJECTED', label: 'WFH_REJECTED' },
            { value: 'USER_CREATED', label: 'USER_CREATED' },
            { value: 'USER_UPDATED', label: 'USER_UPDATED' },
            { value: 'USER_ACTIVATED', label: 'USER_ACTIVATED' },
            { value: 'USER_DEACTIVATED', label: 'USER_DEACTIVATED' },
            { value: 'POLICY_UPDATED', label: 'POLICY_UPDATED' },
            { value: 'QR_TOKEN_ISSUED', label: 'QR_TOKEN_ISSUED' },
          ]}
        />
        <Input
          label="From Date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          label="To Date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      {/* Error state */}
      {error && <ErrorState message={error} onRetry={() => fetchLogs(1)} />}

      {/* Table */}
      {!error && (
        <div className="space-y-2">
          <Table
            columns={columns}
            data={logs}
            isLoading={isLoading}
            emptyMessage="No audit log events match the query"
          />

          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(p) => fetchLogs(p)}
          />
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
