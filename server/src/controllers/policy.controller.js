const AttendancePolicy = require('../models/AttendancePolicy');
const Shift = require('../models/Shift');
const auditService = require('../services/auditService');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * Get current active attendance policy and available shifts
 * GET /policies
 */
exports.getAll = catchAsync(async (req, res) => {
  let policy = await AttendancePolicy.getCurrent();

  // If no policy exists yet in the system, provision default policy
  if (!policy) {
    const defaultShift = await Shift.findOne({ isDefault: true }) || await Shift.findOne({ isActive: true });
    policy = await AttendancePolicy.create({
      companyTimezone: 'Asia/Kolkata',
      defaultShift: defaultShift ? defaultShift._id : undefined,
      qrTokenExpiresSeconds: 30,
      qrRefreshIntervalSeconds: 30,
      gpsAccuracyThresholdMeters: 20,
      wfhEnabled: true,
      wfhMaxDaysPerMonth: 8,
      wfhRequiresApproval: true,
      wfhAdvanceNoticeDays: 1,
      wfhEligibleWorkTypes: ['remote', 'hybrid'],
      attendanceCutoffHour: 23,
      halfDayDurationMinutes: 240,
      fullDayDurationMinutes: 480,
      isActive: true,
      effectiveDate: new Date()
    });
    policy = await AttendancePolicy.findById(policy._id).populate('defaultShift');
  }

  const shifts = await Shift.find({ isActive: true }).sort({ isDefault: -1, name: 1 });

  return sendSuccess(
    res,
    {
      policy,
      shifts
    },
    'Attendance policies and active shifts retrieved successfully'
  );
});

/**
 * Update attendance policy configuration (HR Admin only)
 * PATCH /policies/:id
 */
exports.update = catchAsync(async (req, res) => {
  let policy;

  if (req.params.id === 'current' || req.params.id === 'active') {
    policy = await AttendancePolicy.getCurrent();
  } else {
    policy = await AttendancePolicy.findById(req.params.id);
  }

  if (!policy) {
    policy = await AttendancePolicy.create({
      isActive: true,
      createdBy: req.user?._id
    });
  }

  const allowedFields = [
    'companyTimezone',
    'qrTokenExpiresSeconds',
    'qrRefreshIntervalSeconds',
    'gpsAccuracyThresholdMeters',
    'wfhEnabled',
    'wfhMaxDaysPerMonth',
    'wfhRequiresApproval',
    'wfhAdvanceNoticeDays',
    'wfhEligibleWorkTypes',
    'halfDayDurationMinutes',
    'fullDayDurationMinutes',
    'attendanceCutoffHour',
    'defaultShift',
    'officeLocation'
  ];

  const previousValues = {};
  const updates = {};

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      previousValues[field] = policy[field];
      if (field === 'officeLocation') {
        const officeLocation = {
          ...req.body.officeLocation,
          latitude: Number(req.body.officeLocation.latitude),
          longitude: Number(req.body.officeLocation.longitude),
          radiusMeters: 50,
          isEnabled: true
        };
        policy[field] = officeLocation;
        updates[field] = officeLocation;
      } else {
        policy[field] = req.body[field];
        updates[field] = req.body[field];
      }
    }
  });

  if (req.user) {
    policy.createdBy = req.user._id || req.user.id;
  }

  await policy.save();
  await policy.populate('defaultShift');
  if (policy.createdBy) {
    await policy.populate('createdBy', 'name employeeId department');
  }

  // Log audit POLICY_UPDATED with diff
  await auditService.log({
    actor: req.user._id,
    actorEmployeeId: req.user.employeeId,
    action: 'POLICY_UPDATED',
    targetType: 'AttendancePolicy',
    targetId: policy._id,
    metadata: {
      updates,
      previousValues
    },
    req
  });

  return sendSuccess(res, policy, 'Attendance policy updated successfully');
});
