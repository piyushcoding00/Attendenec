const { createObjectCsvStringifier } = require('csv-writer');
const AttendanceRecord = require('../models/AttendanceRecord');
const AttendancePolicy = require('../models/AttendancePolicy');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const { utcToZonedTime, zonedTimeToUtc, format: formatTZ } = require('date-fns-tz');

/**
 * Helper to build attendance report query from request filters
 */
const buildReportQuery = async (params) => {
  const { startDate, endDate, department, status, employeeId } = params;
  const query = {};

  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      const s = new Date(startDate);
      query.date.$gte = new Date(
        Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), 0, 0, 0, 0)
      );
    }
    if (endDate) {
      const e = new Date(endDate);
      query.date.$lte = new Date(
        Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), 23, 59, 59, 999)
      );
    }
  }

  if (status) {
    if (status.includes(',')) {
      query.status = { $in: status.split(',').map((s) => s.trim()) };
    } else {
      query.status = status.trim();
    }
  }

  const userFilter = {
    role: 'employee',
    isDemoAccount: { $ne: true }
  };
  if (department) {
    userFilter.department = new RegExp(`^${department.trim()}$`, 'i');
  }
  if (employeeId) {
    userFilter.employeeId = new RegExp(`^${employeeId.trim()}$`, 'i');
  }

  const employees = await User.find(userFilter).select('_id').lean();
  query.employee = { $in: employees.map((employee) => employee._id) };

  return query;
};

/**
 * Get paginated attendance report with comprehensive summary statistics
 * GET /reports/attendance (HR Admin only)
 */
exports.getAttendanceReport = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const query = await buildReportQuery(req.query);

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;
  const queryForStatus = (status) => {
    if (!query.status) return { ...query, status };
    const selectedStatuses = query.status.$in || [query.status];
    return selectedStatuses.includes(status)
      ? { ...query, status }
      : { ...query, status: { $in: [] } };
  };

  // Query records and compute totals in parallel
  const [
    totalRecords,
    totalPresent,
    totalLate,
    totalWFH,
    totalIncomplete,
    records
  ] = await Promise.all([
    AttendanceRecord.countDocuments(query),
    AttendanceRecord.countDocuments(queryForStatus('present')),
    AttendanceRecord.countDocuments(queryForStatus('late')),
    AttendanceRecord.countDocuments(queryForStatus('wfh')),
    AttendanceRecord.countDocuments(queryForStatus('incomplete')),
    AttendanceRecord.find(query)
      .populate('employee', 'name employeeId department designation workType')
      .populate('linkedWFHRequest', 'reason status')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean()
  ]);

  const totalAttended = totalPresent + totalLate + totalWFH;
  const attendancePercent =
    totalRecords > 0
      ? parseFloat(((totalAttended / totalRecords) * 100).toFixed(1))
      : 0;

  const totals = {
    totalRecords,
    totalPresent,
    totalLate,
    totalWFH,
    totalIncomplete,
    attendancePercent
  };

  const totalPages = Math.ceil(totalRecords / parsedLimit) || 1;

  const pagination = {
    page: parsedPage,
    limit: parsedLimit,
    total: totalRecords,
    totalPages,
    hasNext: parsedPage < totalPages,
    hasPrev: parsedPage > 1
  };

  return res.status(200).json({
    success: true,
    message: 'Attendance report retrieved successfully',
    data: {
      records,
      totals
    },
    records,
    totals,
    pagination
  });
});

/**
 * Export attendance records as CSV download
 * GET /reports/attendance/export (HR Admin only)
 */
exports.exportCSV = catchAsync(async (req, res) => {
  const query = await buildReportQuery(req.query);

  // Fetch matched records up to 10,000 for export
  const records = await AttendanceRecord.find(query)
    .populate('employee', 'name employeeId department designation')
    .sort({ date: -1, createdAt: -1 })
    .limit(10000)
    .lean();

  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'employeeId', title: 'Employee ID' },
      { id: 'name', title: 'Name' },
      { id: 'department', title: 'Department' },
      { id: 'date', title: 'Date' },
      { id: 'checkIn', title: 'Check-In' },
      { id: 'checkOut', title: 'Check-Out' },
      { id: 'duration', title: 'Duration (hrs)' },
      { id: 'status', title: 'Status' },
      { id: 'method', title: 'Method' }
    ]
  });

  const formattedRecords = records.map((rec) => {
    const checkInStr = rec.checkIn
      ? new Date(rec.checkIn).toISOString().replace('T', ' ').substring(0, 19)
      : '-';
    const checkOutStr = rec.checkOut
      ? new Date(rec.checkOut).toISOString().replace('T', ' ').substring(0, 19)
      : '-';
    const durationHours = rec.workingMinutes
      ? (rec.workingMinutes / 60).toFixed(2)
      : '0.00';
    const dateStr = rec.date
      ? new Date(rec.date).toISOString().split('T')[0]
      : '';

    return {
      employeeId: rec.employee ? rec.employee.employeeId : 'N/A',
      name: rec.employee ? rec.employee.name : 'N/A',
      department: rec.employee ? rec.employee.department : 'N/A',
      date: dateStr,
      checkIn: checkInStr,
      checkOut: checkOutStr,
      duration: durationHours,
      status: rec.status || 'not_checked_in',
      method: rec.method || 'qr_scan'
    };
  });

  const header = csvStringifier.getHeaderString();
  const body = csvStringifier.stringifyRecords(formattedRecords);
  const csvContent = header + body;

  const todayStr = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="attendance_report_${todayStr}.csv"`
  );

  return res.status(200).send(csvContent);
});

/**
 * Get Excel-like attendance matrix / datesheet representation
 * GET /reports/matrix (HR Admin only)
 * Query: month (YYYY-MM), department
 */
exports.getDatesheetMatrix = catchAsync(async (req, res) => {
  const { month, department } = req.query;
  const policy = await AttendancePolicy.getCurrent();
  const tz = policy?.companyTimezone || 'Asia/Kolkata';

  // Default to current month if not provided
  const now = new Date();
  const zonedNow = utcToZonedTime(now, tz);
  const targetYear = month ? parseInt(month.split('-')[0], 10) : parseInt(formatTZ(zonedNow, 'yyyy', { timeZone: tz }), 10);
  const targetMonth = month ? parseInt(month.split('-')[1], 10) - 1 : parseInt(formatTZ(zonedNow, 'M', { timeZone: tz }), 10) - 1;

  // Month string (YYYY-MM)
  const monthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

  // Range in UTC covering local month
  const startDate = zonedTimeToUtc(new Date(`${monthStr}-01T00:00:00`), tz);
  const endDate = zonedTimeToUtc(new Date(`${monthStr}-${String(daysInMonth).padStart(2, '0')}T23:59:59.999`), tz);

  // Build employee filter
  const userFilter = {
    role: 'employee',
    isDemoAccount: { $ne: true }
  };
  if (department) {
    userFilter.department = new RegExp(`^${department.trim()}$`, 'i');
  }

  const employees = await User.find(userFilter)
    .select('_id name employeeId department designation workType')
    .sort({ employeeId: 1 })
    .lean();

  const employeeIds = employees.map((e) => e._id);

  // Fetch attendance records for this month (with capturedPhoto included)
  const records = await AttendanceRecord.find({
    employee: { $in: employeeIds },
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  // Create lookup map: `${employeeId}_${day}` -> status / details
  const attendanceMap = {};
  records.forEach((rec) => {
    // Convert record date to local company timezone to get exact day of the month
    const zonedDate = utcToZonedTime(new Date(rec.date), tz);
    const day = parseInt(formatTZ(zonedDate, 'd', { timeZone: tz }), 10);
    const key = `${rec.employee.toString()}_${day}`;
    attendanceMap[key] = {
      status: rec.status, // present, late, wfh, incomplete
      workingMinutes: rec.workingMinutes || 0,
      checkIn: rec.checkIn,
      checkOut: rec.checkOut,
      capturedPhoto: rec.capturedPhoto || null,
      isLate: rec.isLate || false,
      lateByMinutes: rec.lateByMinutes || 0,
    };
  });

  // Generate date list for header
  const days = [];
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayDateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
    const zonedDay = utcToZonedTime(new Date(`${dayDateStr}T12:00:00`), tz);
    const dayOfWeek = daysOfWeek[zonedDay.getDay()];
    const isWeekend = zonedDay.getDay() === 0 || zonedDay.getDay() === 6;
    days.push({
      day: d,
      date: dayDateStr,
      dayOfWeek,
      isWeekend,
    });
  }

  // Build rows per employee
  const rows = employees.map((emp) => {
    let presentCount = 0;
    let lateCount = 0;
    let wfhCount = 0;
    let incompleteCount = 0;

    const dailyAttendance = {};

    days.forEach(({ day, isWeekend }) => {
      const key = `${emp._id.toString()}_${day}`;
      const rec = attendanceMap[key];

      if (rec) {
        dailyAttendance[day] = {
          status: rec.status,
          workingMinutes: rec.workingMinutes,
          checkIn: rec.checkIn,
          checkOut: rec.checkOut,
          capturedPhoto: rec.capturedPhoto || null,
          isLate: rec.isLate || false,
          lateByMinutes: rec.lateByMinutes || 0,
          label: rec.status === 'present'
            ? 'P'
            : rec.status === 'late'
            ? 'L'
            : rec.status === 'wfh'
            ? 'W'
            : 'I',
        };
        if (rec.status === 'present') presentCount++;
        else if (rec.status === 'late') lateCount++;
        else if (rec.status === 'wfh') wfhCount++;
        else incompleteCount++;
      } else {
        dailyAttendance[day] = {
          status: isWeekend ? 'weekend' : 'not_recorded',
          label: isWeekend ? 'WO' : '-',
          checkIn: null,
          checkOut: null,
          capturedPhoto: null,
        };
      }
    });

    return {
      employee: {
        _id: emp._id,
        employeeId: emp.employeeId,
        name: emp.name,
        department: emp.department,
        designation: emp.designation,
      },
      dailyAttendance,
      summary: {
        present: presentCount,
        late: lateCount,
        wfh: wfhCount,
        incomplete: incompleteCount,
        totalPresent: presentCount + lateCount + wfhCount,
      },
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      month: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`,
      daysInMonth,
      days,
      rows,
    },
  });
});
