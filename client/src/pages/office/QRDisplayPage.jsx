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
  const [isKioskStarted, setIsKioskStarted] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('Not started');
  const [connectionStatus, setConnectionStatus] = useState('Offline');
  const [pendingCapture, setPendingCapture] = useState(null);
  const [captureStatus, setCaptureStatus] = useState('Waiting for employee');
  const [displayName, setDisplayName] = useState('');
  const [officeName, setOfficeName] = useState('');
  const [displayLocation, setDisplayLocation] = useState('');
  const [isKioskLocked, setIsKioskLocked] = useState(false);
  const [isKioskStateLoading, setIsKioskStateLoading] = useState(Boolean(displayId));
  const [isLockUpdating, setIsLockUpdating] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockForm, setShowUnlockForm] = useState(false);

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
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (fullscreenError) {
      setError(fullscreenError.message || 'Fullscreen mode is not available in this browser.');
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
    preventBackNavigation();
    window.addEventListener('popstate', preventBackNavigation);
    return () => window.removeEventListener('popstate', preventBackNavigation);
  }, [isKioskLocked]);

  const updateKioskLock = async (isLocked, password = '') => {
    setIsLockUpdating(true);
    setError(null);
    try {
      const response = await qrDisplayService.updateKioskLock(displayId, isLocked, password);
      const data = response.data || response;
      setIsKioskLocked(Boolean(data.isKioskLocked));
      setShowUnlockForm(false);
      setUnlockPassword('');
      if (isLocked && document.documentElement.requestFullscreen) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          setError('Kiosk is locked, but full-screen mode was blocked by the browser. Enable browser/OS kiosk mode for stronger protection.');
        }
      } else if (!isLocked && document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (lockError) {
      setError(lockError.message || 'Unable to update kiosk lock state.');
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

  const startKiosk = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('Unsupported');
      setError('This browser does not support tablet camera capture. Use a current browser over HTTPS.');
      return;
    }
    try {
      setError(null);
      setCameraStatus('Requesting permission');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          setCameraStatus('Interrupted');
          setConnectionStatus('Offline');
          setError('Tablet camera stream was interrupted. Restart the kiosk before accepting attendance.');
          setQrImageDataUrl('');
          setIsKioskStarted(false);
          cameraStreamRef.current?.getTracks().forEach((activeTrack) => activeTrack.stop());
          cameraStreamRef.current = null;
        });
      });
      setCameraStatus('Initializing');
      setConnectionStatus('Connecting');
      setIsKioskStarted(true);
    } catch (cameraError) {
      setCameraStatus('Unavailable');
      setError(cameraError.message || 'Tablet camera permission was denied or the camera is unavailable.');
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    }
  };

  useEffect(() => {
    if (!isKioskStarted || !cameraStreamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = cameraStreamRef.current;
    videoRef.current.play().then(() => {
      setCameraStatus('Ready');
    }).catch((playError) => {
      setCameraStatus('Unavailable');
      setError(playError.message || 'The tablet camera preview could not start.');
      setIsKioskStarted(false);
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    });
  }, [isKioskStarted]);

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
      <header className="w-full max-w-4xl flex items-center justify-between z-10">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-cyan-400 flex items-center justify-center font-black text-white text-xl shadow-glow">
            VX
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
              VORLDX
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Attendance System</p>
            <p className="text-xs uppercase tracking-widest text-cyan-400 font-semibold">
              {displayName || 'ATTENDANCE KIOSK'}
            </p>
            {officeName && <p className="text-[11px] text-gray-300">{officeName}</p>}
            {displayLocation && <p className="text-[11px] text-gray-400">{displayLocation}</p>}
          </div>
        </div>

        {/* Live Clock & Online Indicator */}
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <span className="text-xl sm:text-2xl font-mono font-bold text-white tracking-wider">
              {currentTime.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'Asia/Kolkata',
              })}
            </span>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider">
              {currentTime.toLocaleDateString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                timeZone: 'Asia/Kolkata',
              })}
            </p>
          </div>

          <div
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
              connectionStatus === 'Connected' && cameraStatus === 'Ready' && Boolean(qrImageDataUrl) && !error
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-red-500/15 text-red-400 border-red-500/30'
            }`}
          >
            {connectionStatus === 'Connected' && cameraStatus === 'Ready' && qrImageDataUrl && !error ? (
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

          {isKioskLocked && (
            <div className="w-full flex items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-left">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                <LockKeyhole className="h-4 w-4 shrink-0" />
                <span>Kiosk locked · QR keeps rotating</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={isLockUpdating}
                onClick={() => setShowUnlockForm(true)}
              >
                <UnlockKeyhole className="mr-2 h-4 w-4" />
                Unlock
              </Button>
            </div>
          )}

          {!isKioskStarted ? (
            <div className="w-full space-y-4 rounded-2xl border border-white/10 bg-navy-950 p-6">
              <CameraOff className="mx-auto h-10 w-10 text-cyan-300" />
              <p className="text-sm text-gray-300">Start the kiosk and allow the tablet camera before attendance begins.</p>
              <Button variant="primary" className="w-full" onClick={startKiosk} disabled={isKioskStateLoading}>
                <Camera className="mr-2 h-4 w-4" />
                Start Attendance
              </Button>
              {error && <p className="text-xs text-red-300">{error}</p>}
            </div>
          ) : (
          <>
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-white/10 bg-navy-950/80 px-4 py-3">
            <div className="flex items-center gap-2 text-left">
              {isKioskLocked ? (
                <LockKeyhole className="h-4 w-4 text-emerald-300" />
              ) : (
                <UnlockKeyhole className="h-4 w-4 text-amber-300" />
              )}
              <div>
                <p className="text-sm font-semibold text-white">
                  {isKioskLocked ? 'Attendance kiosk is locked' : 'Kiosk is not locked'}
                </p>
                <p className="text-xs text-gray-400">
                  {isKioskLocked ? 'Employees can scan; this tablet stays on the rotating QR.' : 'Lock this screen to enable employee attendance scans.'}
                </p>
              </div>
            </div>
            {!isKioskLocked && (
              <Button
                variant="primary"
                size="sm"
                disabled={isLockUpdating || isKioskStateLoading || cameraStatus !== 'Ready'}
                onClick={() => updateKioskLock(true)}
              >
                <LockKeyhole className="mr-2 h-4 w-4" />
                {isLockUpdating ? 'Locking…' : 'Lock Kiosk'}
              </Button>
            )}
          </div>
          <div className="grid w-full items-center gap-6 md:grid-cols-2">
          <div className="flex flex-col items-center gap-4">
          {/* QR Code Frame with White Background */}
          <div className="relative p-5 bg-white rounded-3xl shadow-glow transition-all duration-300">
            {qrImageDataUrl && !error ? (
              <img
                src={qrImageDataUrl}
                alt="Dynamic Office Attendance QR Code"
                className="w-64 h-64 sm:w-72 sm:h-72 object-contain rounded-xl select-none"
                draggable={false}
              />
            ) : isLoading || connectionStatus !== 'Connected' || cameraStatus !== 'Ready' ? (
              <div className="w-64 h-64 sm:w-72 sm:h-72 flex flex-col items-center justify-center bg-white rounded-xl space-y-3">
                <div className="w-10 h-10 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" />
                <span className="text-xs font-bold text-navy-900">
                  Generating Secure QR...
                </span>
              </div>
            ) : (
              <div className="w-64 h-64 sm:w-72 sm:h-72 flex flex-col items-center justify-center bg-slate-100 rounded-xl p-4 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-red-500" />
                <p className="text-xs text-red-600 font-semibold">{error}</p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => fetchNewToken(displayId)}
                >
                  Reconnect
                </Button>
              </div>
            )}
          </div>

          {/* Dynamic Refresh Countdown Pill */}
          <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 px-4 py-2 rounded-full">
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
            />
            <span>⟳ Refreshes in {countdown}s</span>
          </div>
          </div>
          <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full object-cover"
              aria-label="Live office tablet camera preview"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-gray-300">
              <span className="flex items-center gap-2">
                {cameraStatus === 'Ready' ? <Camera className="h-4 w-4 text-emerald-400" /> : <CameraOff className="h-4 w-4 text-amber-400" />}
                Camera: {cameraStatus}
              </span>
              <span>{captureStatus}</span>
            </div>
          </div>
          </div>
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
