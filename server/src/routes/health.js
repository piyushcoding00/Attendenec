const express = require('express');
const { NODE_ENV } = require('../config/env');

const router = express.Router();

/**
 * @route   GET /api/v1/health
 * @desc    API Health check endpoint
 * @access  Public
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'VorldX Attendance API is running',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: '1.0.0'
  });
});

module.exports = router;
