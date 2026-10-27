const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/employee.controller');
const { protect } = require('../middleware/authenticate');
const { isHRAdmin } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const {
  createEmployeeRules,
  updateEmployeeRules,
  updateStatusRules
} = require('../validators/employee.validators');

// HR Admin: Get all employees with pagination & filters
router.get('/', protect, isHRAdmin, ctrl.getAll);

// HR Admin: Get departments from real employee records
router.get('/departments', protect, isHRAdmin, ctrl.getDepartments);

// HR Admin: Create a new employee
router.post('/', protect, isHRAdmin, createEmployeeRules, validate, ctrl.create);

// HR Admin: Get single employee by ID
router.get('/:id', protect, isHRAdmin, ctrl.getById);

// HR Admin: Update employee details
router.patch('/:id', protect, isHRAdmin, updateEmployeeRules, validate, ctrl.update);
router.put('/:id', protect, isHRAdmin, updateEmployeeRules, validate, ctrl.update);

// HR Admin: Activate / Deactivate employee account
router.patch('/:id/status', protect, isHRAdmin, updateStatusRules, validate, ctrl.updateStatus);

module.exports = router;
