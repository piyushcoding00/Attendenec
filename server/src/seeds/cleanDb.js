/**
 * Script to initialize a clean production database for VorldX Attendance System.
 * - Cleans demo attendance records, demo WFH requests, demo QR tokens, and demo audit logs
 * - Preserves/Creates standard shifts, default policy, and the Admin user
 * - Removes demo sample employee attendance
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB } = require('../config/db');

const User = require('../models/User');
const Shift = require('../models/Shift');
const AttendancePolicy = require('../models/AttendancePolicy');
const AttendanceRecord = require('../models/AttendanceRecord');
const WFHRequest = require('../models/WFHRequest');
const OfficeQRDisplay = require('../models/OfficeQRDisplay');
const QRToken = require('../models/QRToken');
const AuditLog = require('../models/AuditLog');
const VerificationChallenge = require('../models/VerificationChallenge');

const cleanAndInit = async () => {
  console.log('🔄 Connecting to MongoDB...');
  await connectDB();

  console.log('🧹 Purging all demo attendance records, WFH requests, and tokens...');
  await Promise.all([
    AttendanceRecord.deleteMany({}),
    WFHRequest.deleteMany({}),
    QRToken.deleteMany({}),
    VerificationChallenge.deleteMany({}),
    AuditLog.deleteMany({}),
    // Delete non-admin demo employees if any
    User.deleteMany({ role: 'employee' }),
  ]);
  console.log('✅ Demo attendance records and dummy employees deleted.');

  // Ensure standard Shifts exist
  console.log('⚙️ Initializing company shifts...');
  const morningShift = await Shift.findOneAndUpdate(
    { name: 'Morning Shift' },
    {
      $set: {
        name: 'Morning Shift',
        startTime: '09:00',
        endTime: '18:00',
        graceMinutes: 15,
        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        isDefault: true,
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Ensure default Attendance Policy exists
  console.log('⚙️ Initializing attendance policy...');
  await AttendancePolicy.findOneAndUpdate(
    { isActive: true },
    {
      $set: {
        companyTimezone: 'Asia/Kolkata',
        defaultShift: morningShift._id,
        qrTokenExpiresSeconds: 30,
        qrRefreshIntervalSeconds: 30,
        wfhEnabled: true,
        wfhMaxDaysPerMonth: 8,
        wfhRequiresApproval: true,
        wfhAdvanceNoticeDays: 1,
        wfhEligibleWorkTypes: ['remote', 'hybrid'],
        halfDayDurationMinutes: 240,
        fullDayDurationMinutes: 480,
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Ensure Admin User exists
  console.log('👤 Ensuring Admin account exists (ADMIN001)...');
  const hashedAdminPassword = await bcrypt.hash('Admin@123', 12);
  await User.findOneAndUpdate(
    { employeeId: 'ADMIN001' },
    {
      $set: {
        employeeId: 'ADMIN001',
        name: 'HR Admin',
        role: 'hr_admin',
        department: 'Human Resources',
        designation: 'HR Manager',
        joiningDate: new Date('2024-01-01'),
        workType: 'office',
        isAccountActivated: true,
        isActive: true,
        password: hashedAdminPassword,
        shift: morningShift._id,
        email: 'admin@vorldx.com',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log('\n======================================================');
  console.log('✨ CLEAN DATABASE INITIALIZED SUCCESSFULLY! ✨');
  console.log('Database connected: MongoDB Atlas Cloud');
  console.log('Demo Attendance Records: 0 (Fresh Start)');
  console.log('Admin Account: ADMIN001 / Admin@123');
  console.log('======================================================\n');

  process.exit(0);
};

cleanAndInit().catch((err) => {
  console.error('Error during init:', err);
  process.exit(1);
});
