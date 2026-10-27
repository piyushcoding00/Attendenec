const express = require('express');
const { protect } = require('../middleware/authenticate');
const { restrictTo } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/adminInvites.controller');
const { inviteAdminRules } = require('../validators/adminInvite.validators');

const router = express.Router();

router.use(protect, restrictTo('super_admin'));
router.get('/', controller.getAll);
router.post('/', inviteAdminRules, validate, controller.invite);

module.exports = router;
