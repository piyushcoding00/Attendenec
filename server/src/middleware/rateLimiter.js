const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for login endpoints: generous limits so testing and production use aren't blocked
 */
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 attempts per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait a few seconds and try again.'
  }
});

/**
 * Rate limiter for OTP requests: generous limits so users can request OTP without getting blocked
 */
const otpLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 OTP requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests. Please wait a moment and try again.'
  }
});

/**
 * Rate limiter for QR code scanning: 10 attempts per 1 minute per IP
 */
const qrScanLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many QR scan attempts. Please slow down.'
  }
});

const qrTokenIssueLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many kiosk token refreshes. Wait a minute before trying again.'
  }
});

/**
 * General rate limiter for general API requests: 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});

module.exports = {
  loginLimiter,
  otpLimiter,
  qrScanLimiter,
  qrTokenIssueLimiter,
  generalLimiter
};
