/**
 * Standard API response helper functions for consistent JSON payloads
 */

/**
 * Send standard successful response
 * @param {Object} res - Express response object
 * @param {*} data - Payload data
 * @param {string} [message='Success'] - Response message
 * @param {number} [statusCode=200] - HTTP status code
 */
exports.sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Send standard error response
 * @param {Object} res - Express response object
 * @param {string} [message='An error occurred'] - Error message
 * @param {number} [statusCode=400] - HTTP status code
 * @param {*|null} [errors=null] - Validation error list or error details
 */
exports.sendError = (res, message = 'An error occurred', statusCode = 400, errors = null) => {
  const payload = {
    success: false,
    message
  };

  if (errors !== null && errors !== undefined) {
    payload.errors = errors;
  }

  return res.status(statusCode).json(payload);
};

/**
 * Send paginated successful response
 * @param {Object} res - Express response object
 * @param {Array} data - List of items for current page
 * @param {Object} pagination - Pagination metadata { page, limit, total, totalPages, hasNext, hasPrev }
 * @param {string} [message='Success'] - Response message
 * @param {number} [statusCode=200] - HTTP status code
 */
exports.sendPaginated = (res, data = [], pagination = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination
  });
};
