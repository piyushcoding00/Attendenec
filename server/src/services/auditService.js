const AuditLog = require('../models/AuditLog');

/**
 * List of sensitive key names or patterns to remove from audit metadata
 */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'otp',
  'otphash',
  'candidatepassword',
  'newpassword',
  'secret',
  'authorization',
  'cookie',
  'rawtoken',
  'tokenhash'
];

/**
 * Deep sanitize metadata object to strip out sensitive information
 * @param {*} data
 * @returns {*}
 */
const sanitizeMetadata = (data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeMetadata(item));
  }

  const clean = {};
  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive));

    if (isSensitive) {
      clean[key] = '[REDACTED]';
    } else if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
      clean[key] = sanitizeMetadata(val);
    } else {
      clean[key] = val;
    }
  }

  return clean;
};

/**
 * Extract IP address from request object
 * @param {Object} req
 * @returns {string|null}
 */
const getClientIp = (req) => {
  if (!req) return null;
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || null;
};

/**
 * Log an action to the AuditLog collection
 * Never throws an error — catches and logs to console.
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} [params.actor] - User ObjectId
 * @param {string} [params.actorEmployeeId] - Actor employeeId
 * @param {string} params.action - Audit action enum
 * @param {string} [params.targetType] - Target entity name (e.g. 'User', 'AttendanceRecord')
 * @param {string|mongoose.Types.ObjectId} [params.targetId] - Target entity ObjectId
 * @param {string} [params.targetEmployeeId] - Target employeeId
 * @param {Object} [params.metadata={}] - Arbitrary context metadata
 * @param {Object} [params.req] - Express request object for IP and User-Agent extraction
 * @returns {Promise<Document|null>}
 */
const log = async ({
  actor = null,
  actorEmployeeId = null,
  action,
  targetType = null,
  targetId = null,
  targetEmployeeId = null,
  metadata = {},
  req = null
}) => {
  try {
    let resolvedActor = actor;
    let resolvedActorEmployeeId = actorEmployeeId;

    if (req && req.user) {
      if (!resolvedActor) resolvedActor = req.user._id || req.user.id;
      if (!resolvedActorEmployeeId) resolvedActorEmployeeId = req.user.employeeId;
    }

    const ipAddress = getClientIp(req);
    const userAgent = req && req.headers ? req.headers['user-agent'] : null;
    const safeMetadata = sanitizeMetadata(metadata);

    const auditEntry = await AuditLog.create({
      actor: resolvedActor,
      actorEmployeeId: resolvedActorEmployeeId,
      action,
      targetType,
      targetId,
      targetEmployeeId,
      metadata: safeMetadata,
      ipAddress,
      userAgent
    });

    return auditEntry;
  } catch (error) {
    // Audit logging failure should never crash the main application flow
    console.error('[AuditService Error] Failed to record audit log:', error.message);
    return null;
  }
};

/**
 * Get paginated audit logs with optional filters
 * @param {Object} options
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @param {string} [options.action]
 * @param {string} [options.targetType]
 * @param {string} [options.actorId]
 * @param {string|Date} [options.startDate]
 * @param {string|Date} [options.endDate]
 * @returns {Promise<{ logs: Array, pagination: Object }>}
 */
const getAll = async ({
  page = 1,
  limit = 20,
  action,
  targetType,
  actorId,
  startDate,
  endDate
} = {}) => {
  const query = {};

  if (action) {
    query.action = action;
  }

  if (targetType) {
    query.targetType = targetType;
  }

  if (actorId) {
    query.actor = actorId;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [total, logs] = await Promise.all([
    AuditLog.countDocuments(query),
    AuditLog.find(query)
      .populate('actor', 'name employeeId department role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean()
  ]);

  const totalPages = Math.ceil(total / parsedLimit) || 1;

  return {
    logs,
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

module.exports = {
  log,
  getAll
};
