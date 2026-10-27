const AppError = require('../utils/AppError');

/**
 * Restrict endpoint access to users with specified role(s)
 * @param  {...string} roles - Allowed role names (e.g. 'super_admin', 'hr_admin', 'employee')
 * @returns {Function} Express middleware function
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You are not authenticated. Please log in.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action.', 403)
      );
    }

    next();
  };
};

/**
 * Convenience middleware for HR Admin restricted routes
 */
const isHRAdmin = restrictTo('hr_admin', 'super_admin');

module.exports = {
  restrictTo,
  isHRAdmin
};
