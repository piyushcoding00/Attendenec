const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Sign JWT token with userId and role payload
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string} role
 * @returns {string}
 */
const signToken = (userId, role) => {
  return jwt.sign(
    {
      userId: userId.toString(),
      role
    },
    config.JWT_SECRET,
    {
      expiresIn: config.JWT_EXPIRES_IN
    }
  );
};

/**
 * Verify JWT token and return decoded payload
 * @param {string} token
 * @returns {Object}
 * @throws {jwt.JsonWebTokenError|jwt.TokenExpiredError}
 */
const verifyToken = (token) => {
  return jwt.verify(token, config.JWT_SECRET);
};

/**
 * Sign JWT, set httpOnly cookie, and send standard JSON response
 * @param {Object} res - Express response
 * @param {Object} user - User document or object
 * @param {number} [statusCode=200] - HTTP status code
 * @param {string} [message='Success'] - Response message
 * @returns {Object}
 */
const sendTokenResponse = (res, user, statusCode = 200, message = 'Success') => {
  const token = signToken(user._id || user.id, user.role);

  const cookieExpiresMs = (config.JWT_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000;
  const cookieOptions = {
    expires: new Date(Date.now() + cookieExpiresMs),
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax'
  };

  res.cookie('token', token, cookieOptions);

  // Ensure password is not exposed
  let safeUser = user;
  if (typeof user.toJSON === 'function') {
    safeUser = user.toJSON();
  } else if (typeof user.toObject === 'function') {
    safeUser = user.toObject();
    delete safeUser.password;
  } else {
    safeUser = { ...user };
    delete safeUser.password;
  }

  return res.status(statusCode).json({
    success: true,
    message,
    token,
    data: {
      user: safeUser
    }
  });
};

module.exports = {
  signToken,
  verifyToken,
  sendTokenResponse
};
