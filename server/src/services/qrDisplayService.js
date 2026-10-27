const crypto = require('crypto');
const QRToken = require('../models/QRToken');
const OfficeQRDisplay = require('../models/OfficeQRDisplay');
const AttendancePolicy = require('../models/AttendancePolicy');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const AttendanceCaptureRequest = require('../models/AttendanceCaptureRequest');

/**
 * Generate a new QR token for a display.
 * Returns { token, rawToken, expiresAt, expiresIn, displayId, displayName, location }
 *
 * @param {string|mongoose.Types.ObjectId} displayId - Display device ObjectId
 * @returns {Promise<Object>}
 */
exports.issueToken = async (displayId, supervisor) => {
  // 1. Find display, check isActive and isPaired
  const display = await OfficeQRDisplay.findById(displayId);
  if (!display) {
    throw new AppError('QR Display device not found', 404);
  }

  if (!display.isActive) {
    throw new AppError('This QR display is inactive. Please contact HR administration.', 400);
  }

  if (!display.isPaired) {
    throw new AppError('This QR display has not been paired yet. Please complete device pairing.', 400);
  }

  const activeCapture = await AttendanceCaptureRequest.findOne({
    display: display._id,
    status: { $in: ['pending', 'capturing'] },
    expiresAt: { $gt: new Date() }
  }).select('_id');
  if (activeCapture) {
    throw new AppError('A kiosk attendance capture is in progress. QR refresh will resume when it finishes.', 409);
  }

  // 2. Invalidate any existing non-expired tokens for this display (single active token per display)
  await QRToken.updateMany(
    {
      display: display._id,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    },
    {
      $set: { isUsed: true }
    }
  );

  // 3. Determine expiration duration from policy or config
  const policy = await AttendancePolicy.getCurrent();
  const officeLatitude = Number(policy?.officeLocation?.latitude);
  const officeLongitude = Number(policy?.officeLocation?.longitude);
  if (
    !policy ||
    policy.officeLocation?.latitude === null ||
    policy.officeLocation?.longitude === null ||
    !Number.isFinite(officeLatitude) ||
    Math.abs(officeLatitude) > 90 ||
    !Number.isFinite(officeLongitude) ||
    Math.abs(officeLongitude) > 180
  ) {
    throw new AppError('Configure valid office coordinates in Attendance Policies before starting the attendance kiosk.', 503);
  }
  const refreshSeconds = Number(policy?.qrRefreshIntervalSeconds) || 30;
  const configuredExpiry = Number(policy?.qrTokenExpiresSeconds || config.QR_TOKEN_EXPIRES_SECONDS) || 30;
  const expiresSeconds = Math.min(configuredExpiry, refreshSeconds, 30);

  // 4. Create new QRToken via QRToken.createToken static method
  const supervisorId = supervisor?._id || supervisor?.id;
  const { rawToken, record } = await QRToken.createToken(display._id, expiresSeconds, supervisorId);

  // 5. Update display.lastTokenIssuedAt
  display.lastTokenIssuedAt = new Date();
  await display.save();

  return {
    token: rawToken,
    rawToken,
    expiresAt: record.expiresAt,
    expiresIn: expiresSeconds,
    serverTime: new Date(),
    displayId: display._id,
    displayName: display.displayName,
    officeName: display.officeName,
    location: display.location,
    isKioskLocked: display.isKioskLocked,
    locationConfigured: true,
    gpsAccuracyThresholdMeters: policy.gpsAccuracyThresholdMeters || 20,
    refreshIntervalSeconds: refreshSeconds
  };
};

exports.updateKioskLock = async (displayId, isLocked, actor, password) => {
  const display = await OfficeQRDisplay.findById(displayId);
  if (!display) throw new AppError('QR Display device not found', 404);
  if (!display.isActive || !display.isPaired) {
    throw new AppError('The QR display must be active and paired before kiosk lock can change.', 409);
  }

  if (!isLocked) {
    const User = require('../models/User');
    const admin = await User.findById(actor._id || actor.id).select('+password');
    if (!admin || !admin.isActive || !await admin.correctPassword(password)) {
      throw new AppError('Admin password is incorrect. The kiosk remains locked.', 401);
    }
  }

  display.isKioskLocked = isLocked;
  await display.save();
  return display;
};

/**
 * Validate a QR token presented by an employee.
 * Returns the token record with populated display if valid, throws AppError if not.
 *
 * @param {string} rawToken - Plaintext QR token from the scanned QR code
 * @returns {Promise<Document>} - Validated QRToken document with display details attached
 */
exports.validateToken = async (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new AppError('A valid QR token string is required', 400);
  }

  // Use QRToken.verifyToken static method
  const tokenRecord = await QRToken.verifyToken(rawToken);

  if (!tokenRecord) {
    throw new AppError(
      'QR token is invalid or expired. Please scan the current office QR code.',
      400
    );
  }

  // Check display exists and is active
  const display = await OfficeQRDisplay.findById(tokenRecord.display);
  if (!display) {
    throw new AppError('The office QR display associated with this token was not found.', 404);
  }

  if (!display.isActive || !display.isPaired) {
    throw new AppError('The office QR kiosk is inactive or not authorized. Ask a supervisor to start the kiosk.', 400);
  }

  tokenRecord.display = display;
  return tokenRecord;
};

/**
 * Get all displays (Admin).
 *
 * @returns {Promise<Array<Document>>}
 */
exports.getAllDisplays = async () => {
  return OfficeQRDisplay.find()
    .populate('pairedBy', 'name employeeId department designation email')
    .sort({ createdAt: -1 });
};

/**
 * Get a single display by ID.
 *
 * @param {string|mongoose.Types.ObjectId} displayId
 * @returns {Promise<Document>}
 */
exports.getDisplayById = async (displayId) => {
  const display = await OfficeQRDisplay.findById(displayId).populate(
    'pairedBy',
    'name employeeId department designation email'
  );

  if (!display) {
    throw new AppError('QR display device not found', 404);
  }

  return display;
};

/**
 * Pair a new display (Admin).
 *
 * @param {Object} data - { displayName, officeName, location, notes, pairingCode, isActive }
 * @param {Object} adminUser - Authenticated admin user
 * @returns {Promise<Document>}
 */
exports.pairDisplay = async (data, adminUser) => {
  const { displayName, officeName, location, notes, pairingCode, isActive } = data;

  if (!displayName || !displayName.trim()) {
    throw new AppError('Display name is required', 400);
  }
  if (!officeName || !officeName.trim()) {
    throw new AppError('Office name is required', 400);
  }
  if (!location || !location.trim()) {
    throw new AppError('Office location is required', 400);
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    throw new AppError('Display status must be a boolean value', 400);
  }

  const generatedCode =
    pairingCode && pairingCode.trim()
      ? pairingCode.trim().toUpperCase()
      : `VX-DISP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const display = await OfficeQRDisplay.create({
    displayName: displayName.trim(),
    officeName: officeName.trim(),
    location: location.trim(),
    notes: notes ? notes.trim() : '',
    pairingCode: generatedCode,
    isPaired: true,
    pairedAt: new Date(),
    pairedBy: adminUser?._id || adminUser?.id,
    isActive: typeof isActive === 'boolean' ? isActive : false
  });

  return display;
};

/**
 * Update display status (Admin).
 *
 * @param {string|mongoose.Types.ObjectId} displayId
 * @param {boolean} isActive
 * @returns {Promise<Document>}
 */
exports.updateDisplayStatus = async (displayId, isActive) => {
  if (typeof isActive !== 'boolean') {
    throw new AppError('isActive status must be a boolean value', 400);
  }

  const display = await OfficeQRDisplay.findByIdAndUpdate(
    displayId,
    { isActive, ...(isActive ? {} : { isKioskLocked: false }) },
    { new: true, runValidators: true }
  ).populate('pairedBy', 'name employeeId department email');

  if (!display) {
    throw new AppError('QR display device not found', 404);
  }

  return display;
};
