const mongoose = require('mongoose');
const attendanceService = require('../services/attendanceService');
const AttendancePolicy = require('../models/AttendancePolicy');
const AttendanceRecord = require('../models/AttendanceRecord');
const OfficeQRDisplay = require('../models/OfficeQRDisplay');
const QRToken = require('../models/QRToken');
const WFHRequest = require('../models/WFHRequest');

const employeeId = new mongoose.Types.ObjectId();
const displayId = new mongoose.Types.ObjectId();
const supervisorId = new mongoose.Types.ObjectId();
const qrTokenId = new mongoose.Types.ObjectId();
const recordId = new mongoose.Types.ObjectId();
const today = new Date('2025-01-15T00:00:00.000Z');
const photo = 'data:image/jpeg;base64,dGVzdA==';
const location = { latitude: 0, longitude: 0, accuracy: 5 };
const policy = {
  officeLocation: { latitude: 0, longitude: 0 },
  gpsAccuracyThresholdMeters: 20,
  halfDayDurationMinutes: 240
};

const makePopulateQuery = (result) => {
  const query = {
    populate: jest.fn()
  };
  query.populate.mockReturnValue(query);
  query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return query;
};

const makeScanArgs = () => [
  { _id: employeeId, shift: null },
  { _id: qrTokenId, display: displayId, issuedBy: supervisorId },
  displayId,
  location,
  photo
];

beforeEach(() => {
  jest.spyOn(AttendancePolicy, 'getCurrent').mockResolvedValue(policy);
  jest.spyOn(attendanceService, 'getTodayUTC').mockResolvedValue(today);
  jest.spyOn(attendanceService, 'calculateAttendanceStatus').mockResolvedValue({
    status: 'present',
    isLate: false,
    lateByMinutes: 0
  });
  jest.spyOn(WFHRequest, 'findOne').mockResolvedValue(null);
  jest.spyOn(AttendanceRecord, 'findOne').mockResolvedValue(null);
  jest.spyOn(AttendanceRecord, 'findOneAndUpdate').mockResolvedValue(null);
  jest.spyOn(AttendanceRecord, 'create').mockResolvedValue({ _id: recordId });
  jest.spyOn(AttendanceRecord, 'findById').mockImplementation(() =>
    makePopulateQuery({ _id: recordId, checkIn: new Date(), verification: { locationVerified: true } })
  );
  jest.spyOn(AttendanceRecord, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
  jest.spyOn(QRToken, 'findOneAndUpdate').mockResolvedValue({ _id: qrTokenId });
  jest.spyOn(OfficeQRDisplay, 'findByIdAndUpdate').mockResolvedValue({});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Secure QR attendance processing', () => {
  test('atomically consumes a valid token once and stores verification metadata', async () => {
    const result = await attendanceService.processQRScan(...makeScanArgs());

    expect(result.action).toBe('check_in');
    expect(AttendanceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        employee: employeeId,
        method: 'qr_scan',
        capturedPhoto: photo,
        verification: expect.objectContaining({
          qrTokenId,
          kioskDisplayId: displayId,
          supervisorId,
          locationVerified: true,
          selfieCaptured: true,
          distanceMeters: 0,
          gpsAccuracyMeters: 5
        })
      })
    );
    expect(QRToken.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: qrTokenId,
        isUsed: false,
        expiresAt: { $gt: expect.any(Date) }
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          isUsed: true,
          usedBy: employeeId,
          usedAt: expect.any(Date)
        })
      }),
      expect.any(Object)
    );
  });

  test('rejects a previously consumed token and removes the uncommitted record', async () => {
    QRToken.findOneAndUpdate.mockResolvedValueOnce(null);

    await expect(attendanceService.processQRScan(...makeScanArgs())).rejects.toMatchObject({
      statusCode: 409
    });

    expect(AttendanceRecord.deleteOne).toHaveBeenCalledWith({ _id: recordId });
  });

  test('does not create an attendance record when the GPS fix is outside the geofence', async () => {
    const outsideLocation = { latitude: 0.0006, longitude: 0, accuracy: 5 };

    await expect(
      attendanceService.processQRScan(
        ...makeScanArgs().slice(0, 3),
        outsideLocation,
        photo
      )
    ).rejects.toThrow(/outside the verified 50m zone/);

    expect(AttendanceRecord.create).not.toHaveBeenCalled();
    expect(QRToken.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('persists GPS, kiosk, and supervisor verification for check-out as well', async () => {
    const existingRecord = {
      _id: recordId,
      status: 'present',
      checkIn: new Date(Date.now() - 8 * 60 * 60 * 1000)
    };
    const checkedOutRecord = {
      ...existingRecord,
      checkOut: new Date(),
      checkoutVerification: { locationVerified: true, selfieCaptured: true }
    };
    AttendanceRecord.findOne.mockResolvedValueOnce(existingRecord);
    AttendanceRecord.findOneAndUpdate.mockResolvedValueOnce(checkedOutRecord);
    AttendanceRecord.findById.mockImplementationOnce(() => makePopulateQuery(checkedOutRecord));

    const result = await attendanceService.processQRScan(...makeScanArgs());

    expect(result.action).toBe('check_out');
    expect(AttendanceRecord.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: recordId, checkOut: null },
      expect.objectContaining({
        $set: expect.objectContaining({
          checkoutPhoto: photo,
          checkoutVerification: expect.objectContaining({
            qrTokenId,
            kioskDisplayId: displayId,
            supervisorId,
            locationVerified: true,
            selfieCaptured: true
          })
        })
      }),
      expect.any(Object)
    );
  });

  test('releases the token claim if the check-out record cannot be updated', async () => {
    AttendanceRecord.findOne.mockResolvedValueOnce({
      _id: recordId,
      status: 'present',
      checkIn: new Date(Date.now() - 8 * 60 * 60 * 1000)
    });
    AttendanceRecord.findOneAndUpdate.mockResolvedValueOnce(null);
    const releaseClaim = jest.spyOn(QRToken, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

    await expect(attendanceService.processQRScan(...makeScanArgs())).rejects.toMatchObject({
      statusCode: 409
    });

    expect(releaseClaim).toHaveBeenCalledWith(
      { _id: qrTokenId, isUsed: true, usedBy: employeeId },
      { $set: { isUsed: false }, $unset: { usedAt: 1, usedBy: 1 } }
    );
  });
});

describe('QR token expiry validation', () => {
  test('looks up only a hashed token that has not expired or been revoked', async () => {
    const findOne = jest.spyOn(QRToken, 'findOne').mockResolvedValue(null);
    const rawToken = 'private-test-token';

    await expect(QRToken.verifyToken(rawToken)).resolves.toBeNull();

    const filter = findOne.mock.calls[0][0];
    expect(filter.tokenHash).not.toBe(rawToken);
    expect(filter.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(filter.isUsed).toBe(false);
    expect(filter.expiresAt.$gt).toBeInstanceOf(Date);
  });
});
