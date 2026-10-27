const User = require('../models/User');
const EmployeeIdCounter = require('../models/EmployeeIdCounter');
const AppError = require('../utils/AppError');

const EMPLOYEE_ID_PREFIX = 'VORLDX';

module.exports = async () => {
  const latestEmployee = await User.findOne({
    employeeId: new RegExp(`^${EMPLOYEE_ID_PREFIX}\\d{4}$`)
  })
    .sort({ employeeId: -1 })
    .select('employeeId')
    .lean();
  const latestSequence = latestEmployee
    ? Number(latestEmployee.employeeId.slice(EMPLOYEE_ID_PREFIX.length))
    : 0;

  await EmployeeIdCounter.updateOne(
    { _id: 'employee' },
    { $max: { sequence: latestSequence } },
    { upsert: true }
  );

  const counter = await EmployeeIdCounter.findOneAndUpdate(
    { _id: 'employee' },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true }
  );

  if (counter.sequence > 9999) {
    throw new AppError('Employee ID sequence is full (VORLDX0001–VORLDX9999)', 409);
  }

  return `${EMPLOYEE_ID_PREFIX}${String(counter.sequence).padStart(4, '0')}`;
};
