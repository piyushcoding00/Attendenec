const { validationResult } = require('express-validator');

/**
 * Middleware to evaluate express-validator validation chains
 * Returns 422 Unprocessable Entity with formatted errors if validation fails
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }

  next();
};

module.exports = {
  validate
};
