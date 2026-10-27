const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/policy.controller');
const { protect } = require('../middleware/authenticate');
const { isHRAdmin } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { policyUpdateRules } = require('../validators/policy.validators');

// Get active attendance policy and shifts (authenticated)
router.get('/', protect, ctrl.getAll);

// Update attendance policy (HR Admin only)
router.patch('/:id', protect, isHRAdmin, policyUpdateRules, validate, ctrl.update);
router.put('/:id', protect, isHRAdmin, policyUpdateRules, validate, ctrl.update);

module.exports = router;
