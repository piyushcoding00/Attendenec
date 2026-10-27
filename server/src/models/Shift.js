const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Shift name is required'],
      trim: true
    },
    startTime: {
      type: String,
      required: [true, 'Shift start time is required'],
      trim: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be in HH:mm format (e.g., 09:00)']
    },
    endTime: {
      type: String,
      required: [true, 'Shift end time is required'],
      trim: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time must be in HH:mm format (e.g., 18:00)']
    },
    graceMinutes: {
      type: Number,
      default: 15,
      min: [0, 'Grace period cannot be negative']
    },
    workingDays: {
      type: [String],
      enum: {
        values: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        message: '{VALUE} is not a valid day of the week'
      },
      default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
shiftSchema.index({ isDefault: 1 });
shiftSchema.index({ isActive: 1 });

module.exports = mongoose.model('Shift', shiftSchema);
