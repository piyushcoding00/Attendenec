import React, { useCallback, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, Lock, AlertCircle, Mail, KeyRound, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import { ROLES } from '../utils/constants';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export const LoginPage = () => {
  const { login, loginWithOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Login Mode: 'password' (Admin/Standard) or 'otp' (Employee Email OTP)
  const [loginMode, setLoginMode] = useState('password');

  // Password Login state
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');

  // Email OTP Login state
  const [emailOrId, setEmailOrId] = useState('');
  const [otpStep, setOtpStep] = useState(1); // 1 = Enter Email/ID, 2 = Enter OTP
  const [otp, setOtp] = useState('');
  const [demoOTP, setDemoOTP] = useState('');
  const [successInfo, setSuccessInfo] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Helper to handle role-based navigation
  const redirectAfterLogin = useCallback((response) => {
    const user = response.user || response.data?.user || response.data || response;
    const userRole = (user.role || '').toLowerCase();

    const from = location.state?.from?.pathname;
    if (from) {
      navigate(from, { replace: true });
      return;
    }

    if ([ROLES.HR_ADMIN, ROLES.SUPER_ADMIN].includes(userRole)) {
      navigate('/admin/dashboard', { replace: true });
    } else {
      navigate('/employee/home', { replace: true });
    }
  }, [location.state?.from?.pathname, navigate]);

  // 1. Password Login Submit
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId.trim() || !password) {
      setErrorMessage('Please enter both Employee ID and password');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const response = await login(employeeId.trim(), password);
      redirectAfterLogin(response);
    } catch (err) {
      setErrorMessage(
        err.message ||
          (typeof err === 'string' ? err : 'Invalid Employee ID or password')
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Send Login OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!emailOrId.trim()) {
      setErrorMessage('Please enter your Registered Email or Employee ID');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const isEmail = emailOrId.includes('@');
      const res = await authService.sendLoginOtp(
        isEmail ? emailOrId.trim() : null,
        !isEmail ? emailOrId.trim().toUpperCase() : null
      );
      const data = res.data || res;
      if (data.demoOTP) {
        setDemoOTP(data.demoOTP);
      }
      setSuccessInfo(res.message || 'OTP sent successfully!');
      setOtpStep(2);
    } catch (err) {
      setErrorMessage(
        err.message ||
          (typeof err === 'string' ? err : 'Failed to send OTP. Please check your email/ID.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Verify Login OTP and Sign In
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length !== 6) {
      setErrorMessage('Please enter the valid 6-digit OTP');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const isEmail = emailOrId.includes('@');
      const response = await loginWithOtp(
        isEmail ? emailOrId.trim() : null,
        !isEmail ? emailOrId.trim().toUpperCase() : null,
        otp.trim()
      );
      redirectAfterLogin(response);
    } catch (err) {
      setErrorMessage(
        err.message ||
          (typeof err === 'string' ? err : 'Invalid OTP. Please check and try again.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-x-hidden overflow-y-auto bg-gradient-to-br from-navy-950 via-navy-900 to-indigo-950 px-3 py-4 sm:px-5 sm:py-6">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="relative z-10 my-auto w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur-xl animate-fade-in sm:rounded-3xl sm:p-6">
        {/* Brand Header */}
        <div className="mb-4 text-center sm:mb-5">
          <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-primary-600 via-primary-500 to-cyan-400 shadow-glow sm:mb-2.5 sm:h-12 sm:w-12">
            <span className="text-xl font-black tracking-wider text-white sm:text-2xl">VX</span>
          </div>
          <h1 className="bg-gradient-to-r from-white via-slate-100 to-cyan-400 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl">
            VORLDX
          </h1>
          <p className="mt-1 text-xs font-medium text-gray-400">
            Employee Attendance System
          </p>
        </div>

        {/* Login Method Toggle Tab */}
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-navy-950/80 p-1 sm:mb-5">
          <button
            type="button"
            onClick={() => {
              setLoginMode('otp');
              setErrorMessage('');
            }}
            className={`min-h-10 rounded-lg px-1.5 py-2 text-[11px] font-semibold leading-tight transition-all min-[380px]:px-2 sm:text-xs ${
              loginMode === 'otp'
                ? 'bg-gradient-to-r from-primary-600 to-cyan-500 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Email OTP Login
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode('password');
              setErrorMessage('');
            }}
            className={`min-h-10 rounded-lg px-1.5 py-2 text-[11px] font-semibold leading-tight transition-all min-[380px]:px-2 sm:text-xs ${
              loginMode === 'password'
                ? 'bg-gradient-to-r from-primary-600 to-cyan-500 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Password / Admin
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {successInfo && loginMode === 'otp' && otpStep === 2 && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successInfo}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* EMAIL OTP LOGIN FLOW */}
        {/* ========================================================================= */}
        {loginMode === 'otp' && (
          <div>
            {otpStep === 1 ? (
              <form onSubmit={handleSendOtp} className="space-y-3">
                <Input
                  label="Registered Email or Employee ID"
                  name="emailOrId"
                  type="text"
                  placeholder="name@gmail.com or EMP001"
                  icon={Mail}
                  value={emailOrId}
                  onChange={(e) => setEmailOrId(e.target.value)}
                  disabled={isLoading}
                  helperText="Brevo SMTP will send a secure 6-digit login OTP."
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="w-full mt-2 shadow-glow text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <span>Send Login OTP</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <Input
                  label="Enter 6-Digit OTP"
                  name="otp"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  icon={KeyRound}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={isLoading}
                  autoFocus
                />

                <div className="flex flex-col gap-2 min-[380px]:flex-row">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setOtpStep(1);
                      setOtp('');
                      setErrorMessage('');
                    }}
                    disabled={isLoading}
                    className="w-full text-xs min-[380px]:w-1/3"
                  >
                    Change Email
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isLoading}
                    disabled={otp.length !== 6}
                    className="w-full text-sm font-semibold shadow-glow min-[380px]:w-2/3"
                  >
                    Verify & Sign In
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* PASSWORD LOGIN FLOW (ADMIN / LEGACY) */}
        {/* ========================================================================= */}
        {loginMode === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <Input
              label="Employee ID or Super Admin Email"
              name="employeeId"
              type="text"
              placeholder="Employee ID or vorldxteam@gmail.com"
              icon={User}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={isLoading}
            />

            <Input
              label="Password"
              name="password"
              type="password"
              placeholder="••••••••"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="mt-1 w-full text-sm font-semibold shadow-glow sm:text-base"
            >
              Sign In
            </Button>
          </form>
        )}

        {/* Activation Link */}
        <div className="mt-4 border-t border-white/10 pt-4 text-center sm:mt-5 sm:pt-4">
          <Link
            to="/verify"
            className="group inline-flex max-w-full flex-wrap items-center justify-center gap-x-1 text-xs font-medium leading-relaxed text-cyan-400 transition-colors hover:text-cyan-300 sm:text-sm"
          >
            <span>New employee? Activate your account via Email OTP</span>
            <span className="transition-transform group-hover:translate-x-1">
              &rarr;
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
