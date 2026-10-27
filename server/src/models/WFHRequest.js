const mongoose = require('mongoose');

const wfhRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employee reference is required']
    },
    requestedDate: {
      type: Date,
      required: [true, 'Requested WFH date is required']
    },
    reason: {
      type: String,
      required: [true, 'Reason for WFH request is required'],
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters']
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected'],
        message: '{VALUE} is not a valid WFH request status'
      },
      default: 'pending'
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    reviewComment: {
      type: String,
      trim: true,
      maxlength: [500, 'Review comment cannot exceed 500 characters']
    },
    attendanceRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceRecord'
    }
  },
  {
    timestamps: true
  }
);

// COMPOUND UNIQUE INDEX: one WFH request per employee per day
wfhRequestSchema.index({ employee: 1, requestedDate: 1 }, { unique: true });

// Query indexes
wfhRequestSchema.index({ status: 1 });
wfhRequestSchema.index({ requestedDate: 1 });

module.exports = mongoose.model('WFHRequest', wfhRequestSchema);
