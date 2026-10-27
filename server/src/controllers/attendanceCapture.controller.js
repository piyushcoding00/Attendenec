const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/apiResponse');
const attendanceCaptureService = require('../services/attendanceCaptureService');
const auditService = require('../services/auditService');

exports.create = catchAsync(async (req, res) => {
  let captureRequest;
  try {
    captureRequest = await attendanceCaptureService.createRequest(
      req.user,
      req.body.token,
      req.body.location
    );
  } catch (error) {
    await auditService.log({
      actor: req.user._id || req.user.id,
      actorEmployeeId: req.user.employeeId,
      action: 'ATTENDANCE_VERIFICATION_FAILED',
      targetType: 'AttendanceCaptureRequest',
      metadata: {
        reason: error.isOperational ? error.message : 'Unexpected system error.',
        method: 'tablet_capture_request',
        gpsAccuracyMeters: req.body.location?.accuracy
      },
      req
    });
    throw error;
  }

  await auditService.log({
    actor: req.user._id || req.user.id,
    actorEmployeeId: req.user.employeeId,
    action: 'ATTENDANCE_CAPTURE_REQUESTED',
    targetType: 'AttendanceCaptureRequest',
    targetId: captureRequest._id,
    targetEmployeeId: req.user.employeeId,
    metadata: {
      displayId: captureRequest.display,
      qrTokenId: captureRequest.qrToken,
      expiresAt: captureRequest.expiresAt
    },
    req
  });

  return sendSuccess(res, {
    requestId: captureRequest._id,
    status: captureRequest.status,
    expiresAt: captureRequest.expiresAt,
    serverTime: new Date()
  }, 'QR verified. Waiting for the office tablet camera.');
});

exports.getMine = catchAsync(async (req, res) => {
  const captureRequest = await attendanceCaptureService.getEmployeeRequest(
    req.params.id,
    req.user._id || req.user.id
  );
  const attendanceTimestamp = captureRequest.action === 'check_out'
    ? captureRequest.attendanceRecord?.checkOut
    : captureRequest.attendanceRecord?.checkIn;
  const verification = captureRequest.action === 'check_out'
    ? captureRequest.attendanceRecord?.checkoutVerification
    : captureRequest.attendanceRecord?.verification;
  return sendSuccess(res, {
    requestId: captureRequest._id,
    status: captureRequest.status,
    expiresAt: captureRequest.expiresAt,
    action: captureRequest.action,
    failureReason: captureRequest.failureReason,
    record: captureRequest.attendanceRecord,
    officeName: captureRequest.display?.displayName || captureRequest.display?.location,
    verification: verification ? {
      locationVerified: verification.locationVerified,
      distanceMeters: verification.distanceMeters,
      gpsAccuracyMeters: verification.gpsAccuracyMeters,
      tabletPhotoCaptured: verification.selfieCaptured,
      identityVerification: 'not_implemented'
    } : undefined,
    serverTime: attendanceTimestamp || new Date()
  }, 'Attendance capture status retrieved.');
});

exports.cancelMine = catchAsync(async (req, res) => {
  const captureRequest = await attendanceCaptureService.cancelRequest(
    req.params.id,
    req.user._id || req.user.id
  );
  await auditService.log({
    actor: req.user._id || req.user.id,
    actorEmployeeId: req.user.employeeId,
    action: 'ATTENDANCE_CAPTURE_CANCELLED',
    targetType: 'AttendanceCaptureRequest',
    targetId: captureRequest._id,
    targetEmployeeId: req.user.employeeId,
    metadata: { displayId: captureRequest.display },
    req
  });
  return sendSuccess(res, {
    requestId: captureRequest._id,
    status: captureRequest.status
  }, 'Attendance capture request cancelled.');
});

exports.getNextForDisplay = catchAsync(async (req, res) => {
  const captureRequest = await attendanceCaptureService.getNextRequest(req.params.id);
  return sendSuccess(res, captureRequest, captureRequest ? 'Pending kiosk capture found.' : 'No pending capture.');
});

exports.submitForDisplay = catchAsync(async (req, res) => {
  let result;
  try {
    result = await attendanceCaptureService.submitCapture(
      req.params.id,
      req.params.requestId,
      req.body.photo,
      req
    );
  } catch (error) {
    await auditService.log({
      actor: req.user._id || req.user.id,
      actorEmployeeId: req.user.employeeId,
      action: 'ATTENDANCE_KIOSK_CAPTURE_FAILED',
      targetType: 'AttendanceCaptureRequest',
      targetId: req.params.requestId,
      metadata: {
        reason: error.isOperational ? error.message : 'Unexpected system error.',
        displayId: req.params.id
      },
      req
    });

    throw error;
  }

  await auditService.log({
    actor: result.record.employee?._id || result.record.employee,
    actorEmployeeId: result.record.employee?.employeeId,
    action: result.action === 'check_in' ? 'ATTENDANCE_CHECK_IN' : 'ATTENDANCE_CHECK_OUT',
    targetType: 'AttendanceRecord',
    targetId: result.record._id,
    targetEmployeeId: result.record.employee?.employeeId,
    metadata: {
      method: 'tablet_camera_qr',
      displayId: req.params.id,
      captureRequestId: req.params.requestId,
      action: result.action,
      status: result.record.status
    },
    req
  });

  return sendSuccess(res, {
    requestId: result.captureRequest._id,
    status: result.captureRequest.status,
    action: result.action,
    recordId: result.record._id,
    employee: result.record.employee,
    verification: {
      locationVerified: result.action === 'check_in'
        ? result.record.verification?.locationVerified
        : result.record.checkoutVerification?.locationVerified,
      distanceMeters: result.action === 'check_in'
        ? result.record.verification?.distanceMeters
        : result.record.checkoutVerification?.distanceMeters,
      gpsAccuracyMeters: result.action === 'check_in'
        ? result.record.verification?.gpsAccuracyMeters
        : result.record.checkoutVerification?.gpsAccuracyMeters,
      tabletPhotoCaptured: true,
      identityVerification: 'not_implemented'
    },
    serverTime: result.record.checkOut || result.record.checkIn
  }, 'Attendance marked successfully.', 200);
});

exports.failForDisplay = catchAsync(async (req, res) => {
  const captureRequest = await attendanceCaptureService.failRequest(
    req.params.id,
    req.params.requestId,
    req.body.reason
  );
  await auditService.log({
    actor: req.user._id || req.user.id,
    actorEmployeeId: req.user.employeeId,
    action: 'ATTENDANCE_KIOSK_CAPTURE_FAILED',
    targetType: 'AttendanceCaptureRequest',
    targetId: captureRequest._id,
    metadata: {
      reason: captureRequest.failureReason,
      displayId: req.params.id
    },
    req
  });
  return sendSuccess(res, {
    requestId: captureRequest._id,
    status: captureRequest.status,
    failureReason: captureRequest.failureReason
  }, 'Kiosk capture failure recorded.');
});
