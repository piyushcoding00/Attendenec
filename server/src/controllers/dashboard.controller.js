const User = require('../models/User');
const AttendanceRecord = require('../models/AttendanceRecord');
const WFHRequest = require('../models/WFHRequest');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * Get comprehensive dashboard metrics, summaries, trends, and recent activities
 * GET /dashboard/summary (HR Admin only)
 */
exports.getSummary = catchAsync(async (req, res) => {
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );
  const todayEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
  );

  // Demo accounts are seeded for walkthroughs and must not appear in live metrics.
  const [totalEmployees, employeeIds] = await Promise.all([
    User.countDocuments({
      isActive: true,
      role: 'employee',
      isDemoAccount: { $ne: true }
    }),
    User.distinct('_id', {
      role: 'employee',
      isActive: true,
      isDemoAccount: { $ne: true }
    })
  ]);

  // 2. Present today (status: present or late or wfh)
  const presentToday = await AttendanceRecord.countDocuments({
    date: { $gte: todayStart, $lte: todayEnd },
    employee: { $in: employeeIds },
    status: { $in: ['present', 'late', 'wfh'] }
  });

  // 3. Late today
  const lateToday = await AttendanceRecord.countDocuments({
    date: { $gte: todayStart, $lte: todayEnd },
    employee: { $in: employeeIds },
    status: 'late'
  });

  // 4. WFH today
  const wfhToday = await AttendanceRecord.countDocuments({
    date: { $gte: todayStart, $lte: todayEnd },
    employee: { $in: employeeIds },
    status: 'wfh'
  });

  // 5. Pending WFH requests
  const pendingWFH = await WFHRequest.countDocuments({
    status: 'pending',
    employee: { $in: employeeIds }
  });

  // 6. Department-wise attendance today
  const deptAttendance = await AttendanceRecord.aggregate([
    {
      $match: {
        date: { $gte: todayStart, $lte: todayEnd },
        employee: { $in: employeeIds },
        status: { $in: ['present', 'late', 'wfh'] }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'employee',
        foreignField: '_id',
        as: 'emp'
      }
    },
    { $unwind: '$emp' },
    {
      $group: {
        _id: '$emp.department',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        department: '$_id',
        count: 1,
        _id: 0
      }
    },
    { $sort: { count: -1 } }
  ]);

  // 7. Attendance trend for last 7 days
  const trendPromises = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStart = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
    );
    const dayEnd = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)
    );
    const dateStr = dayStart.toISOString().split('T')[0];

    trendPromises.push(
      (async () => {
        const [presentCount, lateCount, wfhCount] = await Promise.all([
          AttendanceRecord.countDocuments({
            date: { $gte: dayStart, $lte: dayEnd },
            employee: { $in: employeeIds },
            status: 'present'
          }),
          AttendanceRecord.countDocuments({
            date: { $gte: dayStart, $lte: dayEnd },
            employee: { $in: employeeIds },
            status: 'late'
          }),
          AttendanceRecord.countDocuments({
            date: { $gte: dayStart, $lte: dayEnd },
            employee: { $in: employeeIds },
            status: 'wfh'
          })
        ]);

        const attended = presentCount + lateCount + wfhCount;
        const absentCount = Math.max(0, totalEmployees - attended);

        return {
          date: dateStr,
          present: presentCount,
          late: lateCount,
          wfh: wfhCount,
          absent: absentCount,
          total: totalEmployees
        };
      })()
    );
  }
  const attendanceTrend = await Promise.all(trendPromises);

  // 8. Recent activity: last 10 attendance check-ins
  const recentActivity = await AttendanceRecord.find({
    employee: { $in: employeeIds },
    checkIn: { $exists: true }
  })
    .sort({ checkIn: -1 })
    .limit(10)
    .populate('employee', 'name employeeId department designation')
    .lean();

  // 9. Recent WFH requests: last 5 requests
  const recentWFH = await WFHRequest.find({
    employee: { $in: employeeIds }
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('employee', 'name employeeId department designation')
    .populate('reviewer', 'name employeeId')
    .lean();

  return sendSuccess(
    res,
    {
      overview: {
        totalEmployees,
        presentToday,
        lateToday,
        wfhToday,
        pendingWFH,
        attendanceRate:
          totalEmployees > 0
            ? Math.round((presentToday / totalEmployees) * 100)
            : 0
      },
      deptAttendance,
      attendanceTrend,
      recentActivity,
      recentWFH
    },
    'Dashboard summary retrieved successfully'
  );
});
