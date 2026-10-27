const mongoose = require('mongoose');
const OfficeQRDisplay = require('../models/OfficeQRDisplay');
const User = require('../models/User');
const qrDisplayService = require('../services/qrDisplayService');

const displayId = new mongoose.Types.ObjectId();
const adminId = new mongoose.Types.ObjectId();
const actor = { _id: adminId };

const makeDisplay = (isKioskLocked = false) => ({
  _id: displayId,
  isActive: true,
  isPaired: true,
  isKioskLocked,
  save: jest.fn().mockResolvedValue(true)
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Attendance kiosk lock', () => {
  test('locks an active paired display without requiring a password', async () => {
    const display = makeDisplay();
    jest.spyOn(OfficeQRDisplay, 'findById').mockResolvedValue(display);
    const findAdmin = jest.spyOn(User, 'findById');

    await expect(
      qrDisplayService.updateKioskLock(displayId, true, actor)
    ).resolves.toBe(display);

    expect(display.isKioskLocked).toBe(true);
    expect(display.save).toHaveBeenCalledTimes(1);
    expect(findAdmin).not.toHaveBeenCalled();
  });

  test('requires the authenticated admin password to unlock', async () => {
    const display = makeDisplay(true);
    const admin = {
      isActive: true,
      correctPassword: jest.fn().mockResolvedValue(false)
    };
    jest.spyOn(OfficeQRDisplay, 'findById').mockResolvedValue(display);
    jest.spyOn(User, 'findById').mockReturnValue({
      select: jest.fn().mockResolvedValue(admin)
    });

    await expect(
      qrDisplayService.updateKioskLock(displayId, false, actor, 'incorrect-password')
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(admin.correctPassword).toHaveBeenCalledWith('incorrect-password');
    expect(display.isKioskLocked).toBe(true);
    expect(display.save).not.toHaveBeenCalled();
  });

  test('unlocks only after confirming the authenticated admin password', async () => {
    const display = makeDisplay(true);
    const admin = {
      isActive: true,
      correctPassword: jest.fn().mockResolvedValue(true)
    };
    jest.spyOn(OfficeQRDisplay, 'findById').mockResolvedValue(display);
    jest.spyOn(User, 'findById').mockReturnValue({
      select: jest.fn().mockResolvedValue(admin)
    });

    await expect(
      qrDisplayService.updateKioskLock(displayId, false, actor, 'correct-password')
    ).resolves.toBe(display);

    expect(display.isKioskLocked).toBe(false);
    expect(display.save).toHaveBeenCalledTimes(1);
  });
});

describe('Office QR display registration', () => {
  test('persists required office details, optional description, and selected status', async () => {
    const createdDisplay = { _id: displayId };
    const createDisplay = jest.spyOn(OfficeQRDisplay, 'create').mockResolvedValue(createdDisplay);

    await expect(qrDisplayService.pairDisplay({
      displayName: 'Lobby QR',
      officeName: 'VorldX Main Office',
      location: 'Ground Floor Reception',
      notes: 'Front desk tablet',
      isActive: true
    }, actor)).resolves.toBe(createdDisplay);

    expect(createDisplay).toHaveBeenCalledWith(expect.objectContaining({
      displayName: 'Lobby QR',
      officeName: 'VorldX Main Office',
      location: 'Ground Floor Reception',
      notes: 'Front desk tablet',
      isActive: true,
      isPaired: true,
      pairedBy: adminId
    }));
  });

  test('rejects registration without office name or location', async () => {
    const createDisplay = jest.spyOn(OfficeQRDisplay, 'create');

    await expect(qrDisplayService.pairDisplay({
      displayName: 'Lobby QR',
      officeName: ' ',
      location: '',
    }, actor)).rejects.toMatchObject({ statusCode: 400 });

    expect(createDisplay).not.toHaveBeenCalled();
  });
});
