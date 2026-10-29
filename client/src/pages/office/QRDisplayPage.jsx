import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Monitor,
  RefreshCw,
  AlertTriangle,
  Clock,
  Wifi,
  WifiOff,
  ShieldCheck,
  Camera,
  CameraOff,
  LockKeyhole,
  UnlockKeyhole,
  Maximize,
  Minimize,
  ArrowLeft,
  LayoutDashboard,
} from 'lucide-react';
import { qrDisplayService } from '../../services/api';
import Button from '../../components/ui/Button';

export const QRDisplayPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const displayId = searchParams.get('displayId');
  const [inputDisplayId, setInputDisplayId] = useState('');

  // Live Token & QR Image State
  const [qrImageDataUrl, setQrImageDataUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const [isKioskStarted, setIsKioskStarted] = useState(true);
  const [cameraStatus, setCameraStatus] = useState('Ready');
  const [connectionStatus, setConnectionStatus] = useState('Connected');
  const [pendingCapture, setPendingCapture] = useState(null);
  const [captureStatus, setCaptureStatus] = useState('Waiting for employee');
  const [displayName, setDisplayName] = useState('');
  const [officeName, setOfficeName] = useState('');
  const [displayLocation, setDisplayLocation] = useState('');
  const [isKioskLocked, setIsKioskLocked] = useState(false);
  const [isKioskStateLoading, setIsKioskStateLoading] = useState(false);
  const [isLockUpdating, setIsLockUpdating] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockForm, setShowUnlockForm] = useState(false);
  const [showAdminExitForm, setShowAdminExitForm] = useState(false);
  const [adminExitPassword, setAdminExitPassword] = useState('');
  const [adminExitError, setAdminExitError] = useState(null);
  const [isAdminVerifying, setIsAdminVerifying] = useState(false);
  const [showFullscreenExitForm, setShowFullscreenExitForm] = useState(false);
  const [fullscreenExitPassword, setFullscreenExitPassword] = useState('');
  const [fullscreenExitError, setFullscreenExitError] = useState(null);
  const [isFullscreenVerifying, setIsFullscreenVerifying] = useState(false);

  // Live Clock
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const timerRef = useRef(null);
  const clockRef = useRef(null);
  const tokenRequestRef = useRef(false);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const pendingCaptureRef = useRef(null);
  const captureBusyRef = useRef(false);
  const serverOffsetRef = useRef(0);
  const tokenExpiresAtRef = useRef(0);

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        // If screen is currently fullscreen and user wants to minimize / exit fullscreen, require Admin Password
        setFullscreenExitError(null);
        setFullscreenExitPassword('');
        setShowFullscreenExitForm(true);
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (fullscreenError) {
      setError(fullscreenError.message || 'Fullscreen mode is not available in this browser.');
    }
  };

  const handleFullscreenExit = async (e) => {
    e.preventDefault();
    if (!fullscreenExitPassword) return;
    setIsFullscreenVerifying(true);
    setFullscreenExitError(null);
    try {
      // Verify admin password before minimizing fullscreen
      await qrDisplayService.updateKioskLock(displayId, false, fullscreenExitPassword);
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setShowFullscreenExitForm(false);
      setFullscreenExitPassword('');
    } catch (err) {
      setFullscreenExitError(err.message || 'Admin password is incorrect. Screen remains fullscreen.');
    } finally {
      setIsFullscreenVerifying(false);
    }
  };

  useEffect(() => {
    if (!displayId) {
      setIsKioskStateLoading(false);
      return undefined;
    }
    let active = true;
    setIsKioskStateLoading(true);
    qrDisplayService.getKioskState(displayId)
      .then((response) => {
        if (!active) return;
        const data = response.data || response;
        setIsKioskLocked(Boolean(data.isKioskLocked));
      })
      .catch((stateError) => {
        if (active) setError(stateError.message || 'Unable to load kiosk lock status.');
      })
      .finally(() => {
        if (active) setIsKioskStateLoading(false);
      });
    return () => { active = false; };
  }, [displayId]);

  useEffect(() => {
    if (!isKioskLocked) return undefined;
    const preventBackNavigation = () => {
      window.history.pushState({ kioskLocked: true }, '', window.location.href);
    };
    const preventUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Kiosk is locked. Enter admin password to exit.';
      return e.returnValue;
    };
    preventBackNavigation();
    window.addEventListener('popstate', preventBackNavigation);
    window.addEventListener('beforeunload', preventUnload);
    return () => {
      window.removeEventListener('popstate', preventBackNavigation);
      window.removeEventListener('beforeunload', preventUnload);
    };
  }, [isKioskLocked]);

  const handleAdminExit = async (e) => {
    e.preventDefault();
    if (!adminExitPassword) return;
    setIsAdminVerifying(true);
    setAdminExitError(null);
    try {
      // Verify admin password before leaving kiosk
      await qrDisplayService.updateKioskLock(displayId, false, adminExitPassword);
      setShowAdminExitForm(false);
      setAdminExitPassword('');
      navigate('/admin/dashboard');
    } catch (err) {
      setAdminExitError(err.message || 'Incorrect admin password. Access denied.');
    } finally {
      setIsAdminVerifying(false);
    }
  };

  const updateKioskLock = async (isLocked, password = '') => {
    setIsLockUpdating(true);
    setError(null);

    // 1. Instant optimistic state update: immediately lock screen & close forms
    if (isLocked) {
      setIsKioskLocked(true);
      setShowUnlockForm(false);
      try {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen().catch(() => {});
        } else if (docEl.msRequestFullscreen) {
          docEl.msRequestFullscreen().catch(() => {});
        }
      } catch (fsErr) {
        console.warn('Fullscreen request error:', fsErr);
      }
    }

    try {
      // 2. Sync lock state with backend
      const response = await qrDisplayService.updateKioskLock(displayId, isLocked, password);
      const data = response.data || response;
      const locked = Boolean(data.isKioskLocked ?? isLocked);
      setIsKioskLocked(locked);
      setShowUnlockForm(false);
      setUnlockPassword('');

      if (!locked) {
        try {
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
        } catch (exitErr) {
          console.warn('Exit fullscreen error:', exitErr);
        }
      }
    } catch (lockError) {
      if (!isLocked) {
        // If unlocking failed (wrong admin password), keep locked and show error
        setIsKioskLocked(true);
        setError(lockError.message || 'Admin password is incorrect. The kiosk remains locked.');
      } else {
        console.warn('Backend lock update warning:', lockError);
        // Still keep UI locked locally even if network has delay
        setIsKioskLocked(true);
      }
    } finally {
      setIsLockUpdating(false);
    }
  };

  // Clock tick every 1000ms
  useEffect(() => {
    clockRef.current = setInterval(() => {
      setCurrentTime(new Date(Date.now() + serverOffsetRef.current));
    }, 1000);

    return () => {
      if (clockRef.current) clearInterval(clockRef.current);
    };
  }, []);

  useEffect(() => () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
  }, []);

  const startKiosk = () => {
    setError(null);
    setCameraStatus('Ready');
    setConnectionStatus('Connected');
    setIsKioskStarted(true);
  };

  // Open camera ONLY when pendingCapture arrives (after employee verifies QR)
  useEffect(() => {
    let active = true;
    if (!pendingCapture || !isKioskStarted) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
      return undefined;
    }

    const openCameraForCapture = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera not supported in this browser.');
        return;
      }
      try {
        setCameraStatus('Opening camera');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraStatus('Ready');
      } catch (camErr) {
        if (!active) return;
        setCameraStatus('Unavailable');
        setError('Camera permission denied or camera unavailable.');
      }
    };

    openCameraForCapture();

    return () => {
      active = false;
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
    };
  }, [pendingCapture, isKioskStarted]);

  // Fetch Token Function
  const fetchNewToken = async (idToFetch) => {
    const id = idToFetch || displayId;
    if (!id || tokenRequestRef.current || !isKioskStarted || pendingCaptureRef.current) return;

    tokenRequestRef.current = true;
    setIsLoading(true);
    setError(null);
    setQrImageDataUrl('');
    setCountdown(0);

    try {
      const res = await qrDisplayService.getToken(id);
      const data = res.data || res;
      const serverTime = data.serverTime ? new Date(data.serverTime).getTime() : Date.now();
      if (data.serverTime) {
        serverOffsetRef.current = serverTime - Date.now();
      }
      setDisplayName(data.displayName || '');
      setOfficeName(data.officeName || '');
      setDisplayLocation(data.location || '');
      const rawToken = data.token || data;

      if (!rawToken) {
        throw new Error('No QR token received from server');
      }

      // Generate Data URL for QR code
      const url = await QRCode.toDataURL(rawToken, {
        width: 320,
        margin: 2,
        color: {
          dark: '#020617', // Dark navy/black dots
          light: '#ffffff', // Crisp white background
        },
        errorCorrectionLevel: 'M',
      });

      setQrImageDataUrl(url);
      tokenExpiresAtRef.current = data.expiresAt
        ? new Date(data.expiresAt).getTime()
        : serverTime + (data.expiresIn || 30) * 1000;
      setCountdown(Math.max(0, Math.ceil((tokenExpiresAtRef.current - serverTime) / 1000)));
    } catch (err) {
      console.error('Failed to issue QR token:', err);
      setQrImageDataUrl('');
      setCountdown(0);
      setError(
        err.message ||
          (typeof err === 'string' ? err : 'Unable to connect to attendance service')
      );
    } finally {
      setIsLoading(false);
      tokenRequestRef.current = false;
    }
  };

  // Setup 30s auto-refresh loop and countdown
  useEffect(() => {
    if (!displayId || !isKioskStarted) return undefined;

    // Fetch initial token immediately
    fetchNewToken(displayId);

    // Setup 1-second countdown tick
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (pendingCaptureRef.current) return prev;
        const remaining = Math.ceil(
          (tokenExpiresAtRef.current - (Date.now() + serverOffsetRef.current)) / 1000
        );
        if (remaining <= 0) {
          fetchNewToken(displayId);
          return 0;
        }
        return remaining;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [displayId, isKioskStarted]);

  useEffect(() => {
    if (!displayId || !isKioskStarted) return undefined;
    let active = true;
    let requestInFlight = false;
    const pollForCapture = async () => {
      if (!active || requestInFlight || pendingCaptureRef.current) return;
      requestInFlight = true;
      try {
        const response = await qrDisplayService.getNextCapture(displayId);
        const capture = response.data || response;
        if (!active) return;
        setConnectionStatus('Connected');
        setError((currentError) =>
          currentError?.startsWith('Kiosk connection interrupted:') ? null : currentError
        );
        if (capture?.id) {
          pendingCaptureRef.current = capture;
          setPendingCapture(capture);
          setCaptureStatus(`Capturing ${capture.employee?.name || 'employee'}`);
        }
      } catch (pollError) {
        if (!active) return;
        setConnectionStatus('Offline');
        setError(`Kiosk connection interrupted: ${pollError.message || 'service unavailable'}`);
      } finally {
        requestInFlight = false;
      }
    };
    pollForCapture();
    const intervalId = setInterval(pollForCapture, 1000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [displayId, isKioskStarted]);

  useEffect(() => {
    if (!pendingCapture || !isKioskStarted || captureBusyRef.current) return undefined;
    captureBusyRef.current = true;
    let active = true;
    const timerId = setTimeout(async () => {
      try {
        const video = videoRef.current;
        if (
          !video ||
          video.readyState < 2 ||
          video.videoWidth === 0 ||
          !cameraStreamRef.current?.getVideoTracks().some((track) => track.readyState === 'live')
        ) {
          throw new Error('Tablet camera stream is not ready. Restart the kiosk and try again.');
        }
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Unable to prepare a tablet camera capture.');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const photo = canvas.toDataURL('image/jpeg', 0.82);
        setCaptureStatus('Sending secure camera capture');
        await qrDisplayService.submitCapture(displayId, pendingCapture.id, photo);
        if (!active) return;
        setCaptureStatus(`Attendance saved for ${pendingCapture.employee?.name || 'employee'}`);
        if (cameraStreamRef.current) {
          cameraStreamRef.current.getTracks().forEach((t) => t.stop());
          cameraStreamRef.current = null;
        }
        pendingCaptureRef.current = null;
        setPendingCapture(null);
        setCountdown(0);
        await fetchNewToken(displayId);
      } catch (captureError) {
        if (!active) return;
        try {
          await qrDisplayService.failCapture(
            displayId,
            pendingCapture.id,
            String(captureError.message || 'Tablet camera capture failed.').slice(0, 300)
          );
        } catch (failureError) {
          console.error('Unable to record kiosk capture failure:', failureError);
        }
        setCaptureStatus(captureError.message || 'Tablet camera capture failed');
        setError(captureError.message || 'Tablet camera capture failed.');
        pendingCaptureRef.current = null;
        setPendingCapture(null);
        setCountdown(0);
        await fetchNewToken(displayId);
      } finally {
        captureBusyRef.current = false;
      }
    }, 900);
    return () => {
      active = false;
      clearTimeout(timerId);
    };
  }, [displayId, isKioskStarted, pendingCapture]);

  // NO DISPLAY ID - SHOW SETUP INSTRUCTIONS
  if (!displayId) {
    return (
      <div className="min-h-screen bg-navy-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-3xl bg-navy-900 border border-white/10 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-600 to-cyan-400 flex items-center justify-center mx-auto shadow-glow">
            <Monitor className="w-8 h-8 text-white" />
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Kiosk Screen Setup
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-2 leading-relaxed">
              To launch an attendance display screen, pass a valid{' '}
              <code className="text-cyan-400 bg-white/5 px-1.5 py-0.5 rounded">displayId</code> parameter in the URL.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inputDisplayId.trim()) {
                navigate(`/office/qr-display?displayId=${encodeURIComponent(inputDisplayId.trim())}`);
              }
            }}
            className="space-y-3"
          >
            <input
              type="text"
              placeholder="Enter Display ID (e.g. DISP-...)"
              value={inputDisplayId}
              onChange={(e) => setInputDisplayId(e.target.value)}
              className="w-full rounded-xl bg-navy-950 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 text-center font-mono"
            />
            <Button type="submit" variant="primary" className="w-full shadow-glow">
              Connect Display Kiosk
            </Button>
          </form>

          <p className="text-[11px] text-gray-500">
            Registered displays and URLs are managed in Admin Portal &rarr; QR Displays.
          </p>
        </div>
      </div>
    );
  }

  // ACTIVE DISPLAY SCREEN
  return (
    <div className="min-h-screen bg-navy-950 text-white flex flex-col justify-between items-center p-4 sm:p-8 select-none relative">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP HEADER */}
      <header className="w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4 z-10">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
          {/* Back to Admin Dashboard Button (Always available to Admin with Password verification) */}
          <button
            type="button"
            onClick={() => {
              setAdminExitError(null);
              setAdminExitPassword('');
              setShowAdminExitForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-navy-900 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-cyan-500/40 transition-all text-xs font-semibold shadow-lg group cursor-pointer active:scale-95"
            title="Enter Admin Password to return to Admin Portal"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-cyan-400 flex items-center justify-center font-black text-white text-lg sm:text-xl shadow-glow">
              VX
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
                VORLDX
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Attendance System</p>
              <p className="text-xs uppercase tracking-widest text-cyan-400 font-semibold truncate max-w-[200px] sm:max-w-none">
                {displayName || 'ATTENDANCE KIOSK'}
              </p>
              {officeName && <p className="text-[11px] text-gray-300">{officeName}</p>}
              {displayLocation && <p className="text-[11px] text-gray-400">{displayLocation}</p>}
            </div>
          </div>
        </div>

        {/* Live Clock & Online Indicator */}
        <div className="flex items-center justify-center space-x-3 sm:space-x-4">
          <div className="text-center sm:text-right">
            <span className="text-lg sm:text-2xl font-mono font-bold text-white tracking-wider">
              {currentTime.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'Asia/Kolkata',
              })}
            </span>
            <p className="text-[10px] sm:text-[11px] text-gray-400 uppercase tracking-wider">
              {currentTime.toLocaleDateString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                timeZone: 'Asia/Kolkata',
              })}
            </p>
          </div>

          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border text-xs font-semibold ${
              Boolean(qrImageDataUrl) && !error
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-red-500/15 text-red-400 border-red-500/30'
            }`}
          >
            {qrImageDataUrl && !error ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>ONLINE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>OFFLINE</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-lg border border-white/10 p-2 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* CENTER: QR CODE DISPLAY CARD */}
      <main className="flex-1 flex flex-col items-center justify-center z-10 py-4 max-w-4xl w-full">
        <div className="w-full bg-navy-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col items-center text-center space-y-5">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Scan to Mark Attendance
            </h2>
            <p className="text-xs text-gray-400 max-w-xs">
              Open your VorldX employee scanner to check in or check out for today
            </p>
          </div>

          

          {!isKioskStarted ? (
            <div className="w-full space-y-4 rounded-2xl border border-white/10 bg-navy-950 p-6">
              <CameraOff className="mx-auto h-10 w-10 text-cyan-300" />
              <p className="text-sm text-gray-300">Start the kiosk and allow the tablet camera before attendance begins.</p>
              <Button variant="primary" className="w-full" onClick={startKiosk} disabled={isKioskStateLoading}>
                <Camera className="mr-2 h-4 w-4" />
                Start Attendance
              </Button>
              {error && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 font-medium">
                {error}
              </div>
            )}
            </div>
          ) : (
          <>
          <div className={`w-full flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 transition-all duration-300 ${
            isKioskLocked
              ? 'border-emerald-500/30 bg-emerald-950/30 shadow-lg'
              : 'border-white/10 bg-navy-950/90'
          }`}>
            <div className="flex items-center gap-3 text-left">
              <div className={`p-2 rounded-xl ${isKioskLocked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {isKioskLocked ? (
                  <LockKeyhole className="h-5 w-5" />
                ) : (
                  <UnlockKeyhole className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  {isKioskLocked ? 'Kiosk is Locked' : 'Kiosk is not locked'}
                  {isKioskLocked && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Protected
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400">
                  {isKioskLocked
                    ? 'Screen is locked. Only Admin can unlock with password.'
                    : 'Lock this screen to go full-screen and secure attendance scans.'}
                </p>
              </div>
            </div>
            {isKioskLocked ? (
              <button
                type="button"
                disabled={isLockUpdating}
                onClick={(e) => {
                  e.stopPropagation();
                  setError(null);
                  setShowUnlockForm(true);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <UnlockKeyhole className="h-4 w-4" />
                <span>Unlock Kiosk</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isLockUpdating}
                onClick={(e) => {
                  e.stopPropagation();
                  updateKioskLock(true);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-primary-600 hover:from-cyan-400 hover:to-primary-500 text-white font-bold text-xs shadow-glow transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LockKeyhole className="h-4 w-4" />
                <span>{isLockUpdating ? 'Locking…' : 'Lock Kiosk'}</span>
              </button>
            )}
          </div>
          {/* STEP 1: ONLY QR CODE DISPLAY (When waiting for employee scan) */}
          {!pendingCapture ? (
            <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto py-2 space-y-4">
              <div className="relative p-6 sm:p-7 bg-white rounded-3xl shadow-glow transition-all duration-300 transform hover:scale-[1.01]">
                {qrImageDataUrl && !error ? (
                  <img
                    src={qrImageDataUrl}
                    alt="Dynamic Office Attendance QR Code"
                    className="w-72 h-72 sm:w-80 sm:h-80 object-contain rounded-2xl select-none"
                    draggable={false}
                  />
                ) : error ? (
                  <div className="w-72 h-72 sm:w-80 sm:h-80 flex flex-col items-center justify-center bg-slate-100 rounded-2xl p-4 text-center space-y-3">
                    <AlertTriangle className="w-10 h-10 text-red-500" />
                    <p className="text-xs text-red-600 font-semibold">{error}</p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => fetchNewToken(displayId)}
                    >
                      Reconnect
                    </Button>
                  </div>
                ) : (
                  <div className="w-72 h-72 sm:w-80 sm:h-80 flex flex-col items-center justify-center bg-white rounded-2xl space-y-3">
                    <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                    <span className="text-xs font-bold text-navy-900 tracking-wide uppercase">
                      Generating Secure QR...
                    </span>
                  </div>
                )}
              </div>

              {/* Dynamic Refresh Countdown Pill */}
              <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-5 py-2.5 rounded-full shadow-lg">
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                />
                <span className="tracking-wide">Auto-Refreshes in {countdown}s</span>
              </div>
            </div>
          ) : (
            /* STEP 2: CAMERA CAPTURE STEP (Opens automatically only AFTER employee scans QR) */
            <div className="w-full max-w-lg mx-auto space-y-4 animate-fade-in">
              <div className="w-full overflow-hidden rounded-2xl border-2 border-cyan-400/50 bg-black shadow-2xl relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-video w-full object-cover"
                  aria-label="Live office tablet camera preview"
                />
                {/* Visual capture overlay */}
                <div className="absolute inset-0 border-2 border-cyan-400/40 rounded-2xl pointer-events-none animate-pulse" />
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-navy-950/90 text-xs text-gray-200 border-t border-white/10">
                  <span className="flex items-center gap-2 font-medium">
                    <Camera className="h-4 w-4 text-cyan-400 animate-pulse" />
                    Capturing Attendance Selfie
                  </span>
                  <span className="font-semibold text-emerald-400">{captureStatus}</span>
                </div>
              </div>
            </div>
          )}
          {pendingCapture && (
            <div className="w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-left">
              <p className="text-sm font-bold text-white">{captureStatus}</p>
              <p className="mt-1 text-xs text-cyan-100">
                {pendingCapture.employee?.name} · {pendingCapture.employee?.employeeId}
              </p>
            </div>
          )}
          {error && (
            <p className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          )}
          </>
          )}
        </div>
      </main>

      {/* Modal 1: Back to Admin Exit Verification Modal */}
      {showAdminExitForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleAdminExit}
            className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-navy-900 p-6 shadow-2xl"
          >
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <LockKeyhole className="w-5 h-5 text-cyan-400" />
                Admin Authentication
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                Enter your Admin password to exit kiosk and return to Admin Dashboard.
              </p>
            </div>
            <input
              type="password"
              autoComplete="current-password"
              value={adminExitPassword}
              onChange={(e) => setAdminExitPassword(e.target.value)}
              required
              autoFocus
              placeholder="Enter Admin Password"
              className="w-full rounded-xl border border-white/10 bg-navy-950 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            {adminExitError && (
              <p className="text-xs text-red-300 font-medium">{adminExitError}</p>
            )}
            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                disabled={isAdminVerifying}
                onClick={() => {
                  setShowAdminExitForm(false);
                  setAdminExitPassword('');
                  setAdminExitError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1 font-bold"
                disabled={isAdminVerifying || !adminExitPassword}
              >
                {isAdminVerifying ? 'Verifying…' : 'Authenticate'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 1.5: Minimize / Exit Fullscreen Password Modal */}
      {showFullscreenExitForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleFullscreenExit}
            className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-navy-900 p-6 shadow-2xl"
          >
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Minimize className="w-5 h-5 text-cyan-400" />
                Exit Fullscreen / Minimize
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                Confirm your Admin password to minimize screen and exit fullscreen mode.
              </p>
            </div>
            <input
              type="password"
              autoComplete="current-password"
              value={fullscreenExitPassword}
              onChange={(e) => setFullscreenExitPassword(e.target.value)}
              required
              autoFocus
              placeholder="Enter Admin Password"
              className="w-full rounded-xl border border-white/10 bg-navy-950 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            {fullscreenExitError && (
              <p className="text-xs text-red-300 font-medium">{fullscreenExitError}</p>
            )}
            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                disabled={isFullscreenVerifying}
                onClick={() => {
                  setShowFullscreenExitForm(false);
                  setFullscreenExitPassword('');
                  setFullscreenExitError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1 font-bold"
                disabled={isFullscreenVerifying || !fullscreenExitPassword}
              >
                {isFullscreenVerifying ? 'Verifying…' : 'Minimize'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 2: Unlock Kiosk Modal */}
      {showUnlockForm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              updateKioskLock(false, unlockPassword);
            }}
            className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-navy-900 p-6 shadow-2xl"
          >
            <div>
              <h2 className="text-lg font-bold text-white">Unlock attendance kiosk</h2>
              <p className="mt-1 text-sm text-gray-400">Confirm your admin password to leave kiosk mode.</p>
            </div>
            <input
              type="password"
              autoComplete="current-password"
              value={unlockPassword}
              onChange={(event) => setUnlockPassword(event.target.value)}
              required
              autoFocus
              aria-label="Admin password"
              placeholder="Admin password"
              className="w-full rounded-xl border border-white/10 bg-navy-950 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            {error && <p className="text-xs text-red-300">{error}</p>}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                disabled={isLockUpdating}
                onClick={() => { setShowUnlockForm(false); setUnlockPassword(''); }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1" disabled={isLockUpdating || !unlockPassword}>
                {isLockUpdating ? 'Verifying…' : 'Unlock'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* BOTTOM FOOTER */}
      <footer className="w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 pt-4 border-t border-white/5 z-10 gap-2">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>VorldX High-Security Rotating Token Protection</span>
        </div>
        <span className="font-mono text-[11px] text-gray-600">
          Kiosk Display ID: {displayId}
        </span>
      </footer>
    </div>
  );
};

export default QRDisplayPage;
