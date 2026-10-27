const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { JWT_SECRET } = require('../config/env');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

/**
 * Helper to dynamically resolve User model if registered or defined
 * @returns {mongoose.Model|null}
 */
const getUserModel = () => {
  try {
    return require('../models/User');
  } catch (err) {
    if (mongoose.models && mongoose.models.User) {
      return mongoose.model('User');
    }
    return null;
  }
};

/**
 * Extract JWT from Authorization Bearer header or cookie
 * @param {Object} req - Express request
 * @returns {string|null}
 */
const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1];
  }
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  return null;
};

/**
 * Middleware: Protect routes - requires valid JWT authentication
 */
const protect = catchAsync(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return next(new AppError('You are not logged in. Please log in to get access.', 401));
  }

  // Verify token
  const decoded = jwt.verify(token, JWT_SECRET);
  const userId = decoded.userId || decoded.id;

  if (!userId) {
    return next(new AppError('Invalid token payload. Please log in again.', 401));
  }

  // Query User model if available
  const User = getUserModel();
  let currentUser = null;

  if (User) {
    currentUser = await User.findById(userId).select('-password');
    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }
    // Check if user is active if status property exists
    if (currentUser.isActive === false || currentUser.status === 'inactive') {
      return next(new AppError('This user account has been deactivated.', 401));
    }
  } else {
    // Scaffold fallback if User model is not yet compiled
    currentUser = {
      _id: userId,
      id: userId,
      role: decoded.role || 'employee',
      ...decoded
    };
  }

  // Grant access and attach user to request
  req.user = currentUser;
  next();
});

/**
 * Middleware: Optional authentication - attaches user if token is present and valid,
 * but allows request to continue if no token is provided.
 */
const optionalAuth = catchAsync(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId || decoded.id;

    if (userId) {
      const User = getUserModel();
      if (User) {
        const currentUser = await User.findById(userId).select('-password');
        if (currentUser && currentUser.isActive !== false) {
          req.user = currentUser;
        }
      } else {
        req.user = {
          _id: userId,
          id: userId,
          role: decoded.role || 'employee',
          ...decoded
        };
      }
    }
  } catch (err) {
    // If token verification fails, simply continue without setting req.user
  }

  next();
});

module.exports = {
  protect,
  optionalAuth
};
