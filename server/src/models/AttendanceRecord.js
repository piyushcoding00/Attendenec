const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employee reference is required']
    },
    date: {
      type: Date,
      required: [true, 'Attendance date is required'] // Start of day UTC
    },
    checkIn: {
      type: Date
    },
    checkOut: {
      type: Date
    },
    status: {
      type: String,
      enum: {
        values: ['present', 'late', 'wfh', 'incomplete', 'not_checked_in'],
        message: '{VALUE} is not a valid attendance status'
      },
      default: 'incomplete'
    },
    method: {
      type: String,
      enum: {
        values: ['qr_scan', 'manual', 'wfh', 'correction'],
        message: '{VALUE} is not a valid check-in method'
      },
      default: 'qr_scan'
    },
    workingMinutes: {
      type: Number,
      default: 0,
      min: [0, 'Working minutes cannot be negative']
    },
    // Captured face photo at the time of marking attendance
    capturedPhoto: {
      type: String,
      default: null
    },
    checkoutPhoto: {
      type: String,
      default: null
    },
    isLate: {
      type: Boolean,
      default: false
    },
    lateByMinutes: {
      type: Number,
      default: 0,
      min: [0, 'Late by minutes cannot be negative']
    },
    linkedWFHRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WFHRequest'
    },
    correction: {
      correctedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      correctedAt: {
        type: Date
      },
      reason: {
        type: String,
        trim: true
      },
      previousValues: {
        type: mongoose.Schema.Types.Mixed
      }
    },
    qrDisplayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OfficeQRDisplay'
    },
    verification: {
      qrTokenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'QRToken'
      },
      kioskDisplayId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OfficeQRDisplay'
      },
      supervisorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      locationVerifiedAt: Date,
      distanceMeters: {
        type: Number,
        min: 0
      },
      gpsAccuracyMeters: {
        type: Number,
        min: 0
      },
      locationVerified: {
        type: Boolean,
        default: false
      },
      selfieCaptured: {
        type: Boolean,
        default: false
      }
    },
    checkoutVerification: {
      qrTokenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'QRToken'
      },
      kioskDisplayId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OfficeQRDisplay'
      },
      supervisorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      locationVerifiedAt: Date,
      distanceMeters: {
        type: Number,
        min: 0
      },
      gpsAccuracyMeters: {
        type: Number,
        min: 0
      },
      locationVerified: {
        type: Boolean,
        default: false
      },
      selfieCaptured: {
        type: Boolean,
        default: false
      }
    }
  },
  {
    timestamps: true
  }
);

// COMPOUND UNIQUE INDEX: Prevent duplicate sessions per employee per day
attendanceRecordSchema.index({ employee: 1, date: 1 }, { unique: true });

// Additional Indexes for query performance
attendanceRecordSchema.index({ date: 1 });
attendanceRecordSchema.index({ status: 1 });
attendanceRecordSchema.index({ employee: 1, date: -1 });

// Pre-save hook: calculate workingMinutes from checkIn and checkOut if both exist
// Do NOT recalculate if method is 'correction' (preserve manually corrected values)
attendanceRecordSchema.pre('save', function (next) {
  if (this.method !== 'correction') {
    if (this.checkIn && this.checkOut) {
      const diffMs = new Date(this.checkOut).getTime() - new Date(this.checkIn).getTime();
      this.workingMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
    }
  }
  next();
});

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
