import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lock,
  User,
  Info,
  Briefcase,
  Calendar,
  Mail,
} from 'lucide-react';
import { authService } from '../services/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export const VerificationPage = () => {
  const navigate = useNavigate();

  // Multi-step state: 1 = Register (Name, Dept, DOB, Email), 2 = OTP, 3 = Password, 4 = Success
  const [step, setStep] = useState(1);
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [demoOTP, setDemoOTP] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // OTP input refs
  const otpRefs = useRef([]);

  // Live password validation rules
  const passwordRules = [
    { label: 'At least 8 characters', valid: password.length >= 8 },
    { label: 'At least one uppercase letter (A-Z)', valid: /[A-Z]/.test(password) },
    { label: 'At least one lowercase letter (a-z)', valid: /[a-z]/.test(password) },
    { label: 'At least one number (0-9)', valid: /[0-9]/.test(password) },
    {
      label: 'Passwords match',
      valid: password.length > 0 && password === confirmPassword,
    },
  ];

  const isPasswordValid = passwordRules.every((r) => r.valid);

  // Step 1: Submit Registration Details (Name, Department, DOB, Email)
  const handleStartVerification = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!department.trim()) {
      setError('Please select or enter your department');
      return;
    }
    if (!dob) {
      setError('Please enter your Date of Birth (DOB)');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address for OTP verification');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const res = await authService.startVerification({
        name: name.trim(),
        department: department.trim(),
        dob,
        email: email.trim().toLowerCase(),
      });
      const data = res.data || res;
      if (data.employeeId) {
        setEmployeeId(data.employeeId);
      }
      if (data.demoOTP) {
        setDemoOTP(data.demoOTP);
      }
      setStep(2);
    } catch (err) {
      setError(
        err.message ||
          (typeof err === 'string' ? err : 'Unable to initiate registration/verification')
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Handle OTP input
  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      // Handle paste
      const pastedDigits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      pastedDigits.forEach((digit, i) => {
        newOtp[i] = digit;
      });
      setOtp(newOtp);
      const focusIndex = Math.min(pastedDigits.length, 5);
      otpRefs.current[focusIndex]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, '');
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance focus to next digit
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const fullOtp = otp.join('');
    if (fullOtp.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await authService.verifyOTP(employeeId.trim().toUpperCase(), fullOtp);
      // Advance to step 3 (Set Password)
      setStep(3);
    } catch (err) {
      setError(
        err.message ||
          (typeof err === 'string' ? err : 'Invalid or expired verification code')
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Set Password & Activate
  const handleActivateAccount = async (e) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setError('Please satisfy all password requirements');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const fullOtp = otp.join('');
      await authService.activateAccount(
        employeeId.trim().toUpperCase(),
        fullOtp,
        password,
        profilePhoto
      );
      setSuccessMsg('Account activated successfully! Redirecting to login...');
      setStep(4);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2500);
    } catch (err) {
      setError(
        err.message ||
          (typeof err === 'string' ? err : 'Account activation failed')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-indigo-950 flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glassmorphic Card */}
      <div className="w-full max-w-lg bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-cyan-400 shadow-glow mb-3">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Account Activation
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Complete the verification to set up your VorldX access
          </p>
        </div>

        {/* Multi-step progress indicator */}
        <div className="flex items-center justify-between mb-8 px-4">
          {[
            { num: 1, label: 'Registration' },
            { num: 2, label: 'Verify Code' },
            { num: 3, label: 'Set Password' },
          ].map((item, idx) => (
            <React.Fragment key={item.num}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step > item.num
                      ? 'bg-emerald-500 text-white'
                      : step === item.num
                      ? 'bg-gradient-to-r from-primary-600 to-cyan-500 text-white shadow-glow'
                      : 'bg-white/10 text-gray-500 border border-white/10'
                  }`}
                >
                  {step > item.num ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    item.num
                  )}
                </div>
                <span className="text-[10px] mt-1 text-gray-400 font-medium">
                  {item.label}
                </span>
              </div>
              {idx < 2 && (
                <div
                  className={`flex-1 h-0.5 mx-2 -mt-4 transition-colors ${
                    step > item.num ? 'bg-emerald-500' : 'bg-white/10'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start space-x-3 text-red-400 text-xs sm:text-sm animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* STEP 1: Enter Name, Department, DOB and Email */}
        {step === 1 && (
          <form onSubmit={handleStartVerification} className="space-y-4">
            <div>
              <Input
                label="Full Name"
                name="name"
                type="text"
                placeholder="e.g. John Doe"
                icon={User}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <Input
                label="Department"
                name="department"
                type="text"
                placeholder="e.g. Engineering / HR / Marketing"
                icon={Briefcase}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <Input
                label="Date of Birth (DOB)"
                name="dob"
                type="date"
                icon={Calendar}
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <Input
                label="Email Address (for OTP Verification)"
                name="email"
                type="email"
                placeholder="yourname@gmail.com"
                icon={Mail}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                helperText="Brevo SMTP will deliver your 6-digit verification OTP."
              />
            </div>

            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-300 flex items-center space-x-2">
              <Info className="w-4 h-4 shrink-0 text-cyan-400" />
              <span>Employee ID will be automatically generated upon registration.</span>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full shadow-glow font-semibold"
            >
              <span>Send OTP to Email</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        )}

        {/* STEP 2: Enter 6-digit OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className="space-y-6">

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3 text-center">
                Enter 6-Digit Verification Code
              </label>
              <div className="flex justify-center gap-2 sm:gap-3">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={idx === 0 ? 6 : 1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-11 h-12 sm:w-12 sm:h-14 text-center font-mono text-xl font-bold rounded-xl bg-navy-800/80 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-all shadow-sm"
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setError('');
                  setStep(1);
                }}
                disabled={isLoading}
                className="w-1/3"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back
              </Button>

              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                className="w-2/3 shadow-glow"
              >
                Verify Code
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: Set Password */}
        {step === 3 && (
          <form onSubmit={handleActivateAccount} className="space-y-4">
            <Input
              label="New Password"
              name="password"
              type="password"
              placeholder="Create a strong password"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />

            <Input
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              icon={KeyRound}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
            />

            {/* Optional Face Photo Registration */}
            <div className="p-3.5 rounded-xl bg-navy-950/60 border border-white/10 space-y-2">
              <label className="block text-xs font-semibold text-gray-300">
                Register Face Photo for Attendance (Optional / Recommended)
              </label>
              <div className="flex items-center space-x-3">
                {profilePhoto ? (
                  <div className="relative">
                    <img
                      src={profilePhoto}
                      alt="Registered Face"
                      className="w-16 h-16 rounded-xl object-cover border-2 border-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => setProfilePhoto(null)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-white/5 border border-dashed border-white/20 flex flex-col items-center justify-center text-gray-400 text-[10px]">
                    <User className="w-6 h-6 mb-1 text-gray-500" />
                    No Photo
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    id="profile-photo-upload"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setProfilePhoto(reader.result);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <label
                    htmlFor="profile-photo-upload"
                    className="cursor-pointer inline-flex items-center px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-xs font-medium text-cyan-300 border border-cyan-500/30 transition"
                  >
                    Upload / Take Photo
                  </label>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Used to verify your identity when clicking photo for attendance.
                  </p>
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="p-3.5 rounded-xl bg-navy-950/60 border border-white/5 space-y-2 text-xs">
              <span className="font-semibold text-gray-300 block mb-1">
                Password Requirements:
              </span>
              {passwordRules.map((rule, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  {rule.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-600 shrink-0" />
                  )}
                  <span
                    className={
                      rule.valid
                        ? 'text-emerald-400 font-medium'
                        : 'text-gray-400'
                    }
                  >
                    {rule.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setError('');
                  setStep(2);
                }}
                disabled={isLoading}
                className="w-1/3"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back
              </Button>

              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                disabled={!isPasswordValid}
                className="w-2/3 shadow-glow"
              >
                Activate Account
              </Button>
            </div>
          </form>
        )}

        {/* STEP 4: Success Message */}
        {step === 4 && (
          <div className="text-center py-6 animate-fade-in space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-glow">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Activation Complete!</h3>
            <p className="text-sm text-gray-300 max-w-xs mx-auto">
              {successMsg}
            </p>
          </div>
        )}

        {/* Back to Login Link */}
        <div className="mt-6 pt-5 border-t border-white/10 text-center">
          <Link
            to="/login"
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Already activated? <span className="text-cyan-400 font-medium">Sign in</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerificationPage;
