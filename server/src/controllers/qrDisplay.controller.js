const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');
const qrDisplayService = require('../services/qrDisplayService');
const auditService = require('../services/auditService');

/**
 * POST /qr-displays/pair (admin)
 * Registers and pairs a new office QR display device.
 */
exports.pair = catchAsync(async (req, res, next) => {
  const { displayName, location, notes, pairingCode } = req.body;

  if (!displayName || !displayName.trim()) {
    return next(new AppError('Display name is required', 400));
  }

  const display = await qrDisplayService.pairDisplay(
    { displayName, location, notes, pairingCode },
    req.user
  );

  // Log audit event
  await auditService.log({
    actor: req.user._id || req.user.id,
    actorEmployeeId: req.user.employeeId,
    action: 'QR_DISPLAY_REGISTERED',
    targetType: 'OfficeQRDisplay',
    targetId: display._id,
    metadata: {
      displayName: display.displayName,
      location: display.location,
      pairingCode: display.pairingCode
    },
    req
  });

  return sendSuccess(res, display, 'QR display paired and registered successfully', 201);
});

/**
 * GET /qr-displays (admin)
 * Returns all registered office QR displays.
 */
exports.getAll = catchAsync(async (req, res, next) => {
  const displays = await qrDisplayService.getAllDisplays();
  return sendSuccess(res, displays, 'QR displays retrieved successfully');
});

/**
 * PATCH /qr-displays/:id/status (admin)
 * Toggles an office QR display device active/inactive state.
 * Body: { isActive: boolean }
 */
exports.updateStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const isActive = req.body.isActive !== undefined ? req.body.isActive : req.body.active;

  if (typeof isActive !== 'boolean') {
    return next(new AppError('isActive boolean field is required', 400));
  }

  const display = await qrDisplayService.updateDisplayStatus(id, isActive);

  // Log audit event
  const auditAction = isActive ? 'QR_DISPLAY_ACTIVATED' : 'QR_DISPLAY_DEACTIVATED';
  await auditService.log({
    actor: req.user._id || req.user.id,
    actorEmployeeId: req.user.employeeId,
    action: auditAction,
    targetType: 'OfficeQRDisplay',
    targetId: display._id,
    metadata: {
      displayName: display.displayName,
      isActive
    },
    req
  });

  return sendSuccess(
    res,
    display,
    `QR display ${isActive ? 'activated' : 'deactivated'} successfully`
  );
});

exports.updateKioskLock = catchAsync(async (req, res) => {
  const display = await qrDisplayService.updateKioskLock(
    req.params.id,
    req.body.isLocked,
    req.user,
    req.body.password
  );
  await auditService.log({
    actor: req.user._id || req.user.id,
    actorEmployeeId: req.user.employeeId,
    action: display.isKioskLocked ? 'QR_DISPLAY_LOCKED' : 'QR_DISPLAY_UNLOCKED',
    targetType: 'OfficeQRDisplay',
    targetId: display._id,
    metadata: { displayName: display.displayName, isKioskLocked: display.isKioskLocked },
    req
  });
  return sendSuccess(res, {
    displayId: display._id,
    isKioskLocked: display.isKioskLocked
  }, `Kiosk ${display.isKioskLocked ? 'locked' : 'unlocked'} successfully.`);
});

exports.getKioskState = catchAsync(async (req, res) => {
  const display = await qrDisplayService.getDisplayById(req.params.id);
  return sendSuccess(res, {
    displayId: display._id,
    isKioskLocked: Boolean(display.isKioskLocked)
  }, 'Kiosk state retrieved.');
});

/**
 * POST /qr-displays/:id/token
 * This endpoint is called periodically by a supervisor-authenticated kiosk screen.
 * Generates and returns a fresh, cryptographically secure QR token.
 */
exports.getToken = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const tokenData = await qrDisplayService.issueToken(id, req.user);

  // Log token issuance in audit
  await auditService.log({
    actor: req.user._id || req.user.id,
    actorEmployeeId: req.user.employeeId,
    action: 'QR_TOKEN_ISSUED',
    targetType: 'OfficeQRDisplay',
    targetId: id,
    metadata: {
      displayId: id,
      expiresAt: tokenData.expiresAt,
      expiresIn: tokenData.expiresIn
    },
    req
  });

  return sendSuccess(res, tokenData, 'QR token issued successfully', 200);
});
