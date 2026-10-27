/**
 * VorldX Attendance System — Backend API Test Suite
 * Tests: Auth, Attendance, WFH, RBAC, Validation
 * Runner: Jest + Supertest
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const VerificationChallenge = require('../models/VerificationChallenge');
const AttendanceRecord = require('../models/AttendanceRecord');
const WFHRequest = require('../models/WFHRequest');
const OfficeQRDisplay = require('../models/OfficeQRDisplay');
const QRToken = require('../models/QRToken');
const AttendancePolicy = require('../models/AttendancePolicy');
const AttendanceCaptureRequest = require('../models/AttendanceCaptureRequest');

// ─── Test Setup ─────────────────────────────────────────────────────────────

const TEST_DB = process.env.MONGODB_URI || 'mongodb://localhost:27017/vorldx-test';

let adminToken;
let employeeToken;
let adminUser;
let employeeUser;
let inactiveEmployee;
let wfhEmployee;

beforeAll(async () => {
  // Connect to test DB
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_DB);
  }

  // Clean test collections
  await User.deleteMany({ isDemoAccount: true, employeeId: /^TEST/ });
  await VerificationChallenge.deleteMany({});
  await AttendanceRecord.deleteMany({ employee: { $in: [] } });

  // Create test HR Admin
  adminUser = await User.create({
    employeeId: 'TEST_ADMIN',
    name: 'Test Admin',
    role: 'hr_admin',
    department: 'HR',
    designation: 'HR Manager',
    joiningDate: new Date('2024-01-01'),
    workType: 'office',
    isActive: true,
    isAccountActivated: true,
    isDemoAccount: true,
    password: 'Admin@123',
  });

  // Create test employee (activated)
  employeeUser = await User.create({
    employeeId: 'TEST_EMP01',
    name: 'Test Employee One',
    role: 'employee',
    department: 'Engineering',
    designation: 'Engineer',
    joiningDate: new Date('2024-01-01'),
    workType: 'hybrid',
    isActive: true,
    isAccountActivated: true,
    wfhEligible: true,
    isDemoAccount: true,
    password: 'Employee@123',
  });

  // Create inactive employee
  inactiveEmployee = await User.create({
    employeeId: 'TEST_EMP02',
    name: 'Test Inactive',
    role: 'employee',
    department: 'Finance',
    designation: 'Analyst',
    joiningDate: new Date('2024-01-01'),
    workType: 'office',
    isActive: false,
    isAccountActivated: true,
    isDemoAccount: true,
    password: 'Employee@123',
  });

  // Create non-activated employee (for OTP flow)
  await User.create({
    employeeId: 'TEST_EMP03',
    name: 'Test Unactivated',
    role: 'employee',
    department: 'Marketing',
    designation: 'Executive',
    joiningDate: new Date('2024-01-01'),
    workType: 'office',
    isActive: true,
    isAccountActivated: false,
    isDemoAccount: true,
  });

  // Create WFH-ineligible employee
  wfhEmployee = await User.create({
    employeeId: 'TEST_EMP04',
    name: 'WFH Ineligible',
    role: 'employee',
    department: 'Operations',
    designation: 'Ops',
    joiningDate: new Date('2024-01-01'),
    workType: 'office',
    isActive: true,
    isAccountActivated: true,
    wfhEligible: false,
    isDemoAccount: true,
    password: 'Employee@123',
  });

  // Login admin
  const adminLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ employeeId: 'TEST_ADMIN', password: 'Admin@123' });
  adminToken = adminLogin.body.token;

  // Login employee
  const empLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ employeeId: 'TEST_EMP01', password: 'Employee@123' });
  employeeToken = empLogin.body.token;
});

afterAll(async () => {
  // Cleanup test data
  await User.deleteMany({ isDemoAccount: true, employeeId: /^TEST/ });
  await VerificationChallenge.deleteMany({ employeeId: /^TEST/ });
  await AttendanceRecord.deleteMany({ employee: employeeUser?._id });
  await WFHRequest.deleteMany({ employee: employeeUser?._id });
  await mongoose.disconnect();
});

// ─── HEALTH CHECK ───────────────────────────────────────────────────────────

describe('Health Check', () => {
  test('GET /api/v1/health returns 200', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('running');
  });
});

// ─── AUTHENTICATION TESTS ───────────────────────────────────────────────────

describe('Authentication', () => {

  test('POST /auth/login — valid admin credentials returns token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ employeeId: 'TEST_ADMIN', password: 'Admin@123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.data.user.role).toBe('hr_admin');
    expect(res.body.data.user.password).toBeUndefined(); // Never expose password
  });

  test('POST /auth/login — valid employee credentials returns token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ employeeId: 'TEST_EMP01', password: 'Employee@123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.data.user.role).toBe('employee');
  });

  test('POST /auth/login — wrong password is rejected with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ employeeId: 'TEST_ADMIN', password: 'WrongPassword1' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /auth/login — inactive employee cannot log in', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ employeeId: 'TEST_EMP02', password: 'Employee@123' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /auth/login — non-existent employee is rejected', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ employeeId: 'DOES_NOT_EXIST', password: 'Password@123' });
    expect(res.status).toBe(401);
  });

  test('GET /auth/me — returns authenticated user data', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.employeeId).toBe('TEST_ADMIN');
  });

  test('GET /auth/me — rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  test('GET /auth/me — rejects invalid token with 401', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalidtoken123');
    expect(res.status).toBe(401);
  });

  test('POST /auth/start-verification — initiates OTP for unactivated employee', async () => {
    const res = await request(app)
      .post('/api/v1/auth/start-verification')
      .send({ employeeId: 'TEST_EMP03' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // In demo mode, demoOTP should be present
    expect(res.body.data).toBeDefined();
  });

  test('POST /auth/start-verification — rejects already-activated employee', async () => {
    const res = await request(app)
      .post('/api/v1/auth/start-verification')
      .send({ employeeId: 'TEST_EMP01' });
    expect(res.status).toBe(400);
  });

  test('POST /auth/start-verification — rejects non-existent employee ID', async () => {
    const res = await request(app)
      .post('/api/v1/auth/start-verification')
      .send({ employeeId: 'GHOST999' });
    expect(res.status).toBe(404);
  });

  test('POST /auth/verify-demo-otp — invalid OTP is rejected', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-demo-otp')
      .send({ employeeId: 'TEST_EMP03', otp: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /auth/login — validation rejects missing password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ employeeId: 'TEST_ADMIN' });
    expect(res.status).toBe(422);
  });

});

// ─── ROLE-BASED ACCESS CONTROL ──────────────────────────────────────────────

describe('Role-Based Access Control', () => {

  test('GET /employees — admin can access employee list', async () => {
    const res = await request(app)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.employees)).toBe(true);
  });

  test('GET /employees — employee cannot access admin list (403)', async () => {
    const res = await request(app)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  test('GET /dashboard/summary — admin can access dashboard', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.overview).toBeDefined();
  });

  test('GET /dashboard/summary — employee cannot access admin dashboard (403)', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  test('GET /audit-logs — employee cannot access audit logs (403)', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  test('GET /audit-logs — unauthenticated request rejected (401)', async () => {
    const res = await request(app).get('/api/v1/audit-logs');
    expect(res.status).toBe(401);
  });

  test('POST /employees — employee cannot create employee accounts (403)', async () => {
    const res = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        employeeId: 'HACK001',
        name: 'Hacker',
        department: 'IT',
        designation: 'Hacker',
        joiningDate: '2024-01-01',
        workType: 'office',
      });
    expect(res.status).toBe(403);
  });

});

// ─── EMPLOYEE MANAGEMENT ────────────────────────────────────────────────────

describe('Employee Management', () => {

  test('POST /employees — admin creates employee successfully', async () => {
    const res = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeId: 'TEST_NEW01',
        name: 'New Test Employee',
        department: 'QA',
        designation: 'QA Engineer',
        joiningDate: '2024-06-01',
        workType: 'hybrid',
        wfhEligible: true,
      });
    expect(res.status).toBe(201);
    const generatedEmployeeId = res.body.data.employeeId;
    expect(generatedEmployeeId).toMatch(/^VORLDX\d{4}$/);
    expect(generatedEmployeeId).not.toBe('TEST_NEW01');
    // Cleanup
    await User.deleteOne({ employeeId: generatedEmployeeId });
  });

  test('POST /employees — ignores a client-supplied employeeId', async () => {
    const res = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeId: 'TEST_EMP01',
        name: 'Duplicate',
        department: 'IT',
        designation: 'Engineer',
        joiningDate: '2024-01-01',
        workType: 'office',
      });
    expect(res.status).toBe(201);
    const generatedEmployeeId = res.body.data.employeeId;
    expect(generatedEmployeeId).toMatch(/^VORLDX\d{4}$/);
    expect(generatedEmployeeId).not.toBe('TEST_EMP01');
    await User.deleteOne({ employeeId: generatedEmployeeId });
  });

  test('PATCH /employees/:id/status — admin can deactivate employee', async () => {
    const res = await request(app)
      .patch(`/api/v1/employees/${employeeUser._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    // Restore active status
    await request(app)
      .patch(`/api/v1/employees/${employeeUser._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });
  });

});

// ─── ATTENDANCE TESTS ────────────────────────────────────────────────────────

describe('Attendance', () => {

  let qrDisplayId;
  let rawToken;
  let attendancePolicy;
  let originalOfficeLocation;
  let originalGpsAccuracyThreshold;
  const scanPhoto = 'data:image/jpeg;base64,dGVzdA==';
  const scanLocation = () => ({
    latitude: 0,
    longitude: 0,
    accuracy: 5,
    timestamp: new Date().toISOString()
  });

  const createTabletCapture = async (token) => {
    const requestResponse = await request(app)
      .post('/api/v1/attendance/capture-requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ token, location: scanLocation() });
    expect(requestResponse.status).toBe(200);
    const requestId = requestResponse.body.data.requestId;

    const kioskResponse = await request(app)
      .get(`/api/v1/qr-displays/${qrDisplayId}/capture-requests/next`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(kioskResponse.status).toBe(200);
    expect(kioskResponse.body.data.id).toBe(requestId);
    return requestId;
  };

  beforeAll(async () => {
    attendancePolicy = await AttendancePolicy.getCurrent();
    if (attendancePolicy) {
      originalOfficeLocation = attendancePolicy.officeLocation?.toObject
        ? attendancePolicy.officeLocation.toObject()
        : attendancePolicy.officeLocation;
      originalGpsAccuracyThreshold = attendancePolicy.gpsAccuracyThresholdMeters;
      attendancePolicy.officeLocation = {
        latitude: 0,
        longitude: 0,
        radiusMeters: 50,
        isEnabled: true
      };
      attendancePolicy.gpsAccuracyThresholdMeters = 20;
      await attendancePolicy.save();
    } else {
      attendancePolicy = await AttendancePolicy.create({
        officeLocation: { latitude: 0, longitude: 0, radiusMeters: 50, isEnabled: true },
        gpsAccuracyThresholdMeters: 20,
        isActive: true
      });
    }

    await AttendanceRecord.deleteMany({ employee: employeeUser._id });
    // Create a test QR display
    const display = await OfficeQRDisplay.create({
      displayName: 'Test Display',
      location: 'Test Room',
      isActive: true,
      isPaired: true,
      pairedBy: adminUser._id,
    });
    qrDisplayId = display._id.toString();
  });

  afterAll(async () => {
    await OfficeQRDisplay.deleteMany({ displayName: 'Test Display' });
    await QRToken.deleteMany({ display: qrDisplayId });
    await AttendanceCaptureRequest.deleteMany({ display: qrDisplayId });
    await AttendanceRecord.deleteMany({ employee: employeeUser._id });
    if (attendancePolicy && originalOfficeLocation) {
      attendancePolicy.officeLocation = originalOfficeLocation;
      attendancePolicy.gpsAccuracyThresholdMeters = originalGpsAccuracyThreshold;
      await attendancePolicy.save();
    } else if (attendancePolicy) {
      await AttendancePolicy.deleteOne({ _id: attendancePolicy._id });
    }
  });

  test('POST /qr-displays/:id/token — rejects anonymous token issuance', async () => {
    const res = await request(app)
      .post(`/api/v1/qr-displays/${qrDisplayId}/token`);
    expect(res.status).toBe(401);
  });

  test('POST /qr-displays/:id/token — issues a valid token to an authenticated supervisor', async () => {
    const res = await request(app)
      .post(`/api/v1/qr-displays/${qrDisplayId}/token`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.expiresAt).toBeDefined();
    rawToken = res.body.data.token;
  });

  test('employee QR scan requests a tablet capture and the tablet records check-in', async () => {
    const tokenRes = await request(app)
      .post(`/api/v1/qr-displays/${qrDisplayId}/token`)
      .set('Authorization', `Bearer ${adminToken}`);
    rawToken = tokenRes.body.data.token;
    const requestId = await createTabletCapture(rawToken);

    const res = await request(app)
      .post(`/api/v1/qr-displays/${qrDisplayId}/capture-requests/${requestId}/capture`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ photo: scanPhoto });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.action).toBe('check_in');
    expect(res.body.data.recordId).toBeDefined();
  });

  test('kiosk allows only one pending request and rejects reuse', async () => {
    const tokenRes = await request(app)
      .post(`/api/v1/qr-displays/${qrDisplayId}/token`)
      .set('Authorization', `Bearer ${adminToken}`);
    const requestId = await createTabletCapture(tokenRes.body.data.token);
    const duplicate = await request(app)
      .post('/api/v1/attendance/capture-requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ token: tokenRes.body.data.token, location: scanLocation() });
    expect(duplicate.status).toBe(409);

    await request(app)
      .post(`/api/v1/qr-displays/${qrDisplayId}/capture-requests/${requestId}/failure`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'test request cleanup' })
      .expect(200);
    const replay = await request(app)
      .post(`/api/v1/qr-displays/${qrDisplayId}/capture-requests/${requestId}/capture`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ photo: scanPhoto });
    expect(replay.status).toBe(409);
  });

  test('POST /attendance/capture-requests — expired QR is rejected', async () => {
    // Create a token that's already expired
    const tokenRecord = await QRToken.create({
      tokenHash: require('crypto').createHash('sha256').update('expiredtoken123').digest('hex'),
      display: qrDisplayId,
      expiresAt: new Date(Date.now() - 60000), // 1 minute ago
      isUsed: false,
    });
    const res = await request(app)
      .post('/api/v1/attendance/capture-requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ token: 'expiredtoken123', location: scanLocation() });
    expect(res.status).toBe(400);
    await tokenRecord.deleteOne();
  });

  test('GET /attendance/today — employee can view today\'s attendance', async () => {
    const res = await request(app)
      .get('/api/v1/attendance/today')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('tablet capture records check-out with a new QR token', async () => {
    const tokenRes = await request(app)
      .post(`/api/v1/qr-displays/${qrDisplayId}/token`)
      .set('Authorization', `Bearer ${adminToken}`);
    const checkOutToken = tokenRes.body.data.token;
    const requestId = await createTabletCapture(checkOutToken);

    const res = await request(app)
      .post(`/api/v1/qr-displays/${qrDisplayId}/capture-requests/${requestId}/capture`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ photo: scanPhoto });
    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('check_out');
  });

  test('attendance capture after check-out is rejected', async () => {
    const tokenRes = await request(app)
      .post(`/api/v1/qr-displays/${qrDisplayId}/token`)
      .set('Authorization', `Bearer ${adminToken}`);
    const thirdToken = tokenRes.body.data.token;

    const res = await request(app)
      .post('/api/v1/attendance/capture-requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ token: thirdToken, location: scanLocation() });
    expect(res.status).toBe(409);
  });

  test('legacy direct QR and mobile-photo routes cannot mark attendance', async () => {
    const res = await request(app)
      .post('/api/v1/attendance/photo-attendance')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ token: 'present-but-not-used', photo: scanPhoto, location: scanLocation() });
    expect(res.status).toBe(403);

    const scanResponse = await request(app)
      .post('/api/v1/attendance/scan-qr')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ token: 'present-but-not-used', photo: scanPhoto, location: scanLocation() });
    expect(scanResponse.status).toBe(403);
  });

  test('GET /attendance/me — employee can view own attendance history', async () => {
    const res = await request(app)
      .get('/api/v1/attendance/me')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.records)).toBe(true);
  });

  test('GET /attendance — admin can view all attendance records', async () => {
    const res = await request(app)
      .get('/api/v1/attendance')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.records)).toBe(true);
  });

  test('PATCH /attendance/:id/correction — correction requires a reason', async () => {
    const record = await AttendanceRecord.findOne({ employee: employeeUser._id });
    if (!record) return; // Skip if no record
    const res = await request(app)
      .patch(`/api/v1/attendance/${record._id}/correction`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'present' }); // Missing reason
    expect(res.status).toBe(422);
  });

  test('PATCH /attendance/:id/correction — admin can correct with valid reason', async () => {
    const record = await AttendanceRecord.findOne({ employee: employeeUser._id });
    if (!record) return;
    const res = await request(app)
      .patch(`/api/v1/attendance/${record._id}/correction`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'present', reason: 'Correcting status after system error during check-in' });
    expect(res.status).toBe(200);
    expect(res.body.data.record.correction.reason).toBeDefined();
  });

  test('PATCH /attendance/:id/correction — employee cannot correct attendance (403)', async () => {
    const record = await AttendanceRecord.findOne({ employee: employeeUser._id });
    if (!record) return;
    const res = await request(app)
      .patch(`/api/v1/attendance/${record._id}/correction`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reason: 'Trying to hack my own record' });
    expect(res.status).toBe(403);
  });

});

// ─── WFH TESTS ──────────────────────────────────────────────────────────────

describe('WFH Requests', () => {

  let wfhRequestId;

  afterAll(async () => {
    await WFHRequest.deleteMany({ employee: employeeUser._id });
  });

  test('GET /wfh/eligibility — eligible employee gets eligible=true', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Skip to Monday if weekend
    while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
      tomorrow.setDate(tomorrow.getDate() + 1);
    }
    const dateStr = tomorrow.toISOString().split('T')[0];
    const res = await request(app)
      .get(`/api/v1/wfh/eligibility?date=${dateStr}`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  test('POST /wfh/requests — eligible employee can submit WFH request', async () => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 2);
    while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    const res = await request(app)
      .post('/api/v1/wfh/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        requestedDate: targetDate.toISOString().split('T')[0],
        reason: 'Home internet is stable and can work from home for this day.',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.request.status).toBe('pending');
    wfhRequestId = res.body.data.request._id;
  });

  test('POST /wfh/requests — duplicate WFH request for same date is rejected', async () => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 2);
    while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    const res = await request(app)
      .post('/api/v1/wfh/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        requestedDate: targetDate.toISOString().split('T')[0],
        reason: 'Same date duplicate request attempt.',
      });
    expect(res.status).toBe(400);
  });

  test('GET /wfh/requests/me — employee can see own WFH requests', async () => {
    const res = await request(app)
      .get('/api/v1/wfh/requests/me')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.requests)).toBe(true);
    expect(res.body.data.requests.length).toBeGreaterThan(0);
  });

  test('GET /wfh/requests — admin can view all pending WFH requests', async () => {
    const res = await request(app)
      .get('/api/v1/wfh/requests?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.requests)).toBe(true);
  });

  test('PATCH /wfh/requests/:id/decision — admin can approve WFH request', async () => {
    if (!wfhRequestId) return;
    const res = await request(app)
      .patch(`/api/v1/wfh/requests/${wfhRequestId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved', reviewComment: 'Approved for WFH.' });
    expect(res.status).toBe(200);
    expect(res.body.data.request.status).toBe('approved');
    expect(res.body.data.request.reviewer).toBeDefined();
  });

  test('PATCH /wfh/requests/:id/decision — employee cannot approve own WFH request (403)', async () => {
    // Create another request to try to approve
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 5);
    while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    const submitRes = await request(app)
      .post('/api/v1/wfh/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        requestedDate: targetDate.toISOString().split('T')[0],
        reason: 'Working from home for a focus day on an important deadline.',
      });
    const newRequestId = submitRes.body.data?.request?._id;
    if (!newRequestId) return;

    const res = await request(app)
      .patch(`/api/v1/wfh/requests/${newRequestId}/decision`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(403);
  });

  test('POST /wfh/requests — ineligible employee (office workType) is blocked', async () => {
    // Login as wfhEmployee (office workType, wfhEligible: false)
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ employeeId: 'TEST_EMP04', password: 'Employee@123' });
    const ineligibleToken = loginRes.body.token;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 2);
    while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    const res = await request(app)
      .post('/api/v1/wfh/requests')
      .set('Authorization', `Bearer ${ineligibleToken}`)
      .send({
        requestedDate: targetDate.toISOString().split('T')[0],
        reason: 'Trying to submit WFH when not eligible for it.',
      });
    expect(res.status).toBe(400);
  });

});

// ─── POLICY TESTS ────────────────────────────────────────────────────────────

describe('Policy Management', () => {

  test('GET /policies — authenticated user can view policies', async () => {
    const res = await request(app)
      .get('/api/v1/policies')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.policy).toBeDefined();
  });

  test('GET /policies — employee can also view policies (read access)', async () => {
    const res = await request(app)
      .get('/api/v1/policies')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
  });

});

// ─── REPORTS TESTS ───────────────────────────────────────────────────────────

describe('Reports', () => {

  test('GET /reports/attendance — admin can access reports', async () => {
    const res = await request(app)
      .get('/api/v1/reports/attendance')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.records).toBeDefined();
    expect(res.body.data.totals).toBeDefined();
  });

  test('GET /reports/attendance/export — admin can export CSV', async () => {
    const res = await request(app)
      .get('/api/v1/reports/attendance/export')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  test('GET /reports/attendance/export — employee cannot export (403)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/attendance/export')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

});
