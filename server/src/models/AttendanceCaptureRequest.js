const mongoose = require('mongoose');

const attendanceCaptureRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    display: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OfficeQRDisplay',
      required: true,
      index: true
    },
    qrToken: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QRToken',
      required: true
    },
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      accuracy: { type: Number, required: true },
      timestamp: { type: Date, required: true }
    },
    status: {
      type: String,
      enum: ['pending', 'capturing', 'completed', 'failed', 'expired', 'cancelled'],
      default: 'pending',
      required: true
    },
    activeDisplayId: {
      type: String,
      unique: true,
      sparse: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    capturedAt: Date,
    attendanceRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceRecord'
    },
    action: {
      type: String,
      enum: ['check_in', 'check_out']
    },
    failureReason: {
      type: String,
      maxlength: 300
    }
  },
  { timestamps: true }
);

attendanceCaptureRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 });
attendanceCaptureRequestSchema.index({ employee: 1, createdAt: -1 });

module.exports = mongoose.model('AttendanceCaptureRequest', attendanceCaptureRequestSchema);
