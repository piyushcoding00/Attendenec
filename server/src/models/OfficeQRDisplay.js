const mongoose = require('mongoose');

const officeQRDisplaySchema = new mongoose.Schema(
  {
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true
    },
    officeName: {
      type: String,
      trim: true,
      default: ''
    },
    pairingCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: false
    },
    isPaired: {
      type: Boolean,
      default: false
    },
    isKioskLocked: {
      type: Boolean,
      default: false
    },
    pairedAt: {
      type: Date
    },
    pairedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lastTokenIssuedAt: {
      type: Date
    },
    lastScanAt: {
      type: Date
    },
    location: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
officeQRDisplaySchema.index({ isActive: 1 });
officeQRDisplaySchema.index({ isPaired: 1 });

module.exports = mongoose.model('OfficeQRDisplay', officeQRDisplaySchema);
