const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authenticate');
const { isHRAdmin } = require('../middleware/authorize');
const { qrTokenIssueLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/qrDisplay.controller');
const captureCtrl = require('../controllers/attendanceCapture.controller');
const { body, param } = require('express-validator');
const {
  pairDisplayRules,
  updateDisplayStatusRules,
  tabletCaptureRules
} = require('../validators/attendance.validators');

const displayIdRules = [
  param('id').isMongoId().withMessage('A valid QR display ID is required')
];
const kioskLockRules = [
  ...displayIdRules,
  body('isLocked').isBoolean().withMessage('isLocked must be a boolean').toBoolean(),
  body('password').custom((value, { req }) => {
    if (req.body.isLocked === false && (typeof value !== 'string' || !value)) {
      throw new Error('Admin password is required to unlock the kiosk');
    }
    return true;
  })
];
const captureRequestRouteRules = [
  ...displayIdRules,
  param('requestId').isMongoId().withMessage('A valid capture request ID is required')
];

// Admin routes
router.post('/pair', protect, isHRAdmin, pairDisplayRules, validate, ctrl.pair);
router.get('/', protect, isHRAdmin, ctrl.getAll);
router.patch(
  '/:id/status',
  protect,
  isHRAdmin,
  updateDisplayStatusRules,
  validate,
  ctrl.updateStatus
);
router.get('/:id/kiosk-state', protect, isHRAdmin, displayIdRules, validate, ctrl.getKioskState);
router.patch('/:id/kiosk-lock', protect, isHRAdmin, kioskLockRules, validate, ctrl.updateKioskLock);

// Kiosk sessions are managed by authenticated HR and Super Admin users.
router.get('/:id/capture-requests/next', protect, isHRAdmin, displayIdRules, validate, captureCtrl.getNextForDisplay);
router.post(
  '/:id/capture-requests/:requestId/capture',
  protect,
  isHRAdmin,
  captureRequestRouteRules,
  tabletCaptureRules,
  validate,
  captureCtrl.submitForDisplay
);
router.post(
  '/:id/capture-requests/:requestId/failure',
  protect,
  isHRAdmin,
  captureRequestRouteRules,
  body('reason').optional().isString().isLength({ max: 300 }),
  validate,
  captureCtrl.failForDisplay
);
router.post('/:id/token', protect, isHRAdmin, displayIdRules, validate, qrTokenIssueLimiter, ctrl.getToken);

module.exports = router;
