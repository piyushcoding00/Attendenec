/**
 * Custom AppError class for operational and predictable errors
 * Sets statusCode, status ('fail' for 4xx, 'error' for 5xx), and isOperational flag
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);

    this.statusCode = statusCode || 500;
    this.status = `${this.statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
