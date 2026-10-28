const auditService = require('../services/auditService');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const { sendPaginated } = require('../utils/apiResponse');

/**
 * Get paginated audit logs with search and filter parameters (HR Admin only)
 * GET /audit-logs
 */
exports.getAll = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    action,
    targetType,
    actorId,
    employeeId,
    startDate,
    endDate
  } = req.query;

  let resolvedActorId = actorId;

  // If employeeId is supplied, lookup user to get their actor ObjectId
  if (!resolvedActorId && employeeId) {
    const user = await User.findOne({
      employeeId: new RegExp(`^${employeeId.trim()}$`, 'i')
    }).select('_id');
    if (user) {
      resolvedActorId = user._id;
    }
  }

  const result = await auditService.getAll({
    page,
    limit,
    action,
    targetType,
    actorId: resolvedActorId,
    startDate,
    endDate
  });

  return res.status(200).json({
    success: true,
    message: 'Audit logs retrieved successfully',
    data: { logs: result.logs },
    pagination: result.pagination
  });
});
