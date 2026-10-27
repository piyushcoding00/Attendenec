const AttendanceCaptureRequest = require('../models/AttendanceCaptureRequest');
const AttendancePolicy = require('../models/AttendancePolicy');
const OfficeQRDisplay = require('../models/OfficeQRDisplay');
const QRToken = require('../models/QRToken');
const User = require('../models/User');
const AttendanceRecord = require('../models/AttendanceRecord');
const WFHRequest = require('../models/WFHRequest');
const attendanceService = require('./attendanceService');
const qrDisplayService = require('./qrDisplayService');
const AppError = require('../utils/AppError');

const REQUEST_TTL_MS = 60 * 1000;
const MAX_LOCATION_AGE_MS = 60 * 1000;
const MAX_FUTURE_LOCATION_SKEW_MS = 5 * 1000;

const validateFreshLocation = (location) => {
  const timestamp = new Date(location?.timestamp).getTime();
  const age = Date.now() - timestamp;
  if (
    !Number.isFinite(timestamp) ||
    age > MAX_LOCATION_AGE_MS ||
    age < -MAX_FUTURE_LOCATION_SKEW_MS
  ) {
    throw new AppError('GPS reading is stale or has an invalid timestamp. Refresh your location and retry.', 400);
  }
};

exports.createRequest = async (employee, rawToken, location) => {
  if (!employee || employee.role !== 'employee' || !employee.isActive) {
    throw new AppError('Only active employees can request attendance capture.', 403);
  }
  validateFreshLocation(location);
  const tokenRecord = await qrDisplayService.validateToken(rawToken);
  if (!tokenRecord.display.isKioskLocked) {
    throw new AppError('Attendance kiosk is not locked by an administrator yet. Ask the office administrator to lock the kiosk screen.', 403);
  }
  const policy = await AttendancePolicy.getCurrent();
  attendanceService.enforceOfficeGeofence(policy, location);

  const employeeId = employee._id || employee.id;
  const displayId = tokenRecord.display._id.toString();
  const now = new Date();
  const todayUTC = await attendanceService.getTodayUTC();
  const [approvedWFH, existingRecord] = await Promise.all([
    WFHRequest.findOne({ employee: employeeId, requestedDate: todayUTC, status: 'approved' }),
    AttendanceRecord.findOne({ employee: employeeId, date: todayUTC })
  ]);
  if (approvedWFH) {
    throw new AppError('You have approved Work From Home for today. On-site attendance is not permitted.', 400);
  }
  if (existingRecord?.checkOut) {
    throw new AppError('Today check-in and check-out are already complete.', 409);
  }

  await AttendanceCaptureRequest.updateMany(
    {
      activeDisplayId: displayId,
      status: { $in: ['pending', 'capturing'] },
      expiresAt: { $lte: now }
    },
    {
      $set: { status: 'expired', failureReason: 'Capture request expired.' },
      $unset: { activeDisplayId: 1 }
    }
  );

  try {
    return await AttendanceCaptureRequest.create({
      employee: employeeId,
      display: tokenRecord.display._id,
      qrToken: tokenRecord._id,
      location: {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        accuracy: Number(location.accuracy),
        timestamp: new Date(location.timestamp)
      },
      activeDisplayId: displayId,
      status: 'pending',
      expiresAt: new Date(Math.min(tokenRecord.expiresAt.getTime(), now.getTime() + REQUEST_TTL_MS))
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError('This kiosk is handling another attendance request. Please retry when it is ready.', 409);
    }
    throw error;
  }
};

exports.getNextRequest = async (displayId) => {
  const now = new Date();
  await AttendanceCaptureRequest.updateMany(
    {
      activeDisplayId: displayId,
      status: { $in: ['pending', 'capturing'] },
      expiresAt: { $lte: now }
    },
    {
      $set: { status: 'expired', failureReason: 'Capture request expired.' },
      $unset: { activeDisplayId: 1 }
    }
  );

  const display = await OfficeQRDisplay.findById(displayId);
  if (!display || !display.isActive || !display.isPaired) {
    throw new AppError('The kiosk is inactive or is not authorized.', 403);
  }

  const captureRequest = await AttendanceCaptureRequest.findOne({
    display: displayId,
    status: 'pending',
    expiresAt: { $gt: now }
  })
    .populate('employee', 'name employeeId')
    .sort({ createdAt: 1 });

  if (!captureRequest) return null;
  return {
    id: captureRequest._id,
    employee: captureRequest.employee,
    expiresAt: captureRequest.expiresAt,
    createdAt: captureRequest.createdAt
  };
};

exports.getEmployeeRequest = async (requestId, employeeId) => {
  const captureRequest = await AttendanceCaptureRequest.findOne({
    _id: requestId,
    employee: employeeId
  })
    .populate('attendanceRecord', 'checkIn checkOut status workingMinutes verification checkoutVerification')
    .populate('display', 'displayName location');

  if (!captureRequest) {
    throw new AppError('Attendance capture request was not found.', 404);
  }

  if (
    ['pending', 'capturing'].includes(captureRequest.status) &&
    captureRequest.expiresAt <= new Date()
  ) {
    captureRequest.status = 'expired';
    captureRequest.failureReason = 'Capture request expired.';
    captureRequest.activeDisplayId = undefined;
    await captureRequest.save();
  }

  return captureRequest;
};

exports.cancelRequest = async (requestId, employeeId) => {
  const captureRequest = await AttendanceCaptureRequest.findOneAndUpdate(
    {
      _id: requestId,
      employee: employeeId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    },
    {
      $set: { status: 'cancelled', failureReason: 'Cancelled by employee.' },
      $unset: { activeDisplayId: 1 }
    },
    { new: true }
  );
  if (!captureRequest) {
    throw new AppError('The request is already being captured, expired, or completed and cannot be cancelled.', 409);
  }
  return captureRequest;
};

exports.submitCapture = async (displayId, requestId, capturedPhoto, req) => {
  const now = new Date();
  const captureRequest = await AttendanceCaptureRequest.findOneAndUpdate(
    {
      _id: requestId,
      display: displayId,
      status: 'pending',
      expiresAt: { $gt: now }
    },
    { $set: { status: 'capturing', capturedAt: now } },
    { new: true }
  );

  if (!captureRequest) {
    throw new AppError('This capture request is expired, already processed, or belongs to another kiosk.', 409);
  }

  try {
    validateFreshLocation(captureRequest.location);
    const [display, employee, tokenRecord] = await Promise.all([
      OfficeQRDisplay.findById(displayId),
      User.findById(captureRequest.employee),
      QRToken.findOne({
        _id: captureRequest.qrToken,
        display: displayId,
        isUsed: false,
        expiresAt: { $gt: new Date() }
      })
    ]);

    if (!display || !display.isActive || !display.isPaired) {
      throw new AppError('The kiosk is no longer active or authorized.', 403);
    }
    if (!display.isKioskLocked) {
      throw new AppError('The attendance kiosk was unlocked before capture completed.', 403);
    }
    if (!employee || !employee.isActive || employee.role !== 'employee') {
      throw new AppError('The employee account is no longer eligible for attendance.', 403);
    }
    if (!tokenRecord) {
      throw new AppError('The QR token expired before the tablet completed capture. Please scan the current code again.', 400);
    }
    tokenRecord.display = display;

    const result = await attendanceService.processQRScan(
      employee,
      tokenRecord,
      displayId,
      captureRequest.location,
      capturedPhoto
    );

    captureRequest.status = 'completed';
    captureRequest.attendanceRecord = result.record._id;
    captureRequest.action = result.action;
    captureRequest.activeDisplayId = undefined;
    await captureRequest.save();
    return { captureRequest, ...result };
  } catch (error) {
    captureRequest.status = captureRequest.expiresAt <= new Date() ? 'expired' : 'failed';
    captureRequest.failureReason = error.isOperational
      ? error.message.slice(0, 300)
      : 'Attendance could not be completed because a system error occurred.';
    captureRequest.activeDisplayId = undefined;
    await captureRequest.save();
    throw error;
  }
};

exports.failRequest = async (displayId, requestId, reason) => {
  const captureRequest = await AttendanceCaptureRequest.findOneAndUpdate(
    {
      _id: requestId,
      display: displayId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    },
    {
      $set: {
        status: 'failed',
        failureReason: reason || 'The kiosk camera could not capture an image.'
      },
      $unset: { activeDisplayId: 1 }
    },
    { new: true }
  );
  if (!captureRequest) {
    throw new AppError('This capture request is expired, already processed, or belongs to another kiosk.', 409);
  }
  return captureRequest;
};
