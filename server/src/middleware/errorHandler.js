const AppError = require('../utils/AppError');
const { isDevelopment } = require('../config/env');

/**
 * Handle Mongoose CastError (e.g. invalid ObjectId)
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

/**
 * Handle Mongoose duplicate key error (code 11000)
 */
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue || {})[0];
  const value = err.keyValue ? err.keyValue[field] : '';
  const message = field
    ? `Duplicate value for field '${field}': "${value}". Please use another value.`
    : 'Duplicate field value entered. Please use a unique value.';
  return new AppError(message, 400);
};

/**
 * Handle Mongoose schema ValidationError
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors || {}).map((el) => el.message);
  const message = `Validation error: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

/**
 * Handle JWT invalid signature error
 */
const handleJWTError = () => {
  return new AppError('Invalid authentication token. Please log in again.', 401);
};

/**
 * Handle JWT expired token error
 */
const handleJWTExpiredError = () => {
  return new AppError('Your session has expired. Please log in again.', 401);
};

/**
 * Send full error details in development mode
 */
const sendErrorDev = (err, req, res) => {
  return res.status(err.statusCode).json({
    success: false,
    status: err.status,
    message: err.message,
    error: err,
    stack: err.stack
  });
};

/**
 * Send sanitized operational errors in production mode
 */
const sendErrorProd = (err, req, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message
    });
  }

  // Programming or unknown error: do not leak database or internal details
  console.error('[UNEXPECTED SERVER ERROR] 💥:', err);
  return res.status(500).json({
    success: false,
    status: 'error',
    message: 'An unexpected internal server error occurred'
  });
};

/**
 * Centralized error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (isDevelopment) {
    sendErrorDev(err, req, res);
  } else {
    let error = Object.create(err);
    error.message = err.message;
    error.name = err.name;
    error.code = err.code;

    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    // If validation error from express-validator was passed to next()
    if (typeof error.array === 'function') {
      const messages = error.array().map((e) => e.msg).join('. ');
      error = new AppError(`Validation error: ${messages}`, 422);
    }

    sendErrorProd(error, req, res);
  }
};

module.exports = errorHandler;
