const AppError = require('../utils/AppError');
const attendanceService = require('../services/attendanceService');

const officePolicy = {
  officeLocation: {
    latitude: 28.6139,
    longitude: 77.209,
    radiusMeters: 500,
    isEnabled: false
  },
  gpsAccuracyThresholdMeters: 20
};

describe('Office attendance geofence', () => {
  test('allows a fresh accurate GPS fix within the fixed 50m radius', () => {
    expect(() =>
      attendanceService.enforceOfficeGeofence(officePolicy, {
        latitude: 28.6142,
        longitude: 77.209,
        accuracy: 5
      })
    ).not.toThrow();
  });

  test('rejects a location outside the 50m zone even if a policy requests a larger radius or disables it', () => {
    expect(() =>
      attendanceService.enforceOfficeGeofence(officePolicy, {
        latitude: 28.6145,
        longitude: 77.209,
        accuracy: 5
      })
    ).toThrow(/outside the verified 50m zone/);
  });

  test('requires office coordinates and a GPS accuracy reading', () => {
    expect(() =>
      attendanceService.enforceOfficeGeofence(null, {
        latitude: 28.6139,
        longitude: 77.209,
        accuracy: 5
      })
    ).toThrow(AppError);

    expect(() =>
      attendanceService.enforceOfficeGeofence(officePolicy, {
        latitude: 28.6139,
        longitude: 77.209
      })
    ).toThrow(/invalid GPS coordinates/);
  });

  test('rejects low-accuracy or invalid device coordinates', () => {
    expect(() =>
      attendanceService.enforceOfficeGeofence(officePolicy, {
        latitude: 28.6139,
        longitude: 77.209,
        accuracy: 60
      })
    ).toThrow(/GPS accuracy is too low/);

    expect(() =>
      attendanceService.enforceOfficeGeofence(officePolicy, {
        latitude: 91,
        longitude: 77.209,
        accuracy: 5
      })
    ).toThrow(/invalid GPS coordinates/);
  });

  test('accepts a measured distance of exactly 50 meters when the GPS accuracy is within policy', () => {
    const boundaryPolicy = {
      officeLocation: { latitude: 0, longitude: 0, radiusMeters: 5000, isEnabled: false },
      gpsAccuracyThresholdMeters: 20
    };
    const latitudeAt50Meters = (50 / 6371000) * (180 / Math.PI);
    const result = attendanceService.enforceOfficeGeofence(boundaryPolicy, {
      latitude: latitudeAt50Meters,
      longitude: 0,
      accuracy: 20
    });

    expect(result.distanceMeters).toBeCloseTo(50, 5);
  });

  test('rejects a location just outside 50 meters without rounding it inside', () => {
    const boundaryPolicy = { ...officePolicy, officeLocation: { latitude: 0, longitude: 0 } };
    const latitudeOutside50Meters = (50.01 / 6371000) * (180 / Math.PI);

    expect(() =>
      attendanceService.enforceOfficeGeofence(boundaryPolicy, {
        latitude: latitudeOutside50Meters,
        longitude: 0,
        accuracy: 1
      })
    ).toThrow(/outside the verified 50m zone/);
  });

  test('rejects GPS accuracy above the configured 20-meter threshold', () => {
    expect(() =>
      attendanceService.enforceOfficeGeofence(officePolicy, {
        latitude: 28.6139,
        longitude: 77.209,
        accuracy: 20.01
      })
    ).toThrow(/GPS accuracy is too low/);
  });
});
