const User = require('../models/User');
const generateEmployeeId = require('../services/employeeIdService');
const { sendAdminInviteEmail } = require('../services/emailService');
const auditService = require('../services/auditService');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/apiResponse');

exports.getAll = catchAsync(async (req, res) => {
  const admins = await User.find({ role: 'hr_admin' })
    .select('name email employeeId department designation isActive createdAt')
    .sort({ createdAt: -1 })
    .lean();
  return sendSuccess(res, admins, 'Administrator accounts retrieved.');
});

exports.invite = catchAsync(async (req, res) => {
  const { name, email, department, designation, password } = req.body;
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail }).select('_id');
  if (existingUser) {
    throw new AppError('An account already uses this email address.', 409);
  }

  const user = await User.create({
    employeeId: await generateEmployeeId(),
    name: name.trim(),
    email: normalizedEmail,
    department: department.trim(),
    designation: designation.trim(),
    password,
    role: 'hr_admin',
    isActive: true,
    isAccountActivated: true,
    isDemoAccount: false,
    workType: 'office',
    wfhEligible: false
  });

  const emailSent = await sendAdminInviteEmail({
    toEmail: normalizedEmail,
    name: user.name,
    inviterName: req.user.name
  });

  await auditService.log({
    actor: req.user._id,
    actorEmployeeId: req.user.employeeId,
    action: 'USER_CREATED',
    targetType: 'User',
    targetId: user._id,
    targetEmployeeId: user.employeeId,
    metadata: { role: 'hr_admin', email: normalizedEmail },
    req
  });

  return sendSuccess(res, {
    ...user.toJSON(),
    emailSent
  }, emailSent
    ? 'Administrator account created and invitation email sent.'
    : 'Administrator account created. Email could not be sent.', 201);
});
