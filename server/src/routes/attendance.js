const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authenticate');
const { isHRAdmin, restrictTo } = require('../middleware/authorize');
const { qrScanLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/attendance.controller');
const captureCtrl = require('../controllers/attendanceCapture.controller');
const {
  scanQRRules,
  verifyQRRules,
  captureRequestRules,
  captureRequestIdRules,
  tabletCaptureRules,
  photoAttendanceRules,
  correctionRules,
  attendanceQueryRules
} = require('../validators/attendance.validators');

// Employee routes
router.get('/today', protect, ctrl.getToday);
router.get('/me', protect, attendanceQueryRules, validate, ctrl.getMyAttendance);
router.get('/my-history', protect, attendanceQueryRules, validate, ctrl.getMyAttendance);
router.get('/generate-qr', protect, isHRAdmin, ctrl.generateQRToken);
router.post('/verify-qr', protect, qrScanLimiter, verifyQRRules, validate, ctrl.verifyQR);
router.post('/capture-requests', protect, restrictTo('employee'), qrScanLimiter, captureRequestRules, validate, captureCtrl.create);
router.get('/capture-requests/:id', protect, restrictTo('employee'), captureRequestIdRules, validate, captureCtrl.getMine);
router.delete('/capture-requests/:id', protect, restrictTo('employee'), captureRequestIdRules, validate, captureCtrl.cancelMine);
router.post('/scan-qr', protect, qrScanLimiter, scanQRRules, validate, ctrl.scanQR);
router.post('/scan', protect, qrScanLimiter, scanQRRules, validate, ctrl.scanQR);
router.post('/photo-attendance', protect, qrScanLimiter, photoAttendanceRules, validate, ctrl.markAttendanceByPhoto);
router.post('/check-out', protect, ctrl.checkOut);
router.post('/checkout', protect, ctrl.checkOut);

// Admin routes
router.get('/summary', protect, isHRAdmin, attendanceQueryRules, validate, ctrl.getSummary);
router.get('/', protect, isHRAdmin, attendanceQueryRules, validate, ctrl.getAllAttendance);
router.get('/:id', protect, isHRAdmin, ctrl.getById);
router.patch(
  '/:id/correction',
  protect,
  isHRAdmin,
  correctionRules,
  validate,
  ctrl.correctAttendance
);
router.patch(
  '/:id/correct',
  protect,
  isHRAdmin,
  correctionRules,
  validate,
  ctrl.correctAttendance
);

module.exports = router;
