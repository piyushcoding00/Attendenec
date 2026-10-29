const { body } = require('express-validator');

/**
 * Validation rules for updating attendance policy
 */
const policyUpdateRules = [
  body('companyTimezone')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Company timezone must be a valid timezone string (e.g. Asia/Kolkata)'),
  body('qrTokenExpiresSeconds')
    .optional()
    .isInt({ min: 5, max: 30 })
    .withMessage('QR token expiry must be between 5 and 30 seconds'),
  body('qrRefreshIntervalSeconds')
    .optional()
    .isInt({ min: 5, max: 30 })
    .withMessage('QR refresh interval must be between 5 and 30 seconds'),
  body('gpsAccuracyThresholdMeters')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('GPS accuracy threshold must be between 1 and 100 meters'),
  body('wfhEnabled')
    .optional()
    .isBoolean()
    .withMessage('wfhEnabled must be a boolean value'),
  body('wfhMaxDaysPerMonth')
    .optional()
    .isInt({ min: 0, max: 31 })
    .withMessage('Max WFH days per month must be between 0 and 31'),
  body('wfhRequiresApproval')
    .optional()
    .isBoolean()
    .withMessage('wfhRequiresApproval must be a boolean value'),
  body('wfhAdvanceNoticeDays')
    .optional()
    .isInt({ min: 0, max: 30 })
    .withMessage('Advance notice days must be between 0 and 30'),
  body('wfhEligibleWorkTypes')
    .optional()
    .isArray()
    .withMessage('wfhEligibleWorkTypes must be an array of work types (e.g. ["remote", "hybrid"])')
    .custom((types) => {
      const allowed = ['office', 'remote', 'hybrid'];
      const isValid = types.every((t) => allowed.includes(t));
      if (!isValid) {
        throw new Error('Work types in wfhEligibleWorkTypes must be among: office, remote, hybrid');
      }
      return true;
    }),
  body('halfDayDurationMinutes')
    .optional()
    .isInt({ min: 60, max: 480 })
    .withMessage('Half day duration must be between 60 and 480 minutes'),
  body('fullDayDurationMinutes')
    .optional()
    .isInt({ min: 120, max: 960 })
    .withMessage('Full day duration must be between 120 and 960 minutes'),
  body('attendanceCutoffHour')
    .optional()
    .isInt({ min: 0, max: 23 })
    .withMessage('Cutoff hour must be between 0 and 23'),
  body('defaultShift')
    .optional()
    .isMongoId()
    .withMessage('Invalid Shift ID format'),
  body('officeLocation')
    .optional()
    .isObject()
    .withMessage('officeLocation must be an object')
    .custom((location) => {
      const latitude = Number(location.latitude);
      const longitude = Number(location.longitude);
      if (
        location.latitude === null ||
        location.latitude === undefined ||
        String(location.latitude).trim() === '' ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
      ) {
        throw new Error('A valid office latitude is required to enforce the 50-meter geofence.');
      }
      if (
        location.longitude === null ||
        location.longitude === undefined ||
        String(location.longitude).trim() === '' ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new Error('A valid office longitude is required to enforce the 50-meter geofence.');
      }
      if (location.isEnabled === false) {
        throw new Error('The office attendance geofence cannot be disabled.');
      }
      if (location.radiusMeters !== undefined && Number(location.radiusMeters) !== 50) {
        throw new Error('The office attendance radius is fixed at 50 meters.');
      }
      return true;
    })
];

module.exports = {
  policyUpdateRules
};
