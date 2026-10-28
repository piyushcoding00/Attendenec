const User = require('../models/User');
const VerificationChallenge = require('../models/VerificationChallenge');
const bcrypt = require('bcryptjs');
const jwtService = require('../services/jwtService');
const auditService = require('../services/auditService');
const { sendOtpEmail } = require('../services/emailService');
const generateEmployeeId = require('../services/employeeIdService');
const config = require('../config/env');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess, sendError } = require('../utils/apiResponse');

/**
 * Initiate first-time account verification challenge
 * POST /api/v1/auth/start-verification
 */
exports.startVerification = catchAsync(async (req, res) => {
  const { employeeId, email, name, department, dob } = req.body;

  if (!email && !employeeId) {
    return sendError(res, 'Email address is required to register', 400);
  }

  let user = null;
  if (email) {
    user = await User.findOne({ email: email.trim().toLowerCase() });
  }
  if (!user && employeeId) {
    user = await User.findOne({ employeeId: employeeId.trim().toUpperCase() });
  }

  if (!user && employeeId) {
    return sendError(res, 'Employee not found', 404);
  }

  // If user does not exist yet: Auto-generate new Employee ID and create profile
  if (!user) {
    if (!name || !department) {
      return sendError(res, 'Name and Department are required for registration', 400);
    }

    // Generate unique sequential / formatted Employee ID like EMP-101
    const count = await User.countDocuments({ role: 'employee' });
    const autoId = `EMP${String(count + 1).padStart(3, '0')}`;

    user = await User.create({
      employeeId: autoId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      department: department.trim(),
      dob: dob ? new Date(dob) : null,
      role: 'employee',
      isActive: true,
      isAccountActivated: false,
    });
  } else {
    // If user already exists and is activated
    if (user.isAccountActivated) {
      return sendError(res, 'Account is already activated. Please sign in directly.', 400);
    }
    // Update details if provided
    if (name) user.name = name.trim();
    if (department) user.department = department.trim();
    if (dob) user.dob = new Date(dob);
    if (email) user.email = email.trim().toLowerCase();
    await user.save();
  }

  if (!user.isActive) {
    return sendError(res, 'This employee account is deactivated. Please contact HR.', 403);
  }

  // Clear any existing active challenges for this employee
  await VerificationChallenge.deleteMany({
    employeeId: user.employeeId,
    isUsed: false
  });

  // Create new 6-digit OTP challenge
  const { otp, challenge } = await VerificationChallenge.createChallenge(user.employeeId, user._id);

  // Send real OTP email via Brevo SMTP / API
  const recipientEmail = email || user.email;
  let emailSent = false;
  if (recipientEmail && !recipientEmail.endsWith('.demo')) {
    emailSent = await sendOtpEmail(recipientEmail, otp, 'Account Activation');
  }

  const responseData = {
    employeeId: user.employeeId,
    name: user.name,
    email: recipientEmail,
    department: user.department,
    designation: user.designation,
    expiresInMinutes: 10,
    expiresAt: challenge.expiresAt,
    emailSent,
  };

  if (config.DEMO_MODE) {
    responseData.demoOTP = otp;
  }

  return sendSuccess(
    res,
    responseData,
    emailSent
      ? `Verification OTP sent to ${recipientEmail}`
      : 'Verification code generated'
  );
});

/**
 * Verify demo OTP without consuming it
 * POST /api/v1/auth/verify-demo-otp
 */
exports.verifyDemoOTP = catchAsync(async (req, res) => {
  const { employeeId, otp } = req.body;

  // Find latest active challenge for employee
  const challenge = await VerificationChallenge.findOne({
    employeeId,
    isUsed: false,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (!challenge) {
    return sendError(res, 'No active verification code found or code has expired. Please request a new code.', 400);
  }

  // Verify OTP without marking as used (markUsed = false) so activateAccount can perform final consumption
  const isValid = await challenge.verifyOTP(otp, false);

  if (!isValid) {
    await auditService.log({
      action: 'FAILED_OTP',
      targetType: 'User',
      targetEmployeeId: employeeId,
      metadata: { reason: 'Incorrect OTP entered or attempts exceeded' },
      req
    });

    const remainingAttempts = Math.max(0, challenge.maxAttempts - challenge.attempts);
    return sendError(
      res,
      remainingAttempts > 0
        ? `Invalid verification code. ${remainingAttempts} attempts remaining.`
        : 'Maximum verification attempts exceeded. Please request a new code.',
      400
    );
  }

  return sendSuccess(
    res,
    {
      employeeId: challenge.employeeId,
      verified: true
    },
    'Verification code confirmed. You may proceed to create your password.'
  );
});

/**
 * Finalize account activation, set permanent password, and consume OTP
 * POST /api/v1/auth/activate-account
 */
exports.activateAccount = catchAsync(async (req, res) => {
  const { employeeId, otp, password } = req.body;

  const user = await User.findOne({ employeeId });
  if (!user) {
    return sendError(res, 'Employee not found', 404);
  }

  if (!user.isActive) {
    return sendError(res, 'This employee account is deactivated. Please contact HR.', 403);
  }

  if (user.isAccountActivated) {
    return sendError(res, 'Account is already activated. Please sign in directly.', 400);
  }

  // Locate active challenge
  const challenge = await VerificationChallenge.findOne({
    employeeId,
    isUsed: false,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (!challenge) {
    return sendError(res, 'Verification session expired. Please request a new verification code.', 400);
  }

  // Final verification and consume challenge (markUsed = true)
  const isValid = await challenge.verifyOTP(otp, true);
  if (!isValid) {
    await auditService.log({
      action: 'FAILED_OTP',
      targetType: 'User',
      targetId: user._id,
      targetEmployeeId: user.employeeId,
      metadata: { reason: 'Failed verification during final activation' },
      req
    });

    return sendError(res, 'Invalid verification code or code already consumed.', 400);
  }

  // Set new password and mark account activated
  user.password = password;
  user.isAccountActivated = true;
  if (req.body.profilePhoto) {
    user.profilePhoto = req.body.profilePhoto;
  }
  await user.save();

  // Audit log account activation
  await auditService.log({
    actor: user._id,
    actorEmployeeId: user.employeeId,
    action: 'ACCOUNT_ACTIVATED',
    targetType: 'User',
    targetId: user._id,
    targetEmployeeId: user.employeeId,
    metadata: { method: 'first_time_activation' },
    req
  });

  return jwtService.sendTokenResponse(res, user, 200, 'Account activated successfully. Welcome to VorldX!');
});

/**
 * Sign in employee or HR admin
 * POST /api/v1/auth/login
 */
exports.login = catchAsync(async (req, res) => {
  const { employeeId, password } = req.body;
  const identifier = employeeId.trim();
  const email = identifier.toLowerCase();

  if (email === config.SUPERADMIN_EMAIL) {
    if (!config.SUPERADMIN_PASSWORD_HASH) {
      return sendError(
        res,
        'Super Admin login is not configured: set SUPERADMIN_PASSWORD_HASH in server/.env to a bcrypt hash, then restart the backend.',
        503
      );
    }

    const isSuperAdminPasswordValid = await bcrypt.compare(password, config.SUPERADMIN_PASSWORD_HASH);
    if (isSuperAdminPasswordValid) {
      let superAdmin = await User.findOne({ email });
      if (superAdmin && !superAdmin.isActive) {
        return sendError(res, 'This Super Admin account has been deactivated.', 403);
      }

      if (!superAdmin) {
        superAdmin = new User({
          employeeId: await generateEmployeeId(),
          name: email.split('@')[0],
          email,
          role: 'super_admin',
          department: 'Administration',
          designation: 'Super Administrator',
          isActive: true,
          isAccountActivated: true,
          isDemoAccount: false,
          workType: 'office',
          wfhEligible: false
        });
      } else {
        superAdmin.role = 'super_admin';
        superAdmin.isAccountActivated = true;
        superAdmin.isDemoAccount = false;
        if (!superAdmin.department) superAdmin.department = 'Administration';
        if (!superAdmin.designation || superAdmin.designation === 'Employee') {
          superAdmin.designation = 'Super Administrator';
        }
      }

      await superAdmin.save();
      await auditService.log({
        actor: superAdmin._id,
        actorEmployeeId: superAdmin.employeeId,
        action: 'LOGIN',
        targetType: 'User',
        targetId: superAdmin._id,
        targetEmployeeId: superAdmin.employeeId,
        metadata: { method: 'configured_superadmin_password' },
        req
      });
      return jwtService.sendTokenResponse(res, superAdmin, 200, 'Super Admin login successful');
    }

    await auditService.log({
      action: 'FAILED_LOGIN',
      targetType: 'User',
      targetEmployeeId: identifier,
      metadata: { reason: 'Incorrect configured Super Admin password' },
      req
    });
    return sendError(res, 'Invalid email or password', 401);
  }

  const userQuery = email.includes('@') ? { email } : { employeeId: identifier.toUpperCase() };
  const user = await User.findOne(userQuery).select('+password');

  if (!user) {
    await auditService.log({
      action: 'FAILED_LOGIN',
      targetType: 'User',
      targetEmployeeId: identifier,
      metadata: { reason: 'Employee ID not found' },
      req
    });
    return sendError(res, 'Invalid Employee ID or password', 401);
  }

  if (!user.isActive) {
    await auditService.log({
      actor: user._id,
      actorEmployeeId: user.employeeId,
      action: 'FAILED_LOGIN',
      targetType: 'User',
      targetId: user._id,
      targetEmployeeId: user.employeeId,
      metadata: { reason: 'Account inactive' },
      req
    });
    return sendError(res, 'Invalid Employee ID or password', 401);
  }

  if (!user.isAccountActivated) {
    return sendError(res, 'Account is not yet activated. Please complete first-time verification.', 400);
  }

  const isPasswordCorrect = await user.correctPassword(password);
  if (!isPasswordCorrect) {
    await auditService.log({
      actor: user._id,
      actorEmployeeId: user.employeeId,
      action: 'FAILED_LOGIN',
      targetType: 'User',
      targetId: user._id,
      targetEmployeeId: user.employeeId,
      metadata: { reason: 'Incorrect password' },
      req
    });
    return sendError(res, 'Invalid Employee ID or password', 401);
  }

  // Log successful login
  await auditService.log({
    actor: user._id,
    actorEmployeeId: user.employeeId,
    action: 'LOGIN',
    targetType: 'User',
    targetId: user._id,
    targetEmployeeId: user.employeeId,
    req
  });

  return jwtService.sendTokenResponse(res, user, 200, 'Login successful');
});

/**
 * Send OTP to registered email for login
 * POST /api/v1/auth/login-otp/send
 */
exports.sendLoginOtp = catchAsync(async (req, res) => {
  const { email, employeeId } = req.body;

  if (!email && !employeeId) {
    return sendError(res, 'Registered email address or Employee ID is required', 400);
  }

  const query = {};
  if (email) query.email = email.trim().toLowerCase();
  else if (employeeId) query.employeeId = employeeId.trim().toUpperCase();

  const user = await User.findOne(query);

  if (!user) {
    return sendError(res, 'No employee account found with this email/ID', 404);
  }

  if (!user.isActive) {
    return sendError(res, 'Account is deactivated. Please contact HR.', 403);
  }

  // Clear previous challenges
  await VerificationChallenge.deleteMany({
    employeeId: user.employeeId,
    isUsed: false,
  });

  // Create new OTP
  const { otp, challenge } = await VerificationChallenge.createChallenge(user.employeeId, user._id);

  // Send email via Brevo
  const recipient = user.email || email;
  let emailSent = false;
  if (recipient && !recipient.endsWith('.demo')) {
    emailSent = await sendOtpEmail(recipient, otp, 'Login Verification');
  }

  const responseData = {
    employeeId: user.employeeId,
    name: user.name,
    email: recipient,
    expiresInMinutes: 10,
    emailSent,
  };

  if (config.DEMO_MODE) {
    responseData.demoOTP = otp;
  }

  return sendSuccess(
    res,
    responseData,
    emailSent ? `Login OTP has been sent to ${recipient}` : 'Login OTP generated'
  );
});

/**
 * Verify Login OTP and sign in
 * POST /api/v1/auth/login-otp/verify
 */
exports.verifyLoginOtp = catchAsync(async (req, res) => {
  const { email, employeeId, otp } = req.body;

  if ((!email && !employeeId) || !otp) {
    return sendError(res, 'Email/Employee ID and 6-digit OTP are required', 400);
  }

  const query = {};
  if (email) query.email = email.trim().toLowerCase();
  else if (employeeId) query.employeeId = employeeId.trim().toUpperCase();

  const user = await User.findOne(query);
  if (!user) {
    return sendError(res, 'Account not found', 404);
  }

  // Find active challenge
  const challenge = await VerificationChallenge.findOne({
    employeeId: user.employeeId,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!challenge) {
    return sendError(res, 'OTP has expired. Please request a new OTP.', 400);
  }

  const isValid = await challenge.verifyOTP(otp, true);
  if (!isValid) {
    return sendError(res, 'Invalid OTP or already used. Please check again.', 400);
  }

  // Mark account as activated if this was their first verification
  if (!user.isAccountActivated) {
    user.isAccountActivated = true;
    await user.save();
  }

  // Audit log
  await auditService.log({
    actor: user._id,
    actorEmployeeId: user.employeeId,
    action: 'LOGIN',
    targetType: 'User',
    targetId: user._id,
    targetEmployeeId: user.employeeId,
    metadata: { method: 'email_otp_login' },
    req,
  });

  return jwtService.sendTokenResponse(res, user, 200, 'Login successful via Email OTP');
});


/**
 * Sign out and clear session cookie
 * POST /api/v1/auth/logout
 */
exports.logout = catchAsync(async (req, res) => {
  if (req.user) {
    await auditService.log({
      actor: req.user._id,
      actorEmployeeId: req.user.employeeId,
      action: 'LOGOUT',
      targetType: 'User',
      targetId: req.user._id,
      targetEmployeeId: req.user.employeeId,
      req
    });
  }

  res.cookie('token', 'loggedout', {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax'
  });

  return sendSuccess(res, null, 'Logged out successfully');
});

/**
 * Get current authenticated user profile
 * GET /api/v1/auth/me
 */
exports.getMe = catchAsync(async (req, res) => {
  return sendSuccess(res, { user: req.user }, 'Current user profile retrieved successfully');
});
