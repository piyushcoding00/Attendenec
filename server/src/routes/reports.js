const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reports.controller');
const { protect } = require('../middleware/authenticate');
const { isHRAdmin } = require('../middleware/authorize');

// HR Admin: Get filtered attendance report with stats
router.get('/attendance', protect, isHRAdmin, ctrl.getAttendanceReport);

// HR Admin: Export attendance report to CSV
router.get('/attendance/export', protect, isHRAdmin, ctrl.exportCSV);

// HR Admin: Get datesheet matrix view
router.get('/matrix', protect, isHRAdmin, ctrl.getDatesheetMatrix);

module.exports = router;
