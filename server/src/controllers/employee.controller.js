const User = require('../models/User');
const auditService = require('../services/auditService');
const generateEmployeeId = require('../services/employeeIdService');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess, sendPaginated } = require('../utils/apiResponse');

/**
 * Get all employees with pagination, search, and filters (HR Admin only)
 * GET /employees
 */
exports.getAll = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    department,
    workType,
    isActive,
    role
  } = req.query;

  const query = {
    role: role || 'employee',
    isDemoAccount: { $ne: true }
  };

  if (search) {
    const trimmed = search.trim();
    query.$or = [
      { name: new RegExp(trimmed, 'i') },
      { employeeId: new RegExp(trimmed, 'i') },
      { email: new RegExp(trimmed, 'i') }
    ];
  }

  if (department) {
    query.department = new RegExp(`^${department.trim()}$`, 'i');
  }

  if (workType) {
    query.workType = workType;
  }

  if (isActive !== undefined && isActive !== '') {
    query.isActive = isActive === 'true' || isActive === true;
  }

  if (role) {
    query.role = role;
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [total, employees] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .populate('shift')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean()
  ]);

  const totalPages = Math.ceil(total / parsedLimit) || 1;

  return sendPaginated(
    res,
    employees,
    {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages,
      hasNext: parsedPage < totalPages,
      hasPrev: parsedPage > 1
    },
    'Employees retrieved successfully'
  );
});

/**
 * Get departments used by real employee records (HR Admin only)
 * GET /employees/departments
 */
exports.getDepartments = catchAsync(async (req, res) => {
  const departments = await User.distinct('department', {
    role: 'employee',
    isDemoAccount: { $ne: true },
    department: { $nin: [null, ''] }
  });

  return sendSuccess(
    res,
    departments.sort((a, b) => a.localeCompare(b)),
    'Employee departments retrieved successfully'
  );
});

/**
 * Create a new employee record (HR Admin only)
 * Password cannot be set here; employee must complete first-time activation
 * POST /employees
 */
exports.create = catchAsync(async (req, res) => {
  const {
    name,
    email,
    department,
    designation,
    joiningDate,
    workType = 'office',
    role = 'employee',
    wfhEligible = false,
    shift
  } = req.body;

  const employeeId = await generateEmployeeId();

  // Create new user without password (isAccountActivated remains false)
  const newEmployee = await User.create({
    employeeId,
    name: name.trim(),
    email: email ? email.trim().toLowerCase() : undefined,
    department: department.trim(),
    designation: designation.trim(),
    joiningDate: new Date(joiningDate),
    workType,
    role,
    wfhEligible: Boolean(wfhEligible),
    shift: shift || undefined,
    isActive: true,
    isAccountActivated: false,
    isDemoAccount: false
  });

  await newEmployee.populate('shift');

  // Log audit USER_CREATED
  await auditService.log({
    actor: req.user._id,
    actorEmployeeId: req.user.employeeId,
    action: 'USER_CREATED',
    targetType: 'User',
    targetId: newEmployee._id,
    targetEmployeeId: newEmployee.employeeId,
    metadata: {
      name: newEmployee.name,
      department: newEmployee.department,
      designation: newEmployee.designation,
      role: newEmployee.role,
      workType: newEmployee.workType,
      wfhEligible: newEmployee.wfhEligible
    },
    req
  });

  return sendSuccess(
    res,
    newEmployee,
    'Employee record created successfully. Activation pending.',
    201
  );
});

/**
 * Get employee by ID (HR Admin only)
 * GET /employees/:id
 */
exports.getById = catchAsync(async (req, res) => {
  const employee = await User.findById(req.params.id).populate('shift');

  if (!employee) {
    throw new AppError('Employee not found', 404);
  }

  return sendSuccess(res, employee, 'Employee details retrieved successfully');
});

/**
 * Update employee record (HR Admin only)
 * Prevent updating sensitive fields like password, role, employeeId
 * PATCH /employees/:id
 */
exports.update = catchAsync(async (req, res) => {
  const employee = await User.findById(req.params.id);

  if (!employee) {
    throw new AppError('Employee not found', 404);
  }

  // Allowed fields whitelist
  const allowedFields = [
    'name',
    'email',
    'department',
    'designation',
    'workType',
    'shift',
    'wfhEligible',
    'joiningDate'
  ];

  const updates = {};
  const previousValues = {};

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      previousValues[field] = employee[field];
      employee[field] = req.body[field];
      updates[field] = req.body[field];
    }
  });

  await employee.save();
  await employee.populate('shift');

  // Log audit USER_UPDATED
  await auditService.log({
    actor: req.user._id,
    actorEmployeeId: req.user.employeeId,
    action: 'USER_UPDATED',
    targetType: 'User',
    targetId: employee._id,
    targetEmployeeId: employee.employeeId,
    metadata: {
      updates,
      previousValues
    },
    req
  });

  return sendSuccess(res, employee, 'Employee updated successfully');
});

/**
 * Activate or deactivate an employee account (HR Admin only)
 * PATCH /employees/:id/status
 */
exports.updateStatus = catchAsync(async (req, res) => {
  const { isActive } = req.body;
  const employee = await User.findById(req.params.id);

  if (!employee) {
    throw new AppError('Employee not found', 404);
  }

  // Prevent admin from deactivating their own account
  const targetId = employee._id.toString();
  const actorId = (req.user._id || req.user.id).toString();
  if (targetId === actorId && isActive === false) {
    throw new AppError('You cannot deactivate your own account', 400);
  }

  employee.isActive = Boolean(isActive);
  await employee.save();
  await employee.populate('shift');

  const action = employee.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED';

  // Log audit
  await auditService.log({
    actor: req.user._id,
    actorEmployeeId: req.user.employeeId,
    action,
    targetType: 'User',
    targetId: employee._id,
    targetEmployeeId: employee.employeeId,
    metadata: {
      isActive: employee.isActive
    },
    req
  });

  return sendSuccess(
    res,
    employee,
    `Employee account ${employee.isActive ? 'activated' : 'deactivated'} successfully`
  );
});
