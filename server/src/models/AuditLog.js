const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    actorEmployeeId: {
      type: String,
      trim: true
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      enum: {
        values: [
          'USER_CREATED',
          'USER_UPDATED',
          'USER_ACTIVATED',
          'USER_DEACTIVATED',
          'ACCOUNT_ACTIVATED',
          'LOGIN',
          'LOGOUT',
          'ATTENDANCE_CHECK_IN',
          'ATTENDANCE_CHECK_OUT',
          'ATTENDANCE_CORRECTED',
          'ATTENDANCE_VERIFICATION_FAILED',
          'ATTENDANCE_CAPTURE_REQUESTED',
          'ATTENDANCE_CAPTURE_CANCELLED',
          'ATTENDANCE_KIOSK_CAPTURE_FAILED',
          'WFH_REQUESTED',
          'WFH_APPROVED',
          'WFH_REJECTED',
          'POLICY_UPDATED',
          'QR_DISPLAY_REGISTERED',
          'QR_DISPLAY_ACTIVATED',
          'QR_DISPLAY_DEACTIVATED',
          'QR_DISPLAY_LOCKED',
          'QR_DISPLAY_UNLOCKED',
          'QR_DISPLAY_REVOKED',
          'QR_TOKEN_ISSUED',
          'QR_TOKEN_USED',
          'FAILED_LOGIN',
          'FAILED_OTP',
          'UNAUTHORIZED_ACCESS'
        ],
        message: '{VALUE} is not a valid audit action'
      }
    },
    targetType: {
      type: String,
      trim: true
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId
    },
    targetEmployeeId: {
      type: String,
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
auditLogSchema.index({ actor: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetId: 1 });

// Note: AuditLog immutability is enforced at the controller and service layer.
// Direct document updates and deletions are strictly disallowed by business logic.

module.exports = mongoose.model('AuditLog', auditLogSchema);
