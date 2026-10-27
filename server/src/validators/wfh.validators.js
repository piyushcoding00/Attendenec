const { body } = require('express-validator');

/**
 * Validation rules for submitting a WFH request
 */
const wfhRequestRules = [
  body('requestedDate')
    .notEmpty()
    .withMessage('Requested date is required')
    .isISO8601()
    .withMessage('Requested date must be a valid ISO8601 date string (e.g. YYYY-MM-DD)'),
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Reason for WFH request is required')
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters')
];

/**
 * Validation rules for HR admin review decision on a WFH request
 */
const decisionRules = [
  body('status')
    .notEmpty()
    .withMessage('Decision status is required')
    .isIn(['approved', 'rejected'])
    .withMessage('Status must be either "approved" or "rejected"'),
  body('reviewComment')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Review comment cannot exceed 500 characters')
];

module.exports = {
  wfhRequestRules,
  decisionRules
};
