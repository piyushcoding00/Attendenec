const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    // Identity
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    }, // demo email, optional
    // Auth
    password: {
      type: String,
      select: false // null until account activated
    },
    initialPassword: {
      type: String,
      default: null,
      select: true
    },
    role: {
      type: String,
      enum: {
        values: ['super_admin', 'hr_admin', 'employee'],
        message: '{VALUE} is not a valid role'
      },
      default: 'employee'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isAccountActivated: {
      type: Boolean,
      default: false
    },

    dob: {
      type: Date,
      default: null
    },

    // Employment
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true
    },
    designation: {
      type: String,
      default: 'Employee',
      trim: true
    },
    joiningDate: {
      type: Date,
      default: Date.now
    },
    workType: {
      type: String,
      enum: {
        values: ['office', 'remote', 'hybrid'],
        message: '{VALUE} is not a valid work type'
      },
      default: 'office'
    },
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift'
    },

    // WFH eligibility
    wfhEligible: {
      type: Boolean,
      default: false
    },

    // Registered Face / Profile Photo (Base64 string or image URL)
    profilePhoto: {
      type: String,
      default: null
    },

    // Demo label
    isDemoAccount: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
userSchema.index({ employeeId: 1 });
userSchema.index({ department: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1 });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Check password method
userSchema.methods.correctPassword = async function (candidatePassword) {
  if (!this.password || !candidatePassword) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Never return password in JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
