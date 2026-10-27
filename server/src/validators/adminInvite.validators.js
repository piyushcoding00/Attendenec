const { body } = require('express-validator');

const inviteAdminRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Administrator name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('department')
    .trim()
    .notEmpty()
    .withMessage('Department is required'),
  body('designation')
    .trim()
    .notEmpty()
    .withMessage('Designation is required'),
  body('password')
    .isString()
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/)
    .withMessage('Password must be at least 8 characters and include uppercase, lowercase, and a number')
];

module.exports = { inviteAdminRules };
