const wfhService = require('../services/wfhService');
const auditService = require('../services/auditService');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess, sendPaginated } = require('../utils/apiResponse');

/**
 * Check WFH eligibility for the authenticated user for a specified date
 * GET /wfh/eligibility?date=YYYY-MM-DD
 */
exports.getEligibility = catchAsync(async (req, res) => {
  // Get date from query or default to tomorrow
  let date = req.query.date;
  if (!date) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    date = tomorrow.toISOString().split('T')[0];
  }

  const eligibility = await wfhService.checkEligibility(req.user, date);

  return sendSuccess(
    res,
    eligibility,
    eligibility.eligible
      ? 'Employee is eligible for WFH on this date'
      : `Employee is not eligible: ${eligibility.reason}`
  );
});

/**
 * Submit a new WFH request
 * POST /wfh/requests
 */
exports.submitRequest = catchAsync(async (req, res) => {
  const { requestedDate, reason } = req.body;

  const request = await wfhService.submitRequest(req.user, {
    requestedDate,
    reason
  });

  // Log audit WFH_REQUESTED
  await auditService.log({
    actor: req.user._id,
    actorEmployeeId: req.user.employeeId,
    action: 'WFH_REQUESTED',
    targetType: 'WFHRequest',
    targetId: request._id,
    targetEmployeeId: req.user.employeeId,
    metadata: {
      requestedDate: request.requestedDate,
      reason: request.reason
    },
    req
  });

  return res.status(201).json({
    success: true,
    message: 'WFH request submitted successfully',
    data: { request }
  });
});

/**
 * Get WFH requests for the authenticated user
 * GET /wfh/requests/me
 */
exports.getMyRequests = catchAsync(async (req, res) => {
  const result = await wfhService.getMyRequests(req.user._id, req.query);

  return res.status(200).json({
    success: true,
    message: 'Your WFH requests retrieved successfully',
    data: { requests: result.requests },
    pagination: result.pagination
  });
});

/**
 * Get all WFH requests across employees (admin only)
 * GET /wfh/requests
 */
exports.getAllRequests = catchAsync(async (req, res) => {
  const result = await wfhService.getAllRequests(req.query);

  return res.status(200).json({
    success: true,
    message: 'All WFH requests retrieved successfully',
    data: { requests: result.requests },
    pagination: result.pagination
  });
});

/**
 * Approve or reject a WFH request (admin only)
 * PATCH /wfh/requests/:id/decision
 */
exports.makeDecision = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, reviewComment } = req.body;

  const updatedRequest = await wfhService.makeDecision(
    id,
    { status, reviewComment },
    req.user
  );

  // Log audit WFH_APPROVED or WFH_REJECTED
  const auditAction = status === 'approved' ? 'WFH_APPROVED' : 'WFH_REJECTED';
  await auditService.log({
    actor: req.user._id,
    actorEmployeeId: req.user.employeeId,
    action: auditAction,
    targetType: 'WFHRequest',
    targetId: updatedRequest._id,
    targetEmployeeId: updatedRequest.employee ? updatedRequest.employee.employeeId : null,
    metadata: {
      status,
      reviewComment,
      requestedDate: updatedRequest.requestedDate
    },
    req
  });

  return res.status(200).json({
    success: true,
    message: `WFH request ${status} successfully`,
    data: { request: updatedRequest }
  });
});
