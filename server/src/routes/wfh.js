const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/wfh.controller');
const { protect } = require('../middleware/authenticate');
const { isHRAdmin } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { wfhRequestRules, decisionRules } = require('../validators/wfh.validators');

// Check WFH eligibility for a specific date
router.get('/eligibility', protect, ctrl.getEligibility);

// Submit a new WFH request
router.post('/requests', protect, wfhRequestRules, validate, ctrl.submitRequest);
router.post('/request', protect, wfhRequestRules, validate, ctrl.submitRequest);

// Get authenticated user's WFH requests
router.get('/requests/me', protect, ctrl.getMyRequests);
router.get('/my-requests', protect, ctrl.getMyRequests);

// HR Admin: Get all WFH requests
router.get('/requests', protect, isHRAdmin, ctrl.getAllRequests);

// HR Admin: Approve or reject a WFH request
router.patch('/requests/:id/decision', protect, isHRAdmin, decisionRules, validate, ctrl.makeDecision);

module.exports = router;
