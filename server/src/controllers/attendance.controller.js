const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { sendSuccess, sendPaginated } = require('../utils/apiResponse');
const attendanceService = require('../services/attendanceService');
const qrDisplayService = require('../services/qrDisplayService');
const auditService = require('../services/auditService');

/**
 * GET /attendance/today
 * Returns today's attendance record for the authenticated employee.
 */
exports.getToday = catchAsync(async (req, res, next) => {
  const employeeId = req.user._id || req.user.id;
  const record = await attendanceService.getTodayAttendance(employeeId);

  return sendSuccess(
    res,
    record,
    record ? "Today's attendance record retrieved successfully" : 'No attendance record found for today'
  );
});

/**
 * GET /attendance/me
 * Returns attendance history for the authenticated employee with pagination and date filters.
 * Query: startDate, endDate, page, limit
 */
exports.getMyAttendance = catchAsync(async (req, res, next) => {
  const employeeId = req.user._id || req.user.id;
  const { startDate, endDate, page, limit } = req.query;

  const result = await attendanceService.getEmployeeAttendance(employeeId, {
    startDate,
    endDate,
    page,
    limit
  });

  return res.status(200).json({
    success: true,
    message: 'My attendance history retrieved successfully',
    data: { records: result.records },
    pagination: result.pagination
  });
});

/**
 * GET /attendance (admin only)
 * Returns all attendance records across the organization with filters.
 * Query: startDate, endDate, department, status, employeeId, page, limit
 */
exports.getAllAttendance = catchAsync(async (req, res, next) => {
  const result = await attendanceService.getAllAttendance(req.query);

  return res.status(200).json({
    success: true,
    message: 'Attendance records retrieved successfully',
    data: { records: result.records },
    pagination: result.pagination
  });
});

/**
 * POST /attendance/scan-qr
 * Employee checks in or checks out by presenting a scanned QR token.
 * Body: { token } - The raw QR token string
 */
exports.scanQR = catchAsync(async (req, res, next) => {
  await auditService.log({
    actor: req.user._id || req.user.id,
    actorEmployeeId: req.user.employeeId,
    action: 'ATTENDANCE_VERIFICATION_FAILED',
    targetType: 'AttendanceVerification',
    metadata: {
      reason: 'Mobile-submitted attendance photos are disabled.',
      method: 'mobile_scan_rejected'
    },
    req
  });
  return next(new AppError(
    'Attendance photos must be captured by the authorized office tablet. Scan the kiosk QR to start a tablet capture request.',
    403
  ));
});

/**
 * POST /attendance/verify-qr
 * Confirms a scanned token is current before requesting the employee selfie.
 */
exports.verifyQR = catchAsync(async (req, res) => {
  let tokenRecord;
  try {
    tokenRecord = await qrDisplayService.validateToken(req.body.token);
  } catch (error) {
    await auditService.log({
      actor: req.user._id || req.user.id,
      actorEmployeeId: req.user.employeeId,
      action: 'ATTENDANCE_VERIFICATION_FAILED',
      targetType: 'AttendanceVerification',
      metadata: { reason: error.message, method: 'qr_precheck' },
      req
    });
    throw error;
  }
  const policy = await require('../models/AttendancePolicy').getCurrent();
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  return sendSuccess(res, {
    valid: true,
    expiresAt: tokenRecord.expiresAt,
    gpsAccuracyThresholdMeters: policy?.gpsAccuracyThresholdMeters || 20,
    officeRadiusMeters: 50,
    display: {
      id: tokenRecord.display._id,
      name: tokenRecord.display.displayName,
      location: tokenRecord.display.location
    }
  }, 'Current office QR code verified');
});

/**
 * POST /attendance/photo-attendance
 * Legacy route; now requires the same QR, GPS, and selfie verification as /scan.
 */
exports.markAttendanceByPhoto = catchAsync(async (req, res, next) => {
  await auditService.log({
    actor: req.user._id || req.user.id,
    actorEmployeeId: req.user.employeeId,
    action: 'ATTENDANCE_VERIFICATION_FAILED',
    targetType: 'AttendanceVerification',
    metadata: {
      reason: 'Mobile photo attendance is disabled.',
      method: 'mobile_photo_rejected'
    },
    req
  });
  return next(new AppError(
    'Mobile photo attendance is disabled. Scan the office kiosk QR and wait for its tablet camera.',
    403
  ));
});

/**
 * GET /attendance/generate-qr
 * Generates a fresh 18-second QR token for the employee to display and scan.
 * Uses a system virtual display (auto-created if none exists).
 */
exports.generateQRToken = catchAsync(async (req, res, next) => {
  return next(new AppError(
    'Employee-generated QR codes are disabled. Attendance requires a current QR from an active supervisor-managed office kiosk.',
    403
  ));
});

/**
 * POST /attendance/check-out
 * Employee clicks Check-Out to record checkOut timestamp and duration.
 */
exports.checkOut = catchAsync(async (req, res, next) => {
  return next(new AppError(
    'Direct check-out is disabled. Scan the current office kiosk QR, verify GPS, and submit a selfie to check out.',
    403
  ));
});



/**
 * GET /attendance/summary (admin only)
 * Returns attendance summary statistics.
 * Query: startDate, endDate, employeeId
 */
exports.getSummary = catchAsync(async (req, res, next) => {
  const stats = await attendanceService.getSummaryStats(req.query);
  return sendSuccess(res, stats, 'Attendance summary statistics retrieved successfully');
});

/**
 * GET /attendance/:id (admin)
 * Returns a specific attendance record by ID.
 */
exports.getById = catchAsync(async (req, res, next) => {
  const record = await attendanceService.getById(req.params.id);
  return sendSuccess(res, record, 'Attendance record retrieved successfully');
});

/**
 * PATCH /attendance/:id/correction (admin only)
 * Applies a manual HR attendance correction to an existing record.
 * Body: { checkIn?, checkOut?, status?, reason (required) }
 */
exports.correctAttendance = catchAsync(async (req, res, next) => {
  const { reason, checkIn, checkOut, status } = req.body;

  if (!reason || reason.trim().length < 10) {
    return next(new AppError('A valid correction reason is required (minimum 10 characters)', 400));
  }

  const updatedRecord = await attendanceService.applyCorrection(
    req.params.id,
    { reason, checkIn, checkOut, status },
    req.user
  );

  // Log attendance correction audit event
  await auditService.log({
    actor: req.user._id || req.user.id,
    actorEmployeeId: req.user.employeeId,
    action: 'ATTENDANCE_CORRECTED',
    targetType: 'AttendanceRecord',
    targetId: updatedRecord._id,
    targetEmployeeId: updatedRecord.employee?.employeeId,
    metadata: {
      reason: reason.trim(),
      previousValues: updatedRecord.correction?.previousValues,
      newValues: {
        checkIn: updatedRecord.checkIn,
        checkOut: updatedRecord.checkOut,
        status: updatedRecord.status,
        workingMinutes: updatedRecord.workingMinutes
      }
    },
    req
  });

  return res.status(200).json({
    success: true,
    message: 'Attendance record corrected successfully',
    data: { record: updatedRecord }
  });
});
