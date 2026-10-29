const formatBaseUrl = (url) => {
  if (!url) return 'http://localhost:5000/api/v1';
  let clean = url.trim().replace(/\/+$/, '');
  if (!clean.endsWith('/api/v1')) {
    if (clean.endsWith('/api')) {
      clean += '/v1';
    } else {
      clean += '/api/v1';
    }
  }
  return clean;
};

export const API_URL = formatBaseUrl(import.meta.env.VITE_API_URL);
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'VorldX Attendance System';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  HR_ADMIN: 'hr_admin',
  EMPLOYEE: 'employee',
};

export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  LATE: 'late',
  WFH: 'wfh',
  INCOMPLETE: 'incomplete',
  NOT_CHECKED_IN: 'not_checked_in',
};

export const WFH_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const ATTENDANCE_STATUS_COLORS = {
  present: 'text-green-400 bg-green-400/10',
  late: 'text-yellow-400 bg-yellow-400/10',
  wfh: 'text-blue-400 bg-blue-400/10',
  incomplete: 'text-orange-400 bg-orange-400/10',
  not_checked_in: 'text-gray-400 bg-gray-400/10',
};

export const WFH_STATUS_COLORS = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  approved: 'text-green-400 bg-green-400/10',
  rejected: 'text-red-400 bg-red-400/10',
};

export const TOKEN_KEY = 'vorldx_token';
export const USER_KEY = 'vorldx_user';
