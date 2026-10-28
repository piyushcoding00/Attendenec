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

  // 7 days start boundary for trend
  const sevenDaysAgoStart = new Date(todayStart);
  sevenDaysAgoStart.setUTCDate(sevenDaysAgoStart.getUTCDate() - 6);

  // 1. Fetch live active employee IDs and count
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

  // 2. Run all dashboard aggregations and queries in a single Promise.all for maximum speed (<50ms)
  const [
    todayStatusCounts,
    pendingWFH,
    deptAttendance,
    sevenDaysRecords,
    recentActivity,
    recentWFH
  ] = await Promise.all([
    // Today's status counts grouped by status in one query
    AttendanceRecord.aggregate([
      {
        $match: {
          date: { $gte: todayStart, $lte: todayEnd },
          employee: { $in: employeeIds }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),

    // Pending WFH count
    WFHRequest.countDocuments({
      status: 'pending',
      employee: { $in: employeeIds }
    }),

    // Department-wise attendance today in one aggregation
    AttendanceRecord.aggregate([
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
    ]),

    // 7 days trend data in ONE single fast aggregation query instead of 21 queries!
    AttendanceRecord.aggregate([
      {
        $match: {
          date: { $gte: sevenDaysAgoStart, $lte: todayEnd },
          employee: { $in: employeeIds }
        }
      },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      }
    ]),

    // Recent 10 activities
    AttendanceRecord.find({
      employee: { $in: employeeIds },
      checkIn: { $exists: true }
    })
      .sort({ checkIn: -1 })
      .limit(10)
      .populate('employee', 'name employeeId department designation')
      .lean(),

    // Recent 5 WFH requests
    WFHRequest.find({
      employee: { $in: employeeIds }
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('employee', 'name employeeId department designation')
      .populate('reviewer', 'name employeeId')
      .lean()
  ]);

  // Process today counts
  let presentToday = 0;
  let lateToday = 0;
  let wfhToday = 0;
  for (const item of todayStatusCounts) {
    if (item._id === 'present') presentToday += item.count;
    else if (item._id === 'late') {
      lateToday += item.count;
      presentToday += item.count; // late is also present
    } else if (item._id === 'wfh') {
      wfhToday += item.count;
      presentToday += item.count;
    }
  }

  // Format 7 days trend map
  const trendMap = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    trendMap[dateStr] = {
      date: dateStr,
      present: 0,
      late: 0,
      wfh: 0,
      absent: 0,
      total: totalEmployees
    };
  }

  for (const item of sevenDaysRecords) {
    const day = item._id.day;
    const status = item._id.status;
    if (trendMap[day]) {
      if (status === 'present') trendMap[day].present += item.count;
      else if (status === 'late') trendMap[day].late += item.count;
      else if (status === 'wfh') trendMap[day].wfh += item.count;
    }
  }

  const attendanceTrend = Object.values(trendMap).map((item) => {
    const attended = item.present + item.late + item.wfh;
    item.absent = Math.max(0, totalEmployees - attended);
    return item;
  });

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
