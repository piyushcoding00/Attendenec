/**
 * Higher-order function to wrap asynchronous route handlers and middleware
 * Catches rejected promises and passes errors to next()
 *
 * @param {Function} fn - Async express route handler (req, res, next)
 * @returns {Function} Express middleware handler
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = catchAsync;
