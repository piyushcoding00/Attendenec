const mongoose = require('mongoose');
const AttendanceCaptureRequest = require('../models/AttendanceCaptureRequest');
const AttendancePolicy = require('../models/AttendancePolicy');
const AttendanceRecord = require('../models/AttendanceRecord');
const OfficeQRDisplay = require('../models/OfficeQRDisplay');
const QRToken = require('../models/QRToken');
const User = require('../models/User');
const WFHRequest = require('../models/WFHRequest');
const attendanceCaptureService = require('../services/attendanceCaptureService');
const attendanceService = require('../services/attendanceService');
const qrDisplayService = require('../services/qrDisplayService');

const employeeId = new mongoose.Types.ObjectId();
const displayId = new mongoose.Types.ObjectId();
const tokenId = new mongoose.Types.ObjectId();
const requestId = new mongoose.Types.ObjectId();
const recordId = new mongoose.Types.ObjectId();
const employee = { _id: employeeId, role: 'employee', isActive: true };
const display = { _id: displayId, isActive: true, isPaired: true, isKioskLocked: true };
const tokenRecord = {
  _id: tokenId,
  display,
  expiresAt: new Date(Date.now() + 30000)
};
const location = {
  latitude: 0,
  longitude: 0,
  accuracy: 5,
  timestamp: new Date().toISOString()
};

beforeEach(() => {
  jest.spyOn(qrDisplayService, 'validateToken').mockResolvedValue(tokenRecord);
  jest.spyOn(AttendancePolicy, 'getCurrent').mockResolvedValue({});
  jest.spyOn(attendanceService, 'enforceOfficeGeofence').mockReturnValue({ distanceMeters: 0 });
  jest.spyOn(attendanceService, 'getTodayUTC').mockResolvedValue(new Date('2026-10-27T00:00:00Z'));
  jest.spyOn(WFHRequest, 'findOne').mockResolvedValue(null);
  jest.spyOn(AttendanceRecord, 'findOne').mockResolvedValue(null);
  jest.spyOn(AttendanceCaptureRequest, 'updateMany').mockResolvedValue({ modifiedCount: 0 });
  jest.spyOn(AttendanceCaptureRequest, 'create').mockResolvedValue({ _id: requestId });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Tablet attendance capture requests', () => {
  test('creates a kiosk-bound request only after validating a fresh GPS fix', async () => {
    await attendanceCaptureService.createRequest(employee, 'current-token', location);

    expect(attendanceService.enforceOfficeGeofence).toHaveBeenCalled();
    expect(AttendanceCaptureRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        employee: employeeId,
        display: displayId,
        qrToken: tokenId,
        activeDisplayId: displayId.toString(),
        status: 'pending',
        location: expect.objectContaining({
          latitude: 0,
          longitude: 0,
          accuracy: 5
        })
      })
    );
  });

  test('rejects a stale GPS fix without creating a capture request', async () => {
    await expect(
      attendanceCaptureService.createRequest(employee, 'current-token', {
        ...location,
        timestamp: new Date(Date.now() - 120000).toISOString()
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(AttendanceCaptureRequest.create).not.toHaveBeenCalled();
  });

  test('rejects attendance requests until an administrator locks the kiosk', async () => {
    display.isKioskLocked = false;

    await expect(
      attendanceCaptureService.createRequest(employee, 'current-token', location)
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(AttendanceCaptureRequest.create).not.toHaveBeenCalled();
    display.isKioskLocked = true;
  });

  test('rejects a second active request for the same kiosk', async () => {
    AttendanceCaptureRequest.create.mockRejectedValueOnce({ code: 11000 });

    await expect(
      attendanceCaptureService.createRequest(employee, 'current-token', location)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test('cancels a request only while it is still pending', async () => {
    const cancelledRequest = { _id: requestId, status: 'cancelled' };
    const findOneAndUpdate = jest
      .spyOn(AttendanceCaptureRequest, 'findOneAndUpdate')
      .mockResolvedValue(cancelledRequest);

    await expect(
      attendanceCaptureService.cancelRequest(requestId.toString(), employeeId.toString())
    ).resolves.toBe(cancelledRequest);

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: requestId.toString(),
        employee: employeeId.toString(),
        status: 'pending'
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'cancelled' }),
        $unset: { activeDisplayId: 1 }
      }),
      { new: true }
    );
  });

  test('associates the kiosk camera image with the exact pending request before recording attendance', async () => {
    const requestDocument = {
      _id: requestId,
      employee: employeeId,
      display: displayId,
      qrToken: tokenId,
      location,
      expiresAt: new Date(Date.now() + 30000),
      save: jest.fn().mockResolvedValue(true)
    };
    const record = { _id: recordId, employee };
    jest.spyOn(AttendanceCaptureRequest, 'findOneAndUpdate').mockResolvedValue(requestDocument);
    jest.spyOn(OfficeQRDisplay, 'findById').mockResolvedValue(display);
    jest.spyOn(User, 'findById').mockResolvedValue(employee);
    jest.spyOn(QRToken, 'findOne').mockResolvedValue(tokenRecord);
    jest.spyOn(attendanceService, 'processQRScan').mockResolvedValue({
      record,
      action: 'check_in'
    });

    const result = await attendanceCaptureService.submitCapture(
      displayId.toString(),
      requestId.toString(),
      'data:image/jpeg;base64,dGVzdA==',
      {}
    );

    expect(AttendanceCaptureRequest.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: requestId.toString(),
        display: displayId.toString(),
        status: 'pending'
      }),
      expect.any(Object),
      { new: true }
    );
    expect(attendanceService.processQRScan).toHaveBeenCalledWith(
      employee,
      expect.objectContaining({ display }),
      displayId.toString(),
      location,
      'data:image/jpeg;base64,dGVzdA=='
    );
    expect(result.captureRequest.status).toBe('completed');
    expect(result.captureRequest.attendanceRecord).toBe(recordId);
  });
});
