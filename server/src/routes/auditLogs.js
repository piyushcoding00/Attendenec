const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/auditLog.controller');
const { protect } = require('../middleware/authenticate');
const { isHRAdmin } = require('../middleware/authorize');

// HR Admin: Get paginated audit logs with filters
router.get('/', protect, isHRAdmin, ctrl.getAll);

module.exports = router;
