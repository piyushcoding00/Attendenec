import React from 'react';
import { getStatusLabel } from '../../utils/formatters';

const STATUS_CONFIGS = {
  // Attendance statuses
  present: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  late: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  wfh: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  incomplete: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  not_checked_in: 'bg-gray-500/15 text-gray-400 border-gray-500/30',

  // WFH & Approval statuses
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',

  // Account / Entity active statuses
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  inactive: 'bg-red-500/15 text-red-400 border-red-500/30',

  // Roles
  hr_admin: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  super_admin: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  employee: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const SIZES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs font-medium',
  lg: 'px-3 py-1.5 text-sm font-semibold',
};

export const Badge = ({
  status = '',
  label,
  size = 'md',
  className = '',
  dot = false,
}) => {
  const normalizedStatus = String(status).toLowerCase().trim();
  const colorClass =
    STATUS_CONFIGS[normalizedStatus] ||
    'bg-slate-500/15 text-slate-400 border-slate-500/30';
  const sizeClass = SIZES[size] || SIZES.md;
  const displayLabel = label || getStatusLabel(status);

  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border tracking-wide uppercase font-medium ${colorClass} ${sizeClass} ${className}`}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80"
          aria-hidden="true"
        />
      )}
      {displayLabel}
    </span>
  );
};

export default Badge;
