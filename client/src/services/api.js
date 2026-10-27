import axios from 'axios';
import { API_URL, TOKEN_KEY, USER_KEY } from '../utils/constants';

// Create base Axios instance
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Extract data and handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response && error.response.status === 401) {
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/verify') && !currentPath.includes('/office/qr-display')) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }
    return Promise.reject(error.response?.data || error.message || error);
  }
);

// Auth Service
export const authService = {
  startVerification(dataOrEmployeeId, email) {
    if (typeof dataOrEmployeeId === 'object') {
      return api.post('/auth/verify/start', dataOrEmployeeId);
    }
    return api.post('/auth/verify/start', { employeeId: dataOrEmployeeId, email });
  },
  verifyOTP(employeeId, otp) {
    return api.post('/auth/verify/otp', { employeeId, otp });
  },
  activateAccount(employeeId, otp, password, profilePhoto) {
    return api.post('/auth/activate', { employeeId, otp, password, profilePhoto });
  },
  login(employeeId, password) {
    return api.post('/auth/login', { employeeId, password });
  },
  sendLoginOtp(email, employeeId) {
    return api.post('/auth/login-otp/send', { email, employeeId });
  },
  verifyLoginOtp(email, employeeId, otp) {
    return api.post('/auth/login-otp/verify', { email, employeeId, otp });
  },
  logout() {
    return api.post('/auth/logout');
  },
  getMe() {
    return api.get('/auth/me');
  },
};

// Employee Service
export const employeeService = {
  getAll(params = {}) {
    return api.get('/employees', { params });
  },
  getDepartments() {
    return api.get('/employees/departments');
  },
  getById(id) {
    return api.get(`/employees/${id}`);
  },
  create(data) {
    return api.post('/employees', data);
  },
  update(id, data) {
    return api.put(`/employees/${id}`, data);
  },
  updateStatus(id, active) {
    return api.patch(`/employees/${id}/status`, { isActive: Boolean(active), active: Boolean(active) });
  },
};

export const adminInviteService = {
  getAll() {
    return api.get('/admin-invites');
  },
  invite(data) {
    return api.post('/admin-invites', data);
  },
};

// Attendance Service
export const attendanceService = {
  getToday() {
    return api.get('/attendance/today');
  },
  getMyHistory(params = {}) {
    return api.get('/attendance/my-history', { params });
  },
  getAll(params = {}) {
    return api.get('/attendance', { params });
  },
  requestTabletCapture(token, location) {
    return api.post('/attendance/capture-requests', { token, location });
  },
  getCaptureStatus(requestId) {
    return api.get(`/attendance/capture-requests/${requestId}`);
  },
  cancelCapture(requestId) {
    return api.delete(`/attendance/capture-requests/${requestId}`);
  },
  verifyQR(token) {
    return api.post('/attendance/verify-qr', { token });
  },
  correct(id, data) {
    return api.patch(`/attendance/${id}/correct`, data);
  },
};

// QR Display Service
export const qrDisplayService = {
  pair(data) {
    return api.post('/qr-displays/pair', data);
  },
  getAll() {
    return api.get('/qr-displays');
  },
  updateStatus(id, active) {
    return api.patch(`/qr-displays/${id}/status`, { isActive: Boolean(active), active: Boolean(active) });
  },
  getKioskState(id) {
    return api.get(`/qr-displays/${id}/kiosk-state`);
  },
  updateKioskLock(id, isLocked, password) {
    return api.patch(`/qr-displays/${id}/kiosk-lock`, { isLocked, password });
  },
  getToken(displayId) {
    return api.post(`/qr-displays/${displayId}/token`);
  },
  getNextCapture(displayId) {
    return api.get(`/qr-displays/${displayId}/capture-requests/next`);
  },
  submitCapture(displayId, requestId, photo) {
    return api.post(`/qr-displays/${displayId}/capture-requests/${requestId}/capture`, { photo });
  },
  failCapture(displayId, requestId, reason) {
    return api.post(`/qr-displays/${displayId}/capture-requests/${requestId}/failure`, { reason });
  },
};

// WFH Service
export const wfhService = {
  getEligibility(params = {}) {
    return api.get('/wfh/eligibility', { params });
  },
  submitRequest(data) {
    return api.post('/wfh/request', data);
  },
  getMyRequests() {
    return api.get('/wfh/my-requests');
  },
  getAllRequests(params = {}) {
    return api.get('/wfh/requests', { params });
  },
  makeDecision(id, data) {
    return api.patch(`/wfh/requests/${id}/decision`, data);
  },
};

// Policy Service
export const policyService = {
  getAll() {
    return api.get('/policies');
  },
  update(id, data) {
    return api.put(`/policies/${id}`, data);
  },
};

// Dashboard Service
export const dashboardService = {
  getSummary(params = {}) {
    return api.get('/dashboard/summary', { params });
  },
};

// Reports Service
export const reportsService = {
  getAttendance(params = {}) {
    return api.get('/reports/attendance', { params });
  },
  getMatrix(params = {}) {
    return api.get('/reports/matrix', { params });
  },
  exportCSV(params = {}) {
    return api.get('/reports/attendance/export', {
      params,
      responseType: 'blob',
    });
  },
};

// Audit Log Service
export const auditLogService = {
  getAll(params = {}) {
    return api.get('/audit-logs', { params });
  },
};

export default api;
