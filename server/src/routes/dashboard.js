const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/authenticate');
const { isHRAdmin } = require('../middleware/authorize');

// HR Admin: Get dashboard overview summary, trends, and recent activities
router.get('/summary', protect, isHRAdmin, ctrl.getSummary);

module.exports = router;
