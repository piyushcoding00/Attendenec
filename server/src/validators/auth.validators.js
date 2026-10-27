const { body } = require('express-validator');

/**
 * Validation rules for initiating verification challenge
 */
const startVerificationRules = [
  body('employeeId')
    .optional()
    .trim()
    .toUpperCase(),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address'),
];

/**
 * Validation rules for checking demo OTP
 */
const verifyOTPRules = [
  body('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID is required')
    .toUpperCase(),
  body('otp')
    .trim()
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers')
];

/**
 * Validation rules for setting password and activating account
 */
const activateAccountRules = [
  body('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID is required')
    .toUpperCase(),
  body('otp')
    .trim()
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

/**
 * Validation rules for employee and admin login
 */
const loginRules = [
  body('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID or email is required')
    .customSanitizer((value) => value.includes('@') ? value.toLowerCase() : value.toUpperCase()),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

module.exports = {
  startVerificationRules,
  verifyOTPRules,
  activateAccountRules,
  loginRules
};
