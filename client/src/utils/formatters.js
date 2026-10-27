import { format, parseISO, isValid } from 'date-fns';

/**
 * Safely converts input to a valid Date object.
 * @param {Date|string|number} date
 * @returns {Date|null}
 */
const toDateObj = (date) => {
  if (!date) return null;
  if (date instanceof Date) return isValid(date) ? date : null;
  if (typeof date === 'string') {
    const parsed = parseISO(date);
    if (isValid(parsed)) return parsed;
    const direct = new Date(date);
    return isValid(direct) ? direct : null;
  }
  if (typeof date === 'number') {
    const direct = new Date(date);
    return isValid(direct) ? direct : null;
  }
  return null;
};

/**
 * Format a date with a custom format pattern.
 * @param {Date|string|number} date
 * @param {string} fmt
 * @returns {string}
 */
export const formatDate = (date, fmt = 'yyyy-MM-dd') => {
  const d = toDateObj(date);
  if (!d) return '-';
  try {
    return format(d, fmt);
  } catch (err) {
    return '-';
  }
};

/**
 * Format date as time (HH:mm by default, e.g. 09:30).
 * @param {Date|string|number} date
 * @param {string} fmt
 * @returns {string}
 */
export const formatTime = (date, fmt = 'HH:mm') => {
  const d = toDateObj(date);
  if (!d) return '--:--';
  try {
    return format(d, fmt);
  } catch (err) {
    return '--:--';
  }
};

/**
 * Format date and time e.g., 'Jan 14, 2026 09:30 AM'.
 * @param {Date|string|number} date
 * @param {string} fmt
 * @returns {string}
 */
export const formatDateTime = (date, fmt = 'MMM dd, yyyy hh:mm a') => {
  const d = toDateObj(date);
  if (!d) return '-';
  try {
    return format(d, fmt);
  } catch (err) {
    return '-';
  }
};

/**
 * Format minutes duration into human readable string (e.g., '2h 30m').
 * @param {number} minutes
 * @returns {string}
 */
export const formatDuration = (minutes) => {
  if (minutes === null || minutes === undefined || isNaN(minutes) || minutes < 0) {
    return '0m';
  }
  const totalMins = Math.round(Number(minutes));
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
};

/**
 * Capitalize first letter of a string.
 * @param {string} str
 * @returns {string}
 */
export const capitalize = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Formats an employee ID (e.g. VX-1001).
 * @param {string} id
 * @returns {string}
 */
export const formatEmployeeId = (id) => {
  if (!id) return '';
  return String(id).trim().toUpperCase();
};

/**
 * Get human readable status label for attendance/WFH status.
 * @param {string} status
 * @returns {string}
 */
export const getStatusLabel = (status) => {
  if (!status) return 'Unknown';
  const mapping = {
    present: 'Present',
    late: 'Late',
    wfh: 'WFH',
    incomplete: 'Incomplete',
    not_checked_in: 'Not Checked In',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    active: 'Active',
    inactive: 'Inactive',
  };
  return mapping[status.toLowerCase()] || capitalize(status);
};
