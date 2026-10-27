const { body, query, param } = require('express-validator');

/**
 * Validation rules for QR scanning
 */
exports.scanQRRules = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('QR token is required'),
  body('location')
    .isObject()
    .withMessage('Current GPS location is required'),
  body('location.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('A valid GPS latitude is required')
    .toFloat(),
  body('location.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('A valid GPS longitude is required')
    .toFloat(),
  body('location.accuracy')
    .isFloat({ min: 0.000001 })
    .withMessage('GPS accuracy is required')
    .toFloat(),
  body('photo')
    .isString()
    .isLength({ max: 8000000 })
    .matches(/^data:image\/(?:jpeg|png|webp);base64,/i)
    .withMessage('Photo must be a supported, size-limited base64 image')
];

exports.verifyQRRules = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('QR token is required')
];

exports.captureRequestRules = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('QR token is required'),
  body('location')
    .isObject()
    .withMessage('Current GPS location is required'),
  body('location.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('A valid GPS latitude is required')
    .toFloat(),
  body('location.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('A valid GPS longitude is required')
    .toFloat(),
  body('location.accuracy')
    .isFloat({ gt: 0 })
    .withMessage('GPS accuracy is required')
    .toFloat(),
  body('location.timestamp')
    .isISO8601()
    .withMessage('A valid GPS timestamp is required')
];

exports.tabletCaptureRules = [
  body('photo')
    .isString()
    .isLength({ max: 8000000 })
    .matches(/^data:image\/(?:jpeg|png|webp);base64,/i)
    .withMessage('The tablet must submit a supported, size-limited camera image')
];

exports.captureRequestIdRules = [
  param('id')
    .isMongoId()
    .withMessage('A valid capture request ID is required')
];

exports.photoAttendanceRules = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('A current office QR token is required'),
  body('photo')
    .isString()
    .isLength({ max: 8000000 })
    .matches(/^data:image\/(?:jpeg|png|webp);base64,/i)
    .withMessage('Photo must be a supported, size-limited base64 image'),
  body('location')
    .isObject()
    .withMessage('Current GPS location is required'),
  body('location.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('A valid GPS latitude is required')
    .toFloat(),
  body('location.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('A valid GPS longitude is required')
    .toFloat(),
  body('location.accuracy')
    .isFloat({ gt: 0 })
    .withMessage('GPS accuracy is required')
    .toFloat()
];

/**
 * Validation rules for attendance correction by HR Admin
 */
exports.correctionRules = [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Correction reason is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Correction reason must be between 10 and 500 characters'),
  body('checkIn')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('Invalid checkIn timestamp format (ISO8601 required)'),
  body('checkOut')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('Invalid checkOut timestamp format (ISO8601 required)'),
  body('status')
    .optional()
    .isIn(['present', 'late', 'wfh', 'incomplete'])
    .withMessage('Invalid status. Allowed values: present, late, wfh, incomplete')
];

/**
 * Validation rules for pairing an office QR display device
 */
exports.pairDisplayRules = [
  body('displayName')
    .trim()
    .notEmpty()
    .withMessage('Display name is required')
    .isLength({ max: 100 })
    .withMessage('Display name cannot exceed 100 characters'),
  body('officeName')
    .trim()
    .notEmpty()
    .withMessage('Office name is required')
    .isLength({ max: 100 })
    .withMessage('Office name cannot exceed 100 characters'),
  body('location')
    .trim()
    .notEmpty()
    .withMessage('Office location is required')
    .isLength({ max: 200 })
    .withMessage('Location cannot exceed 200 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Display status must be active or inactive')
    .toBoolean()
];

/**
 * Validation rules for updating display status
 */
exports.updateDisplayStatusRules = [
  body('isActive')
    .notEmpty()
    .withMessage('isActive is required')
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

/**
 * Validation rules for querying attendance records
 */
exports.attendanceQueryRules = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid startDate format (must be ISO8601)'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid endDate format (must be ISO8601)'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('status')
    .optional()
    .isIn(['present', 'late', 'wfh', 'incomplete', 'not_checked_in'])
    .withMessage('Invalid status filter value'),
  query('department')
    .optional()
    .trim(),
  query('employeeId')
    .optional()
    .trim()
];
