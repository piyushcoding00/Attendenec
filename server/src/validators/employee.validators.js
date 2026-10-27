const { body } = require('express-validator');

/**
 * Validation rules for creating a new employee
 */
const createEmployeeRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  body('department')
    .trim()
    .notEmpty()
    .withMessage('Department is required'),
  body('designation')
    .trim()
    .notEmpty()
    .withMessage('Designation is required'),
  body('joiningDate')
    .notEmpty()
    .withMessage('Joining date is required')
    .isISO8601()
    .withMessage('Joining date must be a valid ISO8601 date (e.g. YYYY-MM-DD)'),
  body('workType')
    .notEmpty()
    .withMessage('Work type is required')
    .isIn(['office', 'remote', 'hybrid'])
    .withMessage('Work type must be one of: office, remote, hybrid'),
  body('role')
    .optional()
    .isIn(['employee'])
    .withMessage('Employee records can only be created with the employee role; use the Super Admin invitation flow for administrators.'),
  body('wfhEligible')
    .optional()
    .isBoolean()
    .withMessage('wfhEligible must be a boolean value'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('shift')
    .optional()
    .isMongoId()
    .withMessage('Invalid Shift ID format')
];

/**
 * Validation rules for updating employee details (all fields optional)
 */
const updateEmployeeRules = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  body('department')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Department cannot be empty'),
  body('designation')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Designation cannot be empty'),
  body('joiningDate')
    .optional()
    .isISO8601()
    .withMessage('Joining date must be a valid ISO8601 date (e.g. YYYY-MM-DD)'),
  body('workType')
    .optional()
    .isIn(['office', 'remote', 'hybrid'])
    .withMessage('Work type must be one of: office, remote, hybrid'),
  body('role')
    .optional()
    .isIn(['employee'])
    .withMessage('Employee records can only use the employee role; administrator access must be granted through Super Admin invitations.'),
  body('wfhEligible')
    .optional()
    .isBoolean()
    .withMessage('wfhEligible must be a boolean value'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('shift')
    .optional()
    .isMongoId()
    .withMessage('Invalid Shift ID format')
];

/**
 * Validation rules for activating or deactivating an employee
 */
const updateStatusRules = [
  body('isActive')
    .notEmpty()
    .withMessage('isActive is required')
    .isBoolean()
    .withMessage('isActive must be a boolean value')
];

module.exports = {
  createEmployeeRules,
  updateEmployeeRules,
  updateStatusRules
};
