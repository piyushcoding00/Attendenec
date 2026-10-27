const express = require('express');
const { protect } = require('../middleware/authenticate');
const { loginLimiter, otpLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const authController = require('../controllers/auth.controller');
const {
  startVerificationRules,
  verifyOTPRules,
  activateAccountRules,
  loginRules
} = require('../validators/auth.validators');

const router = express.Router();

router.post('/start-verification', otpLimiter, startVerificationRules, validate, authController.startVerification);
router.post('/verify/start', otpLimiter, startVerificationRules, validate, authController.startVerification);

router.post('/verify-demo-otp', otpLimiter, verifyOTPRules, validate, authController.verifyDemoOTP);
router.post('/verify/otp', otpLimiter, verifyOTPRules, validate, authController.verifyDemoOTP);

router.post('/activate-account', otpLimiter, activateAccountRules, validate, authController.activateAccount);
router.post('/activate', otpLimiter, activateAccountRules, validate, authController.activateAccount);

router.post('/login', loginLimiter, loginRules, validate, authController.login);
router.post('/login-otp/send', otpLimiter, authController.sendLoginOtp);
router.post('/login-otp/verify', otpLimiter, authController.verifyLoginOtp);
router.post('/logout', protect, authController.logout);
router.get('/me', protect, authController.getMe);

module.exports = router;
