const express = require('express');

const router = express.Router();

router.use('/health', require('./health'));
router.use('/auth', require('./auth'));
router.use('/admin-invites', require('./adminInvites'));
router.use('/employees', require('./employees'));
router.use('/attendance', require('./attendance'));
router.use('/qr-displays', require('./qrDisplays'));
router.use('/wfh', require('./wfh'));
router.use('/policies', require('./policies'));
router.use('/dashboard', require('./dashboard'));
router.use('/reports', require('./reports'));
router.use('/audit-logs', require('./auditLogs'));

module.exports = router;
