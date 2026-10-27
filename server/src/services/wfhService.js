const WFHRequest = require('../models/WFHRequest');
const AttendanceRecord = require('../models/AttendanceRecord');
const AttendancePolicy = require('../models/AttendancePolicy');
const User = require('../models/User');
const AppError = require('../utils/AppError');

/**
 * Check if an employee is eligible for WFH on a specific date.
 * Returns { eligible, reason, policy }
 *
 * @param {Object} employee - The employee document or object
 * @param {string|Date} requestedDate - The date requested for WFH
 * @returns {Promise<{ eligible: boolean, reason: string|null, policy: Object }>}
 */
exports.checkEligibility = async (employee, requestedDate) => {
  // Fetch current active policy
  let policy = await AttendancePolicy.getCurrent();
  if (!policy) {
    // Fallback default policy if none active in database yet
    policy = {
      wfhEnabled: true,
      wfhMaxDaysPerMonth: 8,
      wfhRequiresApproval: true,
      wfhAdvanceNoticeDays: 1,
      wfhEligibleWorkTypes: ['remote', 'hybrid']
    };
  }

  // 1. Check policy.wfhEnabled
  if (!policy.wfhEnabled) {
    return {
      eligible: false,
      reason: 'Work-from-home is currently disabled by company policy',
      policy
    };
  }

  // Ensure full employee profile is loaded if only a partial object was passed
  let emp = employee;
  if (!emp.workType || emp.wfhEligible === undefined) {
    const loadedEmp = await User.findById(employee._id || employee.id);
    if (loadedEmp) emp = loadedEmp;
  }

  // 2. Check employee.wfhEligible
  if (!emp.wfhEligible) {
    return {
      eligible: false,
      reason: 'Your account is not marked as eligible for work-from-home',
      policy
    };
  }

  // 3. Check employee.workType is in policy.wfhEligibleWorkTypes
  const eligibleTypes = policy.wfhEligibleWorkTypes || ['remote', 'hybrid'];
  if (!eligibleTypes.includes(emp.workType)) {
    return {
      eligible: false,
      reason: `Work type '${emp.workType}' is not eligible for WFH under current policy (${eligibleTypes.join(', ')})`,
      policy
    };
  }

  // 4. Check requestedDate is a future working day (not weekend)
  const reqDate = new Date(requestedDate);
  if (isNaN(reqDate.getTime())) {
    return {
      eligible: false,
      reason: 'Invalid requested date format. Please provide a valid date.',
      policy
    };
  }

  // Normalize requestedDate to start-of-day UTC
  const reqUTC = new Date(
    Date.UTC(reqDate.getUTCFullYear(), reqDate.getUTCMonth(), reqDate.getUTCDate(), 0, 0, 0, 0)
  );

  const now = new Date();
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );

  if (reqUTC.getTime() <= todayUTC.getTime()) {
    return {
      eligible: false,
      reason: 'WFH can only be requested for future dates',
      policy
    };
  }

  // Check if weekend (0 = Sunday, 6 = Saturday)
  const dayOfWeek = reqUTC.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      eligible: false,
      reason: 'WFH cannot be requested on weekends (Saturday/Sunday)',
      policy
    };
  }

  // 5. Check advance notice: requestedDate must be at least policy.wfhAdvanceNoticeDays ahead
  const advanceNoticeDays = policy.wfhAdvanceNoticeDays !== undefined ? policy.wfhAdvanceNoticeDays : 1;
  const daysDifference = Math.floor((reqUTC.getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDifference < advanceNoticeDays) {
    return {
      eligible: false,
      reason: `WFH requests require at least ${advanceNoticeDays} day(s) advance notice. You provided ${daysDifference} day(s).`,
      policy
    };
  }

  // 6. Count WFH requests this month (approved + pending) vs policy.wfhMaxDaysPerMonth
  const startOfMonth = new Date(Date.UTC(reqUTC.getUTCFullYear(), reqUTC.getUTCMonth(), 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(reqUTC.getUTCFullYear(), reqUTC.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  const employeeId = emp._id || emp.id;
  const monthRequestCount = await WFHRequest.countDocuments({
    employee: employeeId,
    requestedDate: { $gte: startOfMonth, $lte: endOfMonth },
    status: { $in: ['approved', 'pending'] }
  });

  const maxDaysPerMonth = policy.wfhMaxDaysPerMonth !== undefined ? policy.wfhMaxDaysPerMonth : 8;
  if (monthRequestCount >= maxDaysPerMonth) {
    return {
      eligible: false,
      reason: `Monthly limit of ${maxDaysPerMonth} WFH day(s) reached. You currently have ${monthRequestCount} active/approved request(s) this month.`,
      policy
    };
  }

  // 7. Check for duplicate request on same date
  const duplicate = await WFHRequest.findOne({
    employee: employeeId,
    requestedDate: reqUTC,
    status: { $in: ['pending', 'approved'] }
  });

  if (duplicate) {
    return {
      eligible: false,
      reason: `A WFH request for this date already exists with status: ${duplicate.status}`,
      policy
    };
  }

  // 8. Check for existing attendance record on that date (conflict)
  const existingAttendance = await AttendanceRecord.findOne({
    employee: employeeId,
    date: reqUTC
  });

  if (existingAttendance && ['present', 'late', 'wfh'].includes(existingAttendance.status)) {
    return {
      eligible: false,
      reason: `An attendance record already exists for this date with status: ${existingAttendance.status}`,
      policy
    };
  }

  return {
    eligible: true,
    reason: null,
    policy
  };
};

/**
 * Submit a WFH request.
 *
 * @param {Object} employee - Authenticated user
 * @param {Object} payload - { requestedDate, reason }
 * @returns {Promise<Document>}
 */
exports.submitRequest = async (employee, { requestedDate, reason }) => {
  // 1. Call checkEligibility - throw AppError if not eligible
  const eligibility = await exports.checkEligibility(employee, requestedDate);
  if (!eligibility.eligible) {
    throw new AppError(eligibility.reason || 'You are not eligible for WFH on this date', 400);
  }

  // 2. Parse requestedDate to start-of-day UTC
  const reqDate = new Date(requestedDate);
  const targetDateUTC = new Date(
    Date.UTC(reqDate.getUTCFullYear(), reqDate.getUTCMonth(), reqDate.getUTCDate(), 0, 0, 0, 0)
  );

  // 3. Create WFHRequest with status: 'pending'
  const newRequest = await WFHRequest.create({
    employee: employee._id || employee.id,
    requestedDate: targetDateUTC,
    reason: reason.trim(),
    status: 'pending'
  });

  // 4. Return the created request populated with employee details
  return await newRequest.populate('employee', 'name employeeId department designation workType');
};

/**
 * Get WFH requests for a specific employee.
 *
 * @param {string|mongoose.Types.ObjectId} employeeId
 * @param {Object} params - { page, limit, status, startDate, endDate }
 * @returns {Promise<{ requests: Array, pagination: Object }>}
 */
exports.getMyRequests = async (employeeId, params = {}) => {
  const { page = 1, limit = 20, status, startDate, endDate } = params;

  const query = { employee: employeeId };

  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.requestedDate = {};
    if (startDate) query.requestedDate.$gte = new Date(startDate);
    if (endDate) query.requestedDate.$lte = new Date(endDate);
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [total, requests] = await Promise.all([
    WFHRequest.countDocuments(query),
    WFHRequest.find(query)
      .populate('reviewer', 'name employeeId department')
      .populate('attendanceRecord', 'status checkIn checkOut workingMinutes')
      .sort({ requestedDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean()
  ]);

  const totalPages = Math.ceil(total / parsedLimit) || 1;

  return {
    requests,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages,
      hasNext: parsedPage < totalPages,
      hasPrev: parsedPage > 1
    }
  };
};

/**
 * Get all WFH requests (admin).
 *
 * @param {Object} params - { status, startDate, endDate, page, limit, department }
 * @returns {Promise<{ requests: Array, pagination: Object }>}
 */
exports.getAllRequests = async ({
  status,
  startDate,
  endDate,
  page = 1,
  limit = 20,
  department
} = {}) => {
  const query = {};

  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.requestedDate = {};
    if (startDate) query.requestedDate.$gte = new Date(startDate);
    if (endDate) query.requestedDate.$lte = new Date(endDate);
  }

  const employeeQuery = { isDemoAccount: { $ne: true } };
  if (department) {
    employeeQuery.department = new RegExp(`^${department}$`, 'i');
  }
  query.employee = {
    $in: await User.find(employeeQuery).distinct('_id')
  };

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [total, requests] = await Promise.all([
    WFHRequest.countDocuments(query),
    WFHRequest.find(query)
      .populate('employee', 'name employeeId department designation workType')
      .populate('reviewer', 'name employeeId department')
      .populate('attendanceRecord', 'status checkIn checkOut workingMinutes')
      .sort({ requestedDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean()
  ]);

  const totalPages = Math.ceil(total / parsedLimit) || 1;

  return {
    requests,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages,
      hasNext: parsedPage < totalPages,
      hasPrev: parsedPage > 1
    }
  };
};

/**
 * Make an approval decision (admin).
 *
 * @param {string|mongoose.Types.ObjectId} requestId
 * @param {Object} decision - { status, reviewComment }
 * @param {Object} reviewer - The HR admin user making the decision
 * @returns {Promise<Document>}
 */
exports.makeDecision = async (requestId, { status, reviewComment }, reviewer) => {
  // 1. Find request, ensure it's still pending
  const request = await WFHRequest.findById(requestId);
  if (!request) {
    throw new AppError('WFH request not found', 404);
  }

  if (request.status !== 'pending') {
    throw new AppError(`Cannot review this request: it has already been ${request.status}`, 400);
  }

  // 2. Ensure reviewer is not the same as the requester
  const reviewerId = reviewer._id ? reviewer._id.toString() : reviewer.id;
  if (request.employee.toString() === reviewerId) {
    throw new AppError('Reviewer cannot approve or reject their own WFH request', 403);
  }

  // 3. Update: status, reviewer, reviewedAt, reviewComment
  request.status = status;
  request.reviewer = reviewer._id || reviewer.id;
  request.reviewedAt = new Date();
  if (reviewComment) {
    request.reviewComment = reviewComment.trim();
  }

  // 4. If approved: create/update AttendanceRecord for that date with status='wfh', method='wfh'
  if (status === 'approved') {
    let record = await AttendanceRecord.findOne({
      employee: request.employee,
      date: request.requestedDate
    });

    if (record) {
      record.status = 'wfh';
      record.method = 'wfh';
      record.linkedWFHRequest = request._id;
      await record.save();
    } else {
      record = await AttendanceRecord.create({
        employee: request.employee,
        date: request.requestedDate,
        status: 'wfh',
        method: 'wfh',
        linkedWFHRequest: request._id
      });
    }

    request.attendanceRecord = record._id;
  }

  // 5. Save and return updated request
  await request.save();

  return await WFHRequest.findById(request._id)
    .populate('employee', 'name employeeId department designation workType')
    .populate('reviewer', 'name employeeId department')
    .populate('attendanceRecord');
};
