const mongoose = require('mongoose');
const { parseISO, differenceInMinutes } = require('date-fns');
const { zonedTimeToUtc, utcToZonedTime, format: formatTZ } = require('date-fns-tz');
const AttendanceRecord = require('../models/AttendanceRecord');
const AttendancePolicy = require('../models/AttendancePolicy');
const QRToken = require('../models/QRToken');
const Shift = require('../models/Shift');
const WFHRequest = require('../models/WFHRequest');
const User = require('../models/User');
const OfficeQRDisplay = require('../models/OfficeQRDisplay');
const AppError = require('../utils/AppError');

const OFFICE_ATTENDANCE_RADIUS_METERS = 50;

const enforceOfficeGeofence = (policy, userLocation) => {
  const officeLocation = policy?.officeLocation;
  const officeLatitude = Number(officeLocation?.latitude);
  const officeLongitude = Number(officeLocation?.longitude);
  const officeCoordinatesValid =
    officeLocation?.latitude !== null &&
    officeLocation?.latitude !== undefined &&
    String(officeLocation?.latitude).trim() !== '' &&
    officeLocation?.longitude !== null &&
    officeLocation?.longitude !== undefined &&
    String(officeLocation?.longitude).trim() !== '' &&
    Number.isFinite(officeLatitude) &&
    officeLatitude >= -90 &&
    officeLatitude <= 90 &&
    Number.isFinite(officeLongitude) &&
    officeLongitude >= -180 &&
    officeLongitude <= 180;

  if (!policy || !officeCoordinatesValid) {
    throw new AppError(
      'Office attendance is unavailable because valid office GPS coordinates are not configured. Ask an administrator to set the office location in Attendance Policies.',
      503
    );
  }

  if (!userLocation) {
    throw new AppError(
      'Current GPS location is required to mark attendance. Enable device location and try again.',
      403
    );
  }

  const latitude = Number(userLocation.latitude);
  const longitude = Number(userLocation.longitude);
  const accuracy = Number(userLocation.accuracy);
  const userCoordinatesValid =
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180;

  if (!userCoordinatesValid || !Number.isFinite(accuracy) || accuracy <= 0) {
    throw new AppError(
      'The device returned invalid GPS coordinates. Refresh your location and try again.',
      400
    );
  }

  const maximumAccuracyMeters = Number(policy.gpsAccuracyThresholdMeters) || 20;
  if (accuracy > maximumAccuracyMeters) {
    throw new AppError(
      `GPS accuracy is too low (±${Math.round(accuracy)}m). The maximum allowed is ±${maximumAccuracyMeters}m. Move to an area with a clearer GPS signal and refresh your location.`,
      403
    );
  }

  const distanceMeters = exports.calculateDistanceMeters(
    officeLatitude,
    officeLongitude,
    latitude,
    longitude
  );

  if (distanceMeters > OFFICE_ATTENDANCE_RADIUS_METERS) {
    const roundedDistance = Math.round(distanceMeters);
    throw new AppError(
      `Attendance not allowed. GPS places you about ${roundedDistance}m from the configured office, outside the verified 50m zone. If you are at the office, ask an administrator to verify the office pin in Attendance Policies; do not increase the radius.`,
      403
    );
  }

  return {
    distanceMeters,
    accuracyMeters: accuracy,
    verifiedAt: new Date()
  };
};

/**
 * Get the start-of-day UTC date for a given local date in the company timezone.
 * Used for the 'date' field in AttendanceRecord (unique per employee per day).
 *
 * @param {string|Date} [localDate] - Date string or Date object
 * @returns {Promise<Date>} - UTC Date object representing 00:00:00 in the company timezone
 */
exports.getAttendanceDateUTC = async (localDate) => {
  const policy = await AttendancePolicy.getCurrent();
  const tz = policy?.companyTimezone || 'Asia/Kolkata';

  let localDateStr;

  if (!localDate) {
    const zonedNow = utcToZonedTime(new Date(), tz);
    localDateStr = formatTZ(zonedNow, 'yyyy-MM-dd', { timeZone: tz });
  } else if (typeof localDate === 'string') {
    const trimmed = localDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      localDateStr = trimmed;
    } else {
      const parsed = parseISO(trimmed);
      const zoned = utcToZonedTime(parsed, tz);
      localDateStr = formatTZ(zoned, 'yyyy-MM-dd', { timeZone: tz });
    }
  } else if (localDate instanceof Date) {
    const zoned = utcToZonedTime(localDate, tz);
    localDateStr = formatTZ(zoned, 'yyyy-MM-dd', { timeZone: tz });
  } else {
    const parsed = new Date(localDate);
    const zoned = utcToZonedTime(parsed, tz);
    localDateStr = formatTZ(zoned, 'yyyy-MM-dd', { timeZone: tz });
  }

  return zonedTimeToUtc(new Date(`${localDateStr}T00:00:00`), tz);
};

/**
 * Get today's attendance date in UTC for the company timezone.
 *
 * @returns {Promise<Date>}
 */
exports.getTodayUTC = async () => {
  return exports.getAttendanceDateUTC(new Date());
};

/**
 * Determine attendance status based on check-in time and shift.
 * Returns: { status, isLate, lateByMinutes }
 *
 * @param {Date} checkInTime - Timestamp of check-in
 * @param {mongoose.Types.ObjectId|string} [shiftId] - Optional shift ID assigned to employee
 * @returns {Promise<{ status: string, isLate: boolean, lateByMinutes: number }>}
 */
exports.calculateAttendanceStatus = async (checkInTime, shiftId = null) => {
  const policy = await AttendancePolicy.getCurrent();
  const tz = policy?.companyTimezone || 'Asia/Kolkata';

  let shift = null;
  if (shiftId) {
    shift = await Shift.findById(shiftId);
  }
  if (!shift && policy?.defaultShift) {
    shift = policy.defaultShift;
  }
  if (!shift) {
    shift = (await Shift.findOne({ isDefault: true })) || (await Shift.findOne({ isActive: true }));
  }

  if (!shift || !shift.startTime) {
    return { status: 'present', isLate: false, lateByMinutes: 0 };
  }

  // Parse shift start time in company timezone
  const [shiftHour, shiftMin] = shift.startTime.split(':').map(Number);
  const checkInLocal = utcToZonedTime(checkInTime || new Date(), tz);
  const shiftStartLocal = new Date(checkInLocal);
  shiftStartLocal.setHours(shiftHour, shiftMin, 0, 0);

  const graceMinutes = typeof shift.graceMinutes === 'number' ? shift.graceMinutes : 15;
  const graceEnd = new Date(shiftStartLocal.getTime() + graceMinutes * 60 * 1000);
  const lateByMinutes = Math.max(0, differenceInMinutes(checkInLocal, graceEnd));
  const isLate = checkInLocal > graceEnd;

  return {
    status: isLate ? 'late' : 'present',
    isLate,
    lateByMinutes
  };
};

/**
 * Process a QR scan for employee check-in or check-out.
 * Enforces the fixed office geofence for every QR attendance action.
 * Returns the created attendance record and action performed.
 * Throws AppError on any business rule violation.
 *
 * @param {Object} employee - Authenticated employee user document/object
 * @param {Object} qrTokenRecord - QRToken mongoose document
 * @param {mongoose.Types.ObjectId|string} [displayId] - Office QR display ID
 * @param {Object|null} [userLocation] - { latitude, longitude } from employee device
 * @returns {Promise<{ record: Object, action: 'check_in' }>}
 */
exports.processQRScan = async (employee, qrTokenRecord, displayId, userLocation = null, capturedPhoto = null) => {
  const employeeId = employee._id || employee.id;

  const geoPolicy = await AttendancePolicy.getCurrent();
  const locationVerification = enforceOfficeGeofence(geoPolicy, userLocation);

  // 2. Get today's attendance date in UTC (company timezone start of day)
  const todayUTC = await exports.getTodayUTC();

  // 2. Check if employee has approved WFH for today - if yes, block ordinary check-in
  const approvedWFH = await WFHRequest.findOne({
    employee: employeeId,
    requestedDate: todayUTC,
    status: 'approved'
  });

  if (approvedWFH) {
    throw new AppError(
      'You have an approved Work From Home (WFH) for today. On-site attendance check-in is not permitted.',
      400
    );
  }

  // 3. Look for existing attendance record for today
  const existingRecord = await AttendanceRecord.findOne({
    employee: employeeId,
    date: todayUTC
  });

  const now = new Date();
  const targetDisplayId = displayId || qrTokenRecord.display;

  const verification = {
    qrTokenId: qrTokenRecord._id,
    kioskDisplayId: targetDisplayId,
    supervisorId: qrTokenRecord.issuedBy,
    locationVerifiedAt: locationVerification.verifiedAt,
    distanceMeters: locationVerification.distanceMeters,
    gpsAccuracyMeters: locationVerification.accuracyMeters,
    locationVerified: true,
    selfieCaptured: Boolean(capturedPhoto)
  };

  // 4. Check-out requires the same current QR, GPS and selfie checks as check-in.
  if (existingRecord) {
    if (existingRecord.status === 'wfh') {
      throw new AppError('Today attendance is already marked as Work From Home.', 400);
    }

    if (!existingRecord.checkIn) {
      throw new AppError('Attendance record is incomplete. Ask an administrator to review it.', 409);
    }
    if (existingRecord.checkOut) {
      throw new AppError('Today check-in and check-out are already complete.', 409);
    }

    const checkoutAt = now;
    const workingMinutes = Math.max(
      0,
      Math.round((checkoutAt.getTime() - new Date(existingRecord.checkIn).getTime()) / (1000 * 60))
    );
    const policy = await AttendancePolicy.getCurrent();
    const halfDayMinutes = policy?.halfDayDurationMinutes || 240;
    await claimAttendanceToken(qrTokenRecord, employeeId, now);
    let updatedRecord;
    try {
      updatedRecord = await AttendanceRecord.findOneAndUpdate(
        { _id: existingRecord._id, checkOut: null },
        {
          $set: {
            checkOut: checkoutAt,
            workingMinutes,
            checkoutPhoto: capturedPhoto,
            ...(workingMinutes < halfDayMinutes ? { status: 'incomplete' } : {}),
            checkoutVerification: verification
          }
        },
        { new: true, runValidators: true }
      );
    } catch (error) {
      await releaseAttendanceTokenClaim(qrTokenRecord._id, employeeId);
      throw error;
    }
    if (!updatedRecord) {
      await releaseAttendanceTokenClaim(qrTokenRecord._id, employeeId);
      throw new AppError('Check-out was already recorded. Refresh your attendance status.', 409);
    }

    await OfficeQRDisplay.findByIdAndUpdate(targetDisplayId, { lastScanAt: now });
    const populatedRecord = await AttendanceRecord.findById(updatedRecord._id)
      .populate('employee', 'name employeeId department designation email workType')
      .populate('qrDisplayId', 'displayName location');
    return { record: populatedRecord, action: 'check_out' };
  }

  const statusInfo = await exports.calculateAttendanceStatus(now, employee.shift);
  let record;
  try {
    record = await AttendanceRecord.create({
      employee: employeeId,
      date: todayUTC,
      checkIn: now,
      status: statusInfo.status,
      isLate: statusInfo.isLate,
      lateByMinutes: statusInfo.lateByMinutes,
      method: 'qr_scan',
      qrDisplayId: targetDisplayId,
      capturedPhoto,
      verification
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError('Today attendance is already marked for this employee.', 409);
    }
    throw error;
  }

  try {
    await claimAttendanceToken(qrTokenRecord, employeeId, now);
  } catch (error) {
    await AttendanceRecord.deleteOne({ _id: record._id });
    throw error;
  }

  record = await AttendanceRecord.findById(record._id)
    .populate('employee', 'name employeeId department designation email workType')
    .populate('qrDisplayId', 'displayName location');

  // Update display device timestamp
  if (targetDisplayId) {
    await OfficeQRDisplay.findByIdAndUpdate(targetDisplayId, { lastScanAt: now });
  }

  return {
    record,
    action: 'check_in'
  };
};

const claimAttendanceToken = async (tokenRecord, employeeId, now) => {
  const claimedToken = await QRToken.findOneAndUpdate(
    {
      _id: tokenRecord._id,
      isUsed: false,
      expiresAt: { $gt: now }
    },
    {
      $set: { isUsed: true, usedAt: now, usedBy: employeeId }
    },
    { new: true, runValidators: true }
  );

  if (!claimedToken) {
    throw new AppError(
      'This QR code has expired or was already used. Scan the current office QR code and try again.',
      409
    );
  }
};

const releaseAttendanceTokenClaim = async (tokenId, employeeId) => {
  await QRToken.updateOne(
    { _id: tokenId, isUsed: true, usedBy: employeeId },
    { $set: { isUsed: false }, $unset: { usedAt: 1, usedBy: 1 } }
  );
};

/**
 * Calculate distance between two lat/lng coordinates in meters using the Haversine formula
 */
exports.calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const toRad = (angle) => (angle * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const boundedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(boundedA), Math.sqrt(1 - boundedA));

  return R * c;
};

exports.enforceOfficeGeofence = enforceOfficeGeofence;

/**
 * Get all attendance records for a specific employee.
 *
 * @param {mongoose.Types.ObjectId|string} employeeId - User ObjectId
 * @param {Object} options - { startDate, endDate, page = 1, limit = 20 }
 * @returns {Promise<{ records: Array, pagination: Object }>}
 */
exports.getEmployeeAttendance = async (
  employeeId,
  { startDate, endDate, page = 1, limit = 20 } = {}
) => {
  const query = { employee: employeeId };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      query.date.$gte = await exports.getAttendanceDateUTC(startDate);
    }
    if (endDate) {
      query.date.$lte = await exports.getAttendanceDateUTC(endDate);
    }
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [total, records] = await Promise.all([
    AttendanceRecord.countDocuments(query),
    AttendanceRecord.find(query)
      .populate('employee', 'name employeeId department designation email workType')
      .populate('qrDisplayId', 'displayName location')
      .populate('correction.correctedBy', 'name employeeId')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean()
  ]);

  const totalPages = Math.ceil(total / parsedLimit) || 1;

  return {
    records,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages,
      hasNext: parsedPage < totalPages,
      hasPrev: parsedPage > 1
    }
  };
};

/**
 * Get all attendance records with filters (Admin).
 *
 * @param {Object} filters - { startDate, endDate, department, status, employeeId, page = 1, limit = 20 }
 * @returns {Promise<{ records: Array, pagination: Object }>}
 */
exports.getAllAttendance = async ({
  startDate,
  endDate,
  department,
  status,
  employeeId,
  page = 1,
  limit = 20
} = {}) => {
  const query = {};

  if (department) {
    const usersInDept = await User.find({
      department: new RegExp(`^${department.trim()}$`, 'i')
    }).select('_id');
    const userIds = usersInDept.map((u) => u._id);
    query.employee = { $in: userIds };
  }

  if (employeeId) {
    const isObjectId =
      mongoose.Types.ObjectId.isValid(employeeId) && /^[0-9a-fA-F]{24}$/.test(employeeId);
    let user = null;

    if (isObjectId) {
      user = await User.findById(employeeId).select('_id');
    }
    if (!user) {
      user = await User.findOne({ employeeId: employeeId.trim().toUpperCase() }).select('_id');
    }

    if (user) {
      if (query.employee && query.employee.$in) {
        const inDept = query.employee.$in.some((id) => id.toString() === user._id.toString());
        query.employee = inDept ? user._id : { $in: [] };
      } else {
        query.employee = user._id;
      }
    } else {
      // Return 0 records when the specified employee doesn't exist
      query.employee = new mongoose.Types.ObjectId();
    }
  }

  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      query.date.$gte = await exports.getAttendanceDateUTC(startDate);
    }
    if (endDate) {
      query.date.$lte = await exports.getAttendanceDateUTC(endDate);
    }
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [total, records] = await Promise.all([
    AttendanceRecord.countDocuments(query),
    AttendanceRecord.find(query)
      .populate('employee', 'name employeeId department designation email workType')
      .populate('qrDisplayId', 'displayName location')
      .populate('correction.correctedBy', 'name employeeId')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean()
  ]);

  const totalPages = Math.ceil(total / parsedLimit) || 1;

  return {
    records,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages,
      hasNext: parsedPage < totalPages,
      hasPrev: parsedPage > 1
    }
  };
};

/**
 * Get today's attendance for an employee.
 *
 * @param {mongoose.Types.ObjectId|string} employeeObjectId
 * @returns {Promise<Document|null>}
 */
exports.getTodayAttendance = async (employeeObjectId) => {
  const todayUTC = await exports.getTodayUTC();
  return AttendanceRecord.findOne({
    employee: employeeObjectId,
    date: todayUTC
  })
    .populate('employee', 'name employeeId department designation email workType')
    .populate('qrDisplayId', 'displayName location')
    .populate('correction.correctedBy', 'name employeeId');
};

/**
 * Get an attendance record by ID.
 *
 * @param {string|mongoose.Types.ObjectId} recordId
 * @returns {Promise<Document>}
 */
exports.getById = async (recordId) => {
  if (!mongoose.Types.ObjectId.isValid(recordId)) {
    throw new AppError('Invalid attendance record ID', 400);
  }

  const record = await AttendanceRecord.findById(recordId)
    .populate('employee', 'name employeeId department designation email workType')
    .populate('qrDisplayId', 'displayName location')
    .populate('correction.correctedBy', 'name employeeId');

  if (!record) {
    throw new AppError('Attendance record not found', 404);
  }

  return record;
};

/**
 * Apply an admin attendance correction.
 *
 * @param {string|mongoose.Types.ObjectId} recordId
 * @param {Object} correctionData - { checkIn?, checkOut?, status?, reason (required) }
 * @param {Object} adminUser - Authenticated admin user
 * @returns {Promise<Document>} - Updated attendance record
 */
exports.applyCorrection = async (recordId, correctionData, adminUser) => {
  if (!correctionData.reason || correctionData.reason.trim().length < 10) {
    throw new AppError('A valid correction reason is required (minimum 10 characters)', 400);
  }

  const record = await AttendanceRecord.findById(recordId);
  if (!record) {
    throw new AppError('Attendance record not found', 404);
  }

  // Preserve previous values for auditing and accountability
  const previousValues = {
    checkIn: record.checkIn,
    checkOut: record.checkOut,
    status: record.status,
    workingMinutes: record.workingMinutes,
    method: record.method
  };

  if (correctionData.checkIn !== undefined) {
    record.checkIn = correctionData.checkIn ? new Date(correctionData.checkIn) : null;
  }
  if (correctionData.checkOut !== undefined) {
    record.checkOut = correctionData.checkOut ? new Date(correctionData.checkOut) : null;
  }
  if (correctionData.status !== undefined) {
    record.status = correctionData.status;
  }

  // Recalculate workingMinutes if both checkIn and checkOut exist
  if (record.checkIn && record.checkOut) {
    const diffMs = new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime();
    record.workingMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
  } else {
    record.workingMinutes = 0;
  }

  record.method = 'correction';
  record.correction = {
    correctedBy: adminUser._id || adminUser.id,
    correctedAt: new Date(),
    reason: correctionData.reason.trim(),
    previousValues
  };

  await record.save();

  return AttendanceRecord.findById(recordId)
    .populate('employee', 'name employeeId department designation email workType')
    .populate('qrDisplayId', 'displayName location')
    .populate('correction.correctedBy', 'name employeeId');
};

/**
 * Get attendance summary stats for a period.
 *
 * @param {Object} options - { startDate, endDate, employeeId }
 * @returns {Promise<Object>}
 */
exports.getSummaryStats = async ({ startDate, endDate, employeeId } = {}) => {
  const query = {};

  if (employeeId) {
    const isObjectId =
      mongoose.Types.ObjectId.isValid(employeeId) && /^[0-9a-fA-F]{24}$/.test(employeeId);
    if (isObjectId) {
      query.employee = employeeId;
    } else {
      const user = await User.findOne({ employeeId: employeeId.trim().toUpperCase() }).select('_id');
      if (user) {
        query.employee = user._id;
      } else {
        query.employee = new mongoose.Types.ObjectId();
      }
    }
  }

  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      query.date.$gte = await exports.getAttendanceDateUTC(startDate);
    }
    if (endDate) {
      query.date.$lte = await exports.getAttendanceDateUTC(endDate);
    }
  }

  const records = await AttendanceRecord.find(query).lean();
  const totalDays = records.length;
  let presentCount = 0;
  let lateCount = 0;
  let wfhCount = 0;
  let incompleteCount = 0;
  let notCheckedInCount = 0;
  let totalWorkingMinutes = 0;

  for (const rec of records) {
    if (rec.status === 'present') presentCount++;
    else if (rec.status === 'late') lateCount++;
    else if (rec.status === 'wfh') wfhCount++;
    else if (rec.status === 'incomplete') incompleteCount++;
    else if (rec.status === 'not_checked_in') notCheckedInCount++;

    totalWorkingMinutes += rec.workingMinutes || 0;
  }

  const attendedDays = presentCount + lateCount + wfhCount;
  const attendanceRate = totalDays > 0 ? Math.round((attendedDays / totalDays) * 100 * 10) / 10 : 0;
  const avgWorkingMinutes = totalDays > 0 ? Math.round(totalWorkingMinutes / totalDays) : 0;

  return {
    totalDays,
    presentCount,
    lateCount,
    wfhCount,
    incompleteCount,
    notCheckedInCount,
    totalWorkingMinutes,
    avgWorkingMinutes,
    attendanceRate
  };
};
