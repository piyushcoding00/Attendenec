const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB } = require('../config/db');

// Models
const User = require('../models/User');
const Shift = require('../models/Shift');
const AttendancePolicy = require('../models/AttendancePolicy');
const AttendanceRecord = require('../models/AttendanceRecord');
const WFHRequest = require('../models/WFHRequest');
const OfficeQRDisplay = require('../models/OfficeQRDisplay');
const QRToken = require('../models/QRToken');
const AuditLog = require('../models/AuditLog');
const VerificationChallenge = require('../models/VerificationChallenge');

/**
 * Helper to compute working days (Mon-Fri) backwards from today
 * @param {number} count
 * @returns {Date[]}
 */
const getLastWorkingDays = (count = 10) => {
  const days = [];
  const current = new Date();
  current.setUTCHours(0, 0, 0, 0);

  while (days.length < count) {
    const dayOfWeek = current.getUTCDay(); // 0 = Sun, 6 = Sat
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push(new Date(current));
    }
    current.setUTCDate(current.getUTCDate() - 1);
  }

  return days;
};

/**
 * Helper to construct an exact Date timestamp given UTC base date and IST hours/minutes
 * IST = UTC + 5:30
 * @param {Date} baseDate
 * @param {number} hoursIST
 * @param {number} minutesIST
 * @returns {Date}
 */
const makeISTTimestamp = (baseDate, hoursIST, minutesIST) => {
  const ts = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));
  const totalOffsetMinutes = hoursIST * 60 + minutesIST - (5 * 60 + 30);
  ts.setUTCMinutes(ts.getUTCMinutes() + totalOffsetMinutes);
  return ts;
};

const runSeed = async () => {
  const isReset = process.argv.includes('--reset');

  console.log('\n======================================================');
  console.log('       VORLDX ATTENDANCE SYSTEM - DATABASE SEEDER      ');
  console.log('======================================================');

  await connectDB();

  if (isReset) {
    console.warn('\n⚠️  [WARNING] --reset flag detected!');
    console.warn('⚠️  Purging all existing database collections...\n');

    await Promise.all([
      User.deleteMany({}),
      Shift.deleteMany({}),
      AttendancePolicy.deleteMany({}),
      AttendanceRecord.deleteMany({}),
      WFHRequest.deleteMany({}),
      OfficeQRDisplay.deleteMany({}),
      QRToken.deleteMany({}),
      AuditLog.deleteMany({}),
      VerificationChallenge.deleteMany({})
    ]);

    console.log('✅ All collections successfully dropped and cleaned.');
  } else {
    console.log('\nℹ️  Running in safe idempotent mode (non-destructive upserts)...\n');
  }

  // 1. Seed Shifts
  console.log('📌 [1/6] Seeding Work Shifts...');
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
        isActive: true
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const flexibleShift = await Shift.findOneAndUpdate(
    { name: 'Flexible Shift' },
    {
      $set: {
        name: 'Flexible Shift',
        startTime: '10:00',
        endTime: '19:00',
        graceMinutes: 30,
        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        isDefault: false,
        isActive: true
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // 2. Pre-hash Passwords for Users
  console.log('📌 [2/6] Preparing and Seeding Demo Users...');
  const hashedAdminPassword = await bcrypt.hash('Admin@123', 12);
  const hashedEmployeePassword = await bcrypt.hash('Employee@123', 12);

  // HR Admin
  const adminUser = await User.findOneAndUpdate(
    { employeeId: 'ADMIN001' },
    {
      $set: {
        employeeId: 'ADMIN001',
        name: 'Arjun Sharma',
        role: 'hr_admin',
        department: 'Human Resources',
        designation: 'HR Manager',
        joiningDate: new Date('2024-01-15'),
        workType: 'office',
        isAccountActivated: true,
        isActive: true,
        password: hashedAdminPassword,
        wfhEligible: false,
        shift: morningShift._id,
        email: 'arjun.sharma@vorldx.demo',
        isDemoAccount: true
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Employee 1
  const emp1 = await User.findOneAndUpdate(
    { employeeId: 'EMP001' },
    {
      $set: {
        employeeId: 'EMP001',
        name: 'Priya Patel',
        role: 'employee',
        department: 'Engineering',
        designation: 'Software Engineer',
        joiningDate: new Date('2024-03-01'),
        workType: 'hybrid',
        isAccountActivated: true,
        isActive: true,
        password: hashedEmployeePassword,
        wfhEligible: true,
        shift: morningShift._id,
        email: 'priya.patel@vorldx.demo',
        isDemoAccount: true
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Employee 2
  const emp2 = await User.findOneAndUpdate(
    { employeeId: 'EMP002' },
    {
      $set: {
        employeeId: 'EMP002',
        name: 'Rahul Verma',
        role: 'employee',
        department: 'Engineering',
        designation: 'Senior Software Engineer',
        joiningDate: new Date('2023-07-15'),
        workType: 'hybrid',
        isAccountActivated: true,
        isActive: true,
        password: hashedEmployeePassword,
        wfhEligible: true,
        shift: flexibleShift._id,
        email: 'rahul.verma@vorldx.demo',
        isDemoAccount: true
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Employee 3 (Unactivated for demo verification flow)
  const emp3 = await User.findOneAndUpdate(
    { employeeId: 'EMP003' },
    {
      $set: {
        employeeId: 'EMP003',
        name: 'Sneha Krishnan',
        role: 'employee',
        department: 'Marketing',
        designation: 'Marketing Executive',
        joiningDate: new Date('2025-01-10'),
        workType: 'office',
        isAccountActivated: false,
        isActive: true,
        password: null,
        wfhEligible: false,
        shift: morningShift._id,
        email: 'sneha.krishnan@vorldx.demo',
        isDemoAccount: true
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Employee 4 (Remote)
  const emp4 = await User.findOneAndUpdate(
    { employeeId: 'EMP004' },
    {
      $set: {
        employeeId: 'EMP004',
        name: 'Vikram Singh',
        role: 'employee',
        department: 'Marketing',
        designation: 'Digital Marketing Manager',
        joiningDate: new Date('2024-06-01'),
        workType: 'remote',
        isAccountActivated: true,
        isActive: true,
        password: hashedEmployeePassword,
        wfhEligible: true,
        shift: morningShift._id,
        email: 'vikram.singh@vorldx.demo',
        isDemoAccount: true
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Employee 5 (Inactive)
  const emp5 = await User.findOneAndUpdate(
    { employeeId: 'EMP005' },
    {
      $set: {
        employeeId: 'EMP005',
        name: 'Anita Desai',
        role: 'employee',
        department: 'Finance',
        designation: 'Finance Analyst',
        joiningDate: new Date('2024-02-01'),
        workType: 'office',
        isActive: false,
        isAccountActivated: true,
        password: hashedEmployeePassword,
        wfhEligible: false,
        shift: morningShift._id,
        email: 'anita.desai@vorldx.demo',
        isDemoAccount: true
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // 3. Seed Attendance Policy
  console.log('📌 [3/6] Seeding Attendance Policy...');
  await AttendancePolicy.findOneAndUpdate(
    { isActive: true },
    {
      $set: {
        companyTimezone: 'Asia/Kolkata',
        defaultShift: morningShift._id,
        qrTokenExpiresSeconds: 30,
        qrRefreshIntervalSeconds: 30,
        gpsAccuracyThresholdMeters: 20,
        wfhEnabled: true,
        wfhMaxDaysPerMonth: 8,
        wfhRequiresApproval: true,
        wfhAdvanceNoticeDays: 1,
        wfhEligibleWorkTypes: ['remote', 'hybrid'],
        attendanceCutoffHour: 23,
        halfDayDurationMinutes: 240,
        fullDayDurationMinutes: 480,
        isActive: true,
        effectiveDate: new Date('2024-01-01'),
        createdBy: adminUser._id
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // 4. Seed Office QR Display
  console.log('📌 [4/6] Seeding Office QR Display Terminal...');
  const qrDisplay = await OfficeQRDisplay.findOneAndUpdate(
    { displayName: 'Main Office Lobby QR' },
    {
      $set: {
        displayName: 'Main Office Lobby QR',
        pairingCode: 'LOBBY-01',
        isActive: false,
        isPaired: true,
        pairedAt: new Date('2024-01-20'),
        pairedBy: adminUser._id,
        lastTokenIssuedAt: new Date(),
        location: 'Ground Floor Reception',
        notes: 'Primary entrance tablet terminal'
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const workingDays = getLastWorkingDays(10);

  // 5. Seed Realistic Attendance Records (10 working days for EMP001, EMP002, EMP004)
  console.log('📌 [5/6] Seeding Attendance Records (10 working days)...');

  // EMP001 Patterns: Office/Hybrid with mix of present, late, wfh, incomplete
  for (let i = 0; i < workingDays.length; i++) {
    const day = workingDays[i];
    let recordData = {
      employee: emp1._id,
      date: day,
      qrDisplayId: qrDisplay._id
    };

    if (i === 0) {
      // Day 0: Today - Present on time
      recordData.checkIn = makeISTTimestamp(day, 9, 5);
      recordData.checkOut = makeISTTimestamp(day, 18, 5);
      recordData.status = 'present';
      recordData.method = 'qr_scan';
      recordData.isLate = false;
      recordData.lateByMinutes = 0;
      recordData.workingMinutes = 540;
    } else if (i === 1) {
      // Day 1: Late
      recordData.checkIn = makeISTTimestamp(day, 9, 25);
      recordData.checkOut = makeISTTimestamp(day, 18, 30);
      recordData.status = 'late';
      recordData.method = 'qr_scan';
      recordData.isLate = true;
      recordData.lateByMinutes = 25;
      recordData.workingMinutes = 545;
    } else if (i === 3) {
      // Day 3: WFH
      recordData.checkIn = makeISTTimestamp(day, 9, 0);
      recordData.checkOut = makeISTTimestamp(day, 18, 0);
      recordData.status = 'wfh';
      recordData.method = 'wfh';
      recordData.isLate = false;
      recordData.lateByMinutes = 0;
      recordData.workingMinutes = 540;
    } else if (i === 5) {
      // Day 5: Late
      recordData.checkIn = makeISTTimestamp(day, 9, 20);
      recordData.checkOut = makeISTTimestamp(day, 18, 15);
      recordData.status = 'late';
      recordData.method = 'qr_scan';
      recordData.isLate = true;
      recordData.lateByMinutes = 20;
      recordData.workingMinutes = 535;
    } else if (i === 7) {
      // Day 7: Incomplete (forgot check-out)
      recordData.checkIn = makeISTTimestamp(day, 9, 0);
      recordData.checkOut = null;
      recordData.status = 'incomplete';
      recordData.method = 'qr_scan';
      recordData.isLate = false;
      recordData.lateByMinutes = 0;
      recordData.workingMinutes = 0;
    } else {
      // Other days: Normal present
      recordData.checkIn = makeISTTimestamp(day, 8, 55 + (i % 8));
      recordData.checkOut = makeISTTimestamp(day, 18, 5 + (i % 10));
      recordData.status = 'present';
      recordData.method = 'qr_scan';
      recordData.isLate = false;
      recordData.lateByMinutes = 0;
      recordData.workingMinutes = 545;
    }

    await AttendanceRecord.findOneAndUpdate(
      { employee: emp1._id, date: day },
      { $set: recordData },
      { upsert: true, new: true }
    );
  }

  // EMP002 Patterns: Flexible shift (10:00 - 19:00), approved WFH on Day 3
  for (let i = 0; i < workingDays.length; i++) {
    const day = workingDays[i];
    let recordData = {
      employee: emp2._id,
      date: day,
      qrDisplayId: qrDisplay._id
    };

    if (i === 3) {
      // Day 3: WFH
      recordData.checkIn = makeISTTimestamp(day, 10, 0);
      recordData.checkOut = makeISTTimestamp(day, 19, 0);
      recordData.status = 'wfh';
      recordData.method = 'wfh';
      recordData.isLate = false;
      recordData.lateByMinutes = 0;
      recordData.workingMinutes = 540;
    } else if (i === 2) {
      // Day 2: Late
      recordData.checkIn = makeISTTimestamp(day, 10, 45);
      recordData.checkOut = makeISTTimestamp(day, 19, 45);
      recordData.status = 'late';
      recordData.method = 'qr_scan';
      recordData.isLate = true;
      recordData.lateByMinutes = 45;
      recordData.workingMinutes = 540;
    } else if (i === 8) {
      // Day 8: Late
      recordData.checkIn = makeISTTimestamp(day, 10, 35);
      recordData.checkOut = makeISTTimestamp(day, 19, 30);
      recordData.status = 'late';
      recordData.method = 'qr_scan';
      recordData.isLate = true;
      recordData.lateByMinutes = 35;
      recordData.workingMinutes = 535;
    } else {
      // Normal present
      recordData.checkIn = makeISTTimestamp(day, 9, 55 + (i % 5));
      recordData.checkOut = makeISTTimestamp(day, 19, 2 + (i % 8));
      recordData.status = 'present';
      recordData.method = 'qr_scan';
      recordData.isLate = false;
      recordData.lateByMinutes = 0;
      recordData.workingMinutes = 545;
    }

    await AttendanceRecord.findOneAndUpdate(
      { employee: emp2._id, date: day },
      { $set: recordData },
      { upsert: true, new: true }
    );
  }

  // EMP004 Patterns: Remote worker with WFH days and one rejected day
  for (let i = 0; i < workingDays.length; i++) {
    const day = workingDays[i];
    let recordData = {
      employee: emp4._id,
      date: day
    };

    if (i === 5) {
      // Day 5: WFH rejected day - marked incomplete / not_checked_in
      recordData.checkIn = null;
      recordData.checkOut = null;
      recordData.status = 'not_checked_in';
      recordData.method = 'wfh';
      recordData.isLate = false;
      recordData.lateByMinutes = 0;
      recordData.workingMinutes = 0;
    } else {
      // Standard Remote WFH
      recordData.checkIn = makeISTTimestamp(day, 9, 0);
      recordData.checkOut = makeISTTimestamp(day, 18, 0);
      recordData.status = 'wfh';
      recordData.method = 'wfh';
      recordData.isLate = false;
      recordData.lateByMinutes = 0;
      recordData.workingMinutes = 540;
    }

    await AttendanceRecord.findOneAndUpdate(
      { employee: emp4._id, date: day },
      { $set: recordData },
      { upsert: true, new: true }
    );
  }

  // 6. Seed Audit Logs
  console.log('📌 [6/6] Seeding Historical Audit Logs...');
  const auditEntries = [
    {
      actor: adminUser._id,
      actorEmployeeId: adminUser.employeeId,
      action: 'POLICY_UPDATED',
      targetType: 'AttendancePolicy',
      metadata: { note: 'Initial company attendance policy established' }
    },
    {
      actor: adminUser._id,
      actorEmployeeId: adminUser.employeeId,
      action: 'USER_CREATED',
      targetType: 'User',
      targetId: emp1._id,
      targetEmployeeId: emp1.employeeId,
      metadata: { department: emp1.department, workType: emp1.workType }
    },
    {
      actor: adminUser._id,
      actorEmployeeId: adminUser.employeeId,
      action: 'USER_CREATED',
      targetType: 'User',
      targetId: emp2._id,
      targetEmployeeId: emp2.employeeId,
      metadata: { department: emp2.department, workType: emp2.workType }
    },
    {
      actor: adminUser._id,
      actorEmployeeId: adminUser.employeeId,
      action: 'USER_CREATED',
      targetType: 'User',
      targetId: emp3._id,
      targetEmployeeId: emp3.employeeId,
      metadata: { department: emp3.department, workType: emp3.workType }
    },
    {
      actor: emp1._id,
      actorEmployeeId: emp1.employeeId,
      action: 'ACCOUNT_ACTIVATED',
      targetType: 'User',
      targetId: emp1._id,
      targetEmployeeId: emp1.employeeId,
      metadata: { method: 'first_time_activation' }
    },
    {
      actor: adminUser._id,
      actorEmployeeId: adminUser.employeeId,
      action: 'LOGIN',
      targetType: 'User',
      targetId: adminUser._id,
      targetEmployeeId: adminUser.employeeId
    },
    {
      actor: emp1._id,
      actorEmployeeId: emp1.employeeId,
      action: 'LOGIN',
      targetType: 'User',
      targetId: emp1._id,
      targetEmployeeId: emp1.employeeId
    },
  ];

  for (const entry of auditEntries) {
    await AuditLog.findOneAndUpdate(
      {
        action: entry.action,
        targetEmployeeId: entry.targetEmployeeId,
        actorEmployeeId: entry.actorEmployeeId
      },
      { $set: entry },
      { upsert: true, new: true }
    );
  }

  // Summary counts
  const [userCount, shiftCount, policyCount, recordCount, wfhCount, logCount] = await Promise.all([
    User.countDocuments(),
    Shift.countDocuments(),
    AttendancePolicy.countDocuments(),
    AttendanceRecord.countDocuments(),
    WFHRequest.countDocuments(),
    AuditLog.countDocuments()
  ]);

  console.log('\n========================================================================================');
  console.log('                          DATABASE SEEDING SUMMARY');
  console.log('========================================================================================');
  console.log(` • Users Seeded:             ${userCount}`);
  console.log(` • Shifts Seeded:            ${shiftCount}`);
  console.log(` • Active Policies:          ${policyCount}`);
  console.log(` • Attendance Records:       ${recordCount} (across 10 working days)`);
  console.log(` • WFH Requests:             ${wfhCount}`);
  console.log(` • Audit Logs Recorded:      ${logCount}`);
  console.log('========================================================================================\n');

  console.log('========================================================================================');
  console.log('                       VORLDX ATTENDANCE SYSTEM - DEMO CREDENTIALS                      ');
  console.log('========================================================================================');
  console.log(
    '| Role       | Employee ID | Name            | Password     | Status / Notes                     |'
  );
  console.log(
    '|------------|-------------|-----------------|--------------|------------------------------------|'
  );
  console.log(
    '| HR Admin   | ADMIN001    | Arjun Sharma    | Admin@123    | Active, Activated                  |'
  );
  console.log(
    '| Employee   | EMP001      | Priya Patel     | Employee@123 | Active, Activated (Hybrid)         |'
  );
  console.log(
    '| Employee   | EMP002      | Rahul Verma     | Employee@123 | Active, Activated (Hybrid)         |'
  );
  console.log(
    '| Employee   | EMP003      | Sneha Krishnan  | [None - OTP] | Active, NOT Activated (OTP Flow)   |'
  );
  console.log(
    '| Employee   | EMP004      | Vikram Singh    | Employee@123 | Active, Activated (Remote)         |'
  );
  console.log(
    '| Employee   | EMP005      | Anita Desai     | Employee@123 | INACTIVE, Activated (Finance)      |'
  );
  console.log('========================================================================================\n');

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB. Seed script completed successfully.\n');
};

if (require.main === module) {
  runSeed().catch((err) => {
    console.error('\n❌ [Fatal Error] Database seed failed:', err);
    mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = runSeed;
