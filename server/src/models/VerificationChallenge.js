const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const verificationChallengeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      uppercase: true,
      trim: true
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    otpHash: {
      type: String,
      required: [true, 'OTP hash is required']
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
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 3
    }
  },
  {
    timestamps: true
  }
);

// Indexes
verificationChallengeSchema.index({ employeeId: 1 });
// TTL index: auto-cleanup 60s after expiration
verificationChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 });

/**
 * Static method to create a new verification challenge
 * Generates 6-digit OTP, hashes it, and stores record valid for 5 minutes
 * @param {string} employeeId
 * @param {mongoose.Types.ObjectId} employeeObjectId
 * @returns {Promise<{ otp: string, challenge: Document }>}
 */
verificationChallengeSchema.statics.createChallenge = async function (employeeId, employeeObjectId) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const salt = await bcrypt.genSalt(10);
  const otpHash = await bcrypt.hash(otp, salt);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

  const challenge = await this.create({
    employeeId: employeeId.toUpperCase(),
    employee: employeeObjectId,
    otpHash,
    expiresAt,
    isUsed: false,
    attempts: 0,
    maxAttempts: 3
  });

  return { otp, challenge };
};

/**
 * Instance method to verify a candidate OTP
 * Increments attempts, validates expiration and max attempts,
 * and optionally marks challenge as used upon success.
 * @param {string} candidateOTP
 * @param {boolean} [markUsed=true]
 * @returns {Promise<boolean>}
 */
verificationChallengeSchema.methods.verifyOTP = async function (candidateOTP, markUsed = true) {
  // If already used or expired, fail immediately
  if (this.isUsed || new Date() > this.expiresAt) {
    return false;
  }

  // If already reached max attempts, fail
  if (this.attempts >= this.maxAttempts) {
    return false;
  }

  this.attempts += 1;

  if (!candidateOTP) {
    await this.save();
    return false;
  }

  const isMatch = await bcrypt.compare(candidateOTP.toString(), this.otpHash);
  if (!isMatch) {
    await this.save();
    return false;
  }

  if (markUsed) {
    this.isUsed = true;
    this.usedAt = new Date();
  }

  await this.save();
  return true;
};

module.exports = mongoose.model('VerificationChallenge', verificationChallengeSchema);
