const mongoose = require('mongoose');
const crypto = require('crypto');

const qrTokenSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required'],
      unique: true
    },
    display: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OfficeQRDisplay',
      required: [true, 'QR display reference is required']
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration timestamp is required']
    },
    isUsed: {
      type: Boolean,
      default: false
    },
    usedAt: {
      type: Date
    },
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    attendanceClaims: [{
      employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      attendanceRecord: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AttendanceRecord',
        required: true
      },
      usedAt: {
        type: Date,
        required: true
      }
    }],
    attendanceType: {
      type: String,
      enum: {
        values: ['check_in', 'check_out', 'auto'],
        message: '{VALUE} is not a valid attendance type'
      },
      default: 'auto'
    }
  },
  {
    timestamps: true
  }
);

// Indexes
qrTokenSchema.index({ tokenHash: 1 });
qrTokenSchema.index({ display: 1 });

// TTL index: MongoDB will automatically remove expired documents 60 seconds after expiresAt
qrTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 });

/**
 * Static method to create and save a new QR token
 * @param {mongoose.Types.ObjectId|string} displayId
 * @param {number} [expiresSeconds=30]
 * @returns {Promise<{ rawToken: string, record: Document }>}
 */
qrTokenSchema.statics.createToken = async function (displayId, expiresSeconds = 30, issuedBy = null) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + expiresSeconds * 1000);

  const record = await this.create({
    tokenHash,
    display: displayId,
    issuedBy,
    expiresAt,
    isUsed: false,
    attendanceType: 'auto'
  });

  return { rawToken, record };
};

/**
 * Static method to verify a raw QR token
 * @param {string} rawToken
 * @returns {Promise<Document|null>}
 */
qrTokenSchema.statics.verifyToken = async function (rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    return null;
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const record = await this.findOne({
    tokenHash,
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });

  return record;
};

module.exports = mongoose.model('QRToken', qrTokenSchema);
