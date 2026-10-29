const mongoose = require('mongoose');

const attendancePolicySchema = new mongoose.Schema(
  {
    companyTimezone: {
      type: String,
      default: 'Asia/Kolkata',
      trim: true
    },
    defaultShift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift'
    },
    qrTokenExpiresSeconds: {
      type: Number,
      default: 30,
      min: [5, 'QR token expiration must be at least 5 seconds'],
      max: [30, 'QR token expiration cannot exceed 30 seconds']
    },
    qrRefreshIntervalSeconds: {
      type: Number,
      default: 30,
      min: [5, 'QR refresh interval must be at least 5 seconds'],
      max: [30, 'QR refresh interval cannot exceed 30 seconds']
    },
    gpsAccuracyThresholdMeters: {
      type: Number,
      default: 50,
      min: [1, 'GPS accuracy threshold must be at least 1 meter'],
      max: [100, 'GPS accuracy threshold cannot exceed 100 meters']
    },
    wfhEnabled: {
      type: Boolean,
      default: true
    },
    wfhMaxDaysPerMonth: {
      type: Number,
      default: 8,
      min: [0, 'WFH max days cannot be negative']
    },
    wfhRequiresApproval: {
      type: Boolean,
      default: true
    },
    wfhAdvanceNoticeDays: {
      type: Number,
      default: 1,
      min: [0, 'WFH advance notice cannot be negative']
    },
    wfhEligibleWorkTypes: {
      type: [String],
      enum: ['office', 'remote', 'hybrid'],
      default: ['remote', 'hybrid']
    },
    attendanceCutoffHour: {
      type: Number,
      default: 23,
      min: [0, 'Cutoff hour must be between 0 and 23'],
      max: [23, 'Cutoff hour must be between 0 and 23']
    },
    halfDayDurationMinutes: {
      type: Number,
      default: 240,
      min: [0, 'Half day duration cannot be negative']
    },
    fullDayDurationMinutes: {
      type: Number,
      default: 480,
      min: [0, 'Full day duration cannot be negative']
    },
    isActive: {
      type: Boolean,
      default: true
    },
    effectiveDate: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // Geofencing coordinates for on-site attendance
    officeLocation: {
      latitude: {
        type: Number,
        default: null
      },
      longitude: {
        type: Number,
        default: null
      },
      address: {
        type: String,
        default: '',
        trim: true
      },
      locationLink: {
        type: String,
        default: '',
        trim: true
      },
      radiusMeters: {
        type: Number,
        enum: {
          values: [50],
          message: 'Office attendance radius is fixed at 50 meters'
        },
        default: 50
      },
      isEnabled: {
        type: Boolean,
        default: true
      }
    }
  },
  {
    timestamps: true
  }
);

// Indexes
attendancePolicySchema.index({ isActive: 1, effectiveDate: -1 });

/**
 * Static method to get the current active policy
 * Populates defaultShift reference
 */
attendancePolicySchema.statics.getCurrent = async function () {
  return await this.findOne({ isActive: true })
    .populate('defaultShift')
    .sort({ effectiveDate: -1, createdAt: -1 });
};

module.exports = mongoose.model('AttendancePolicy', attendancePolicySchema);
