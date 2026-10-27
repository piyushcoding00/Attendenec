import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ShieldCheck,
  MapPin,
  QrCode,
  ScanLine,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { attendanceService } from '../../services/api';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../../context/AuthContext';
import { formatTime, formatDuration } from '../../utils/formatters';
import Button from '../../components/ui/Button';

// ─── QR SCANNING WINDOW (seconds) ──────────────────────────────────────────
const QR_SCAN_WINDOW_SECONDS = 30;

// ─── STEP ENUM ──────────────────────────────────────────────────────────────
const STEP = {
  CHECKING: 'checking',
  ALREADY_IN: 'already_in',
  QR_SCANNER: 'qr_scanner',
  QR_EXPIRED: 'qr_expired',
  WAITING_FOR_KIOSK: 'waiting_for_kiosk',
  SUCCESS: 'success',
};

export const ScannerPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // ── Global state
  const [step, setStep] = useState(STEP.CHECKING);
  const [errorMessage, setErrorMessage] = useState(null);

  // ── Today's record (for already-in state)
  const [todayRecord, setTodayRecord] = useState(null);

  // ── Geofence policy
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);

  // ── QR Scanner state
  const [scanTimeLeft, setScanTimeLeft] = useState(QR_SCAN_WINDOW_SECONDS);
  const [captureRequestId, setCaptureRequestId] = useState(null);
  const qrVideoRef = useRef(null);
  const qrStreamRef = useRef(null);
  const qrFallbackScannerRef = useRef(null);
  const qrStartInProgressRef = useRef(false);
  const qrTimerRef = useRef(null);
  const qrScanIntervalRef = useRef(null);
  const qrValidationRef = useRef(false);
  const qrActiveRef = useRef(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState(null);

  const getFreshLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GPS is not supported in this browser. Use a device with location services enabled.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp).toISOString(),
        }),
        (error) => reject(new Error(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission is blocked. Allow location access in your browser settings, then retry.'
            : 'Could not get a fresh GPS fix. Move to an area with a clearer signal and retry.'
        )),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });

  async function beginCaptureRequest(token) {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const locationFix = await getFreshLocation();
      setUserLocation(locationFix);
      setLocationError(null);
      const response = await attendanceService.requestTabletCapture(token, locationFix);
      const data = response.data || response;
      setCaptureRequestId(data.requestId);
      setStep(STEP.WAITING_FOR_KIOSK);
    } catch (error) {
      setUserLocation(null);
      setLocationError(error.message || 'GPS verification failed.');
      setErrorMessage(error.message || 'Unable to request attendance capture.');
      setStep(STEP.QR_EXPIRED);
    } finally {
      setIsProcessing(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. On mount: check today's record + handle URL QR token param
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      // Check for ?qr_token= in URL (employee scanned QR from second device)
      const params = new URLSearchParams(location.search);
      const urlToken = params.get('qr_token') || params.get('token');

      try {
        // a) Check today's record
        const todayRes = await attendanceService.getToday().catch(() => null);
        const rec = todayRes && 'data' in todayRes ? todayRes.data : todayRes;

        if (mounted && rec?.checkIn && rec?.checkOut) {
          setTodayRecord(rec);
          setStep(STEP.ALREADY_IN);
          return;
        }

        if (mounted && rec?.checkIn) setTodayRecord(rec);
        if (urlToken && mounted) {
          window.history.replaceState({}, document.title, location.pathname);
          await beginCaptureRequest(urlToken);
          return;
        }

        if (mounted && rec?.checkIn) {
          setStep(STEP.ALREADY_IN);
          return;
        }

        if (mounted) setStep(STEP.QR_SCANNER);
      } catch {
        if (mounted) setStep(STEP.QR_SCANNER);
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  // 3. QR Scanner: start camera + scan loop + 30s countdown
  // ─────────────────────────────────────────────────────────────────────────
  const startQRScanner = useCallback(async () => {
    if (qrStartInProgressRef.current) return;
    qrStartInProgressRef.current = true;
    setScanTimeLeft(QR_SCAN_WINDOW_SECONDS);
    setErrorMessage(null);
    qrValidationRef.current = false;

    try {
      qrTimerRef.current = setInterval(() => {
        setScanTimeLeft((timeLeft) => {
          if (timeLeft <= 1) {
            clearInterval(qrTimerRef.current);
            stopQRCamera();
            setStep(STEP.QR_EXPIRED);
            return 0;
          }
          return timeLeft - 1;
        });
      }, 1000);

      if (!('BarcodeDetector' in window)) {
        const scanner = new Html5Qrcode('employee-qr-reader', { verbose: false });
        qrFallbackScannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          handleQRScanned,
          () => {}
        );
        if (!qrActiveRef.current) stopQRCamera();
        return;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (!qrActiveRef.current) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }
      qrStreamRef.current = mediaStream;
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = mediaStream;
      }

      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      qrScanIntervalRef.current = setInterval(async () => {
        if (!qrVideoRef.current || qrVideoRef.current.readyState < 2) return;
        try {
          const codes = await detector.detect(qrVideoRef.current);
          if (codes.length > 0) handleQRScanned(codes[0].rawValue);
        } catch (error) {
          console.error('Unable to decode QR frame:', error);
        }
      }, 250);
    } catch (err) {
      setErrorMessage(err.message || 'Camera access denied. Please allow camera permission to scan QR.');
      setStep(STEP.QR_EXPIRED);
    } finally {
      qrStartInProgressRef.current = false;
    }
  }, []);

  const stopQRCamera = () => {
    clearInterval(qrTimerRef.current);
    clearInterval(qrScanIntervalRef.current);
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach((t) => t.stop());
      qrStreamRef.current = null;
    }
    if (qrFallbackScannerRef.current) {
      const scanner = qrFallbackScannerRef.current;
      qrFallbackScannerRef.current = null;
      const stopping = scanner.isScanning ? scanner.stop() : Promise.resolve();
      stopping.then(() => scanner.clear())
        .catch((error) => console.error('Unable to stop QR camera:', error));
    }
  };

  useEffect(() => {
    if (step === STEP.QR_SCANNER) {
      qrActiveRef.current = true;
      startQRScanner();
    }
    return () => {
      if (step === STEP.QR_SCANNER) {
        qrActiveRef.current = false;
        stopQRCamera();
      }
    };
  }, [step, startQRScanner]);

  // Sync QR video element to stream
  useEffect(() => {
    if (qrVideoRef.current && qrStreamRef.current) {
      qrVideoRef.current.srcObject = qrStreamRef.current;
    }
  }, [step]);

  useEffect(() => {
    if (![STEP.QR_SCANNER, STEP.WAITING_FOR_KIOSK].includes(step)) return undefined;
    const keepAttendanceFlowOpen = () => {
      window.history.pushState({ attendanceFlow: true }, '', window.location.href);
    };
    keepAttendanceFlowOpen();
    window.addEventListener('popstate', keepAttendanceFlowOpen);
    return () => window.removeEventListener('popstate', keepAttendanceFlowOpen);
  }, [step]);

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Handle QR code scanned
  // ─────────────────────────────────────────────────────────────────────────
  const handleQRScanned = useCallback(async (rawValue) => {
    if (qrValidationRef.current) return;
    qrValidationRef.current = true;
    stopQRCamera();
    clearInterval(qrTimerRef.current);
    clearInterval(qrScanIntervalRef.current);

    // Extract token from URL or raw string
    let token = rawValue;
    try {
      const url = new URL(rawValue);
      token = url.searchParams.get('token') || url.searchParams.get('t') || rawValue;
    } catch {
      // rawValue is already a plain token
    }

    try {
      await beginCaptureRequest(token);
    } catch (err) {
      qrValidationRef.current = false;
      setErrorMessage(err.message || 'This office QR code is expired or invalid. Scan the current kiosk QR.');
      setStep(STEP.QR_EXPIRED);
    }
  }, []);

  useEffect(() => {
    if (step !== STEP.WAITING_FOR_KIOSK || !captureRequestId) return undefined;
    let active = true;
    let requestInFlight = false;
    const pollStatus = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const response = await attendanceService.getCaptureStatus(captureRequestId);
        const data = response.data || response;
        if (!active) return;
        if (data.status === 'completed') {
          setAttendanceResult({
            action: data.action,
            record: data.record,
            officeName: data.officeName,
            serverTime: data.serverTime,
            verification: data.verification,
            message: 'Attendance Marked Successfully'
          });
          setStep(STEP.SUCCESS);
        } else if (['failed', 'expired'].includes(data.status)) {
          setErrorMessage(data.failureReason || 'Tablet capture failed. Scan the current kiosk QR and retry.');
          setStep(STEP.QR_EXPIRED);
        }
      } catch (error) {
        if (active) setErrorMessage(error.message || 'Connection to the attendance service was interrupted.');
      } finally {
        requestInFlight = false;
      }
    };
    pollStatus();
    const intervalId = setInterval(pollStatus, 1500);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [step, captureRequestId]);

  useEffect(() => {
    if (step !== STEP.SUCCESS || attendanceResult?.action !== 'check_in') return undefined;
    const timerId = setTimeout(() => {
      setAttendanceResult(null);
      setCaptureRequestId(null);
      setErrorMessage(null);
      setLocationError(null);
      setUserLocation(null);
      qrValidationRef.current = false;
      setStep(STEP.QR_SCANNER);
    }, 3000);
    return () => clearTimeout(timerId);
  }, [step, attendanceResult]);

  // 8. Check-out requires the same QR and location verification workflow.
  const handleCheckOut = () => {
    setErrorMessage(null);
    setStep(STEP.QR_SCANNER);
  };

  const cancelCaptureRequest = async () => {
    if (!captureRequestId) {
      navigate('/employee/home');
      return;
    }
    try {
      await attendanceService.cancelCapture(captureRequestId);
      navigate('/employee/home');
    } catch (error) {
      setErrorMessage(error.message || 'The tablet has already started capture. Wait for the result.');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-md mx-auto space-y-5">
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between">
        {[STEP.QR_SCANNER, STEP.WAITING_FOR_KIOSK].includes(step) ? (
          <div className="w-9" aria-hidden="true" />
        ) : (
          <button
            type="button"
            onClick={() => { stopQRCamera(); navigate('/employee/home'); }}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Back to attendance home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          {step === STEP.QR_SCANNER ? (
            <><ScanLine className="w-5 h-5 text-cyan-400" /><span>Scan Office QR</span></>
          ) : step === STEP.WAITING_FOR_KIOSK || step === STEP.CHECKING ? (
            <><Camera className="w-5 h-5 text-cyan-400" /><span>Mark Attendance</span></>
          ) : (
            <><ShieldCheck className="w-5 h-5 text-emerald-400" /><span>Attendance</span></>
          )}
        </h2>
        <div className="w-9" />
      </div>

      {/* ── Location Status Pill ── */}
      {step !== STEP.SUCCESS && (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border w-fit mx-auto ${userLocation && userLocation.accuracy <= 50 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : locationError ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
          {userLocation && userLocation.accuracy <= 50 ? <Wifi className="w-3.5 h-3.5" /> : locationError ? <WifiOff className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5 animate-pulse" />}
          {userLocation && userLocation.accuracy <= 50
            ? `GPS accepted (±${Math.round(userLocation.accuracy)}m)`
            : userLocation
              ? `GPS accuracy too low (±${Math.round(userLocation.accuracy)}m)`
              : locationError
                ? 'GPS Unavailable'
                : 'Getting Location…'}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STEP: CHECKING (initial loading)
      ════════════════════════════════════════════════════════════════ */}
      {step === STEP.CHECKING && (
        <div className="p-10 rounded-3xl bg-navy-900 border border-white/10 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-12 h-12 border-4 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-sm text-gray-300 font-medium">Checking attendance status…</p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STEP: ALREADY CHECKED IN
      ════════════════════════════════════════════════════════════════ */}
      {step === STEP.ALREADY_IN && (
        <div className="p-8 rounded-3xl bg-navy-900 border border-emerald-500/30 text-center space-y-5 animate-fade-in shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-white">
              {todayRecord?.checkOut ? 'Day Completed' : 'Already Checked In'}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {todayRecord?.checkOut
                ? 'Aapki attendance aur checkout complete ho chuki hai.'
                : 'Aapne aaj check-in kar liya hai.'}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs space-y-2 text-left">
            <div className="flex justify-between">
              <span className="text-gray-400">Check-In:</span>
              <span className="font-mono text-cyan-400 font-bold">{formatTime(todayRecord?.checkIn)}</span>
            </div>
            {todayRecord?.checkOut && (
              <div className="flex justify-between">
                <span className="text-gray-400">Check-Out:</span>
                <span className="font-mono text-emerald-400 font-bold">{formatTime(todayRecord?.checkOut)}</span>
              </div>
            )}
            {todayRecord?.workingMinutes > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Duration:</span>
                <span className="font-mono text-white font-bold">{formatDuration(todayRecord?.workingMinutes)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span className="capitalize font-bold text-emerald-400">{todayRecord?.status || 'present'}</span>
            </div>
          </div>
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
          <div className="space-y-3 pt-1">
            {!todayRecord?.checkOut && (
              <Button
                variant="danger"
                size="lg"
                onClick={handleCheckOut}
                className="w-full font-bold"
              >
                Check Out Now
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={() => navigate('/employee/home')} className="w-full">
              Back to Home
            </Button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STEP: QR SCANNER (30s window)
      ════════════════════════════════════════════════════════════════ */}
      {step === STEP.QR_SCANNER && (
        <div className="space-y-4 animate-fade-in">
          {/* Timer ring + instruction */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30">
              <Clock className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span className="text-sm font-bold text-white">
                {scanTimeLeft}s remaining
              </span>
            </div>
            {attendanceResult?.verification?.locationVerified && (
              <div className="flex justify-between">
                <span className="text-gray-400">GPS check:</span>
                <span className="text-emerald-400">
                  {Math.round(attendanceResult.verification.distanceMeters)}m · ±{Math.round(attendanceResult.verification.gpsAccuracyMeters)}m
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Identity match:</span>
              <span className="text-gray-300">Not enabled</span>
            </div>
            <p className="text-xs text-gray-400">Point your camera at the office QR code screen</p>
          </div>

          {/* Countdown progress bar */}
          <div className="w-full h-1.5 bg-navy-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-primary-500 transition-all duration-1000"
              style={{ width: `${(scanTimeLeft / QR_SCAN_WINDOW_SECONDS) * 100}%` }}
            />
          </div>

          {/* QR Camera Viewfinder */}
          <div className="relative rounded-3xl overflow-hidden bg-black aspect-square border-2 border-cyan-500/30 shadow-2xl">
            {'BarcodeDetector' in window ? (
              <video
                ref={qrVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div id="employee-qr-reader" className="absolute inset-0" />
            )}

            {/* Scan overlay frame */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Corner brackets */}
              <div className="relative w-56 h-56">
                <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg" />
                <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg" />
                <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg" />
                <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-400 rounded-br-lg" />
                {/* Animated scan line */}
                <div className="absolute inset-0 overflow-hidden rounded-lg">
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80"
                    style={{
                      animation: 'scanLine 2s linear infinite',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Scanning label */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
              <span className="px-3 py-1 rounded-full bg-black/70 text-cyan-400 text-xs font-semibold flex items-center gap-1.5">
                <ScanLine className="w-3.5 h-3.5" />
                Scanning for QR Code…
              </span>
            </div>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Info note */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-gray-400 flex items-start gap-2.5">
            <QrCode className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p>
              Scan the active office kiosk QR. Attendance requires a fresh GPS fix within 50 meters. The office tablet captures the attendance photo.
            </p>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STEP: QR EXPIRED (30s timed out)
      ════════════════════════════════════════════════════════════════ */}
      {step === STEP.QR_EXPIRED && (
        <div className="p-8 rounded-3xl bg-navy-900 border border-amber-500/30 text-center space-y-5 animate-fade-in shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-white">Attendance Verification Needs a Retry</h3>
            <p className="text-sm text-gray-400 mt-1">
              The QR or a required verification step expired or failed. Scan the current office kiosk QR to try again.
            </p>
          </div>
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
          <div className="space-y-3">
            <Button
              variant="primary"
              size="lg"
              className="w-full shadow-glow font-bold"
              onClick={() => { setErrorMessage(null); setStep(STEP.QR_SCANNER); }}
            >
              <ScanLine className="w-4 h-4 mr-2" />
              Retry QR Scan (30s)
            </Button>
            <Button variant="ghost" size="sm" className="w-full text-gray-500" onClick={() => navigate('/employee/home')}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {step === STEP.WAITING_FOR_KIOSK && (
        <div className="rounded-3xl border border-cyan-400/20 bg-navy-900 p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300">
            <Camera className="h-8 w-8 animate-pulse" />
          </div>
          <h3 className="mt-5 text-xl font-bold text-white">Waiting for the office tablet</h3>
          <p className="mt-2 text-sm text-gray-400">
            Your QR and GPS have been sent securely. The authorized tablet camera will capture your attendance photo automatically.
          </p>
          {isProcessing && <p className="mt-4 text-xs text-cyan-300">Requesting a fresh GPS fix…</p>}
          {errorMessage && <p className="mt-4 text-xs text-amber-300">{errorMessage}</p>}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STEP: SUCCESS
      ════════════════════════════════════════════════════════════════ */}
      {step === STEP.SUCCESS && attendanceResult && (
        <div className="p-8 rounded-3xl bg-navy-900 border border-emerald-500/30 text-center space-y-5 animate-fade-in shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-glow">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-white">
              Attendance Marked Successfully
            </h3>
            <p className="text-sm text-emerald-300 font-medium mt-1">
              {attendanceResult.action === 'check_in'
                ? 'Attendance verified & marked on Admin Portal'
                : 'Check-out recorded successfully'}
            </p>
            {attendanceResult.action === 'check_in' && (
              <p className="text-xs text-cyan-300 mt-2">Opening the scanner again for check-out…</p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs space-y-2 text-left">
            <div className="flex justify-between">
              <span className="text-gray-400">Employee:</span>
              <span className="font-bold text-white">{user?.name || 'Employee'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Server time:</span>
              <span className="font-mono text-cyan-400 font-bold">
                {formatTime(attendanceResult.serverTime || (
                  attendanceResult.action === 'check_in'
                    ? attendanceResult.record?.checkIn
                    : attendanceResult.record?.checkOut
                ))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Office:</span>
              <span className="text-white">{attendanceResult.officeName || 'Configured office'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Date:</span>
              <span className="text-white">
                {new Date(attendanceResult.serverTime).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Employee ID:</span>
              <span className="font-mono text-white font-bold">
                {user?.employeeId || attendanceResult.record?.employee?.employeeId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span className="capitalize font-bold text-emerald-400">
                {attendanceResult.record?.status || 'present'}
              </span>
            </div>
            {attendanceResult.action === 'check_out' && (attendanceResult.record?.workingMinutes || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Duration:</span>
                <span className="font-mono text-white font-bold">
                  {formatDuration(attendanceResult.record?.workingMinutes)}
                </span>
              </div>
            )}
            {userLocation && (
              <div className="flex justify-between">
                <span className="text-gray-400">Location:</span>
                <span className="text-emerald-400 font-bold">✓ Within Office Zone</span>
              </div>
            )}
          </div>

          {attendanceResult.action !== 'check_in' && (
            <Button variant="primary" size="lg" onClick={() => navigate('/employee/home')} className="w-full shadow-glow">
              Back to Dashboard
            </Button>
          )}
        </div>
      )}

      {/* ── Scan line animation keyframes ── */}
      <style>{`
        @keyframes scanLine {
          0% { top: 0; opacity: 0.8; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default ScannerPage;
