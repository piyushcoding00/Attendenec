import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Clock,
  Home,
  AlertTriangle,
  CheckCircle,
  Save,
  RotateCcw,
  Edit,
  MapPin,
  Navigation,
  Compass,
  Link as LinkIcon,
  ExternalLink,
} from 'lucide-react';
import { policyService } from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';

export const PoliciesPage = () => {
  const [policy, setPolicy] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [formData, setFormData] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchPolicy = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await policyService.getAll();
      const p = res.data?.policy || res.policy;
      const s = res.data?.shifts || res.shifts || [];
      setPolicy(p);
      setShifts(s);
      setFormData({
        companyTimezone: p?.companyTimezone || 'Asia/Kolkata',
        qrTokenExpiresSeconds: p?.qrTokenExpiresSeconds || 30,
        qrRefreshIntervalSeconds: p?.qrRefreshIntervalSeconds || 30,
        gpsAccuracyThresholdMeters: p?.gpsAccuracyThresholdMeters || 20,
        wfhEnabled: Boolean(p?.wfhEnabled),
        wfhMaxDaysPerMonth: p?.wfhMaxDaysPerMonth || 8,
        wfhRequiresApproval: Boolean(p?.wfhRequiresApproval),
        wfhAdvanceNoticeDays: p?.wfhAdvanceNoticeDays || 1,
        wfhEligibleWorkTypes: p?.wfhEligibleWorkTypes || ['remote', 'hybrid'],
        halfDayDurationMinutes: p?.halfDayDurationMinutes || 240,
        fullDayDurationMinutes: p?.fullDayDurationMinutes || 480,
        officeLocation: {
          latitude: p?.officeLocation?.latitude ?? '',
          longitude: p?.officeLocation?.longitude ?? '',
          address: p?.officeLocation?.address || '',
          locationLink: p?.officeLocation?.locationLink || '',
          radiusMeters: 50,
          isEnabled: true,
        },
      });
    } catch (err) {
      console.error('Failed to load policies:', err);
      setError(err.message || 'Unable to retrieve attendance policies');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, []);

  const handleCancel = () => {
    if (policy) {
      setFormData({
        companyTimezone: policy.companyTimezone || 'Asia/Kolkata',
        qrTokenExpiresSeconds: policy.qrTokenExpiresSeconds || 30,
        qrRefreshIntervalSeconds: policy.qrRefreshIntervalSeconds || 30,
        gpsAccuracyThresholdMeters: policy.gpsAccuracyThresholdMeters || 20,
        wfhEnabled: Boolean(policy.wfhEnabled),
        wfhMaxDaysPerMonth: policy.wfhMaxDaysPerMonth || 8,
        wfhRequiresApproval: Boolean(policy.wfhRequiresApproval),
        wfhAdvanceNoticeDays: policy.wfhAdvanceNoticeDays || 1,
        wfhEligibleWorkTypes: policy.wfhEligibleWorkTypes || ['remote', 'hybrid'],
        halfDayDurationMinutes: policy.halfDayDurationMinutes || 240,
        fullDayDurationMinutes: policy.fullDayDurationMinutes || 480,
        officeLocation: {
          latitude: policy.officeLocation?.latitude ?? '',
          longitude: policy.officeLocation?.longitude ?? '',
          address: policy.officeLocation?.address || '',
          locationLink: policy.officeLocation?.locationLink || '',
          radiusMeters: 50,
          isEnabled: true,
        },
      });
    }
    setIsEditing(false);
  };

  /**
   * Helper to parse coordinates from Google Maps URL, DMS notation, or raw coordinates
   */
  const handleParseMapLink = (urlOrCoord) => {
    if (!urlOrCoord || typeof urlOrCoord !== 'string') return;
    const str = urlOrCoord.trim();

    // 0. Matches Degrees Minutes Seconds (DMS) like 26°46'42.6"N 81°01'31.1"E
    const dmsRegex = /([0-9.]+)[^0-9NSEW]+([0-9.]+)[^0-9NSEW]+([0-9.]+)[^0-9NSEW]*([NSEW])/gi;
    const dmsMatches = [...str.matchAll(dmsRegex)];
    if (dmsMatches.length >= 2) {
      const toDec = (deg, min, sec, dir) => {
        let dec = parseFloat(deg) + parseFloat(min) / 60 + parseFloat(sec) / 3600;
        if (/^[SW]$/i.test(dir)) dec = -dec;
        return dec.toFixed(6);
      };
      setFormData((prev) => ({
        ...prev,
        officeLocation: {
          ...prev.officeLocation,
          latitude: toDec(dmsMatches[0][1], dmsMatches[0][2], dmsMatches[0][3], dmsMatches[0][4]),
          longitude: toDec(dmsMatches[1][1], dmsMatches[1][2], dmsMatches[1][3], dmsMatches[1][4]),
          isEnabled: true,
        },
      }));
      return;
    }

    // 1. Matches @28.6139,77.2090 or @28.6139,77.2090,17z
    const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      setFormData((prev) => ({
        ...prev,
        officeLocation: {
          ...prev.officeLocation,
          latitude: atMatch[1],
          longitude: atMatch[2],
          isEnabled: true,
        },
      }));
      return;
    }

    // 2. Matches q=28.6139,77.2090 or ll=28.6139,77.2090 or query=28.6139,77.2090
    const qMatch = str.match(/[?&](?:q|ll|query|loc|center)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qMatch) {
      setFormData((prev) => ({
        ...prev,
        officeLocation: {
          ...prev.officeLocation,
          latitude: qMatch[1],
          longitude: qMatch[2],
          isEnabled: true,
        },
      }));
      return;
    }

    // 3. Matches destination=28.6139,77.2090
    const destMatch = str.match(/(?:destination|daddr)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (destMatch) {
      setFormData((prev) => ({
        ...prev,
        officeLocation: {
          ...prev.officeLocation,
          latitude: destMatch[1],
          longitude: destMatch[2],
          isEnabled: true,
        },
      }));
      return;
    }

    // 4. Matches plain lat, lng like "28.6139, 77.2090" or "28.6139 77.2090"
    const plainMatch = str.match(/^(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)$/);
    if (plainMatch) {
      setFormData((prev) => ({
        ...prev,
        officeLocation: {
          ...prev.officeLocation,
          latitude: plainMatch[1],
          longitude: plainMatch[2],
          isEnabled: true,
        },
      }));
      return;
    }

    // 5. Matches any two floating point numbers in the text e.g. embedded anywhere
    const genericFloats = str.match(/(-?\d+\.\d{3,})[\s,]+(-?\d+\.\d{3,})/);
    if (genericFloats) {
      setFormData((prev) => ({
        ...prev,
        officeLocation: {
          ...prev.officeLocation,
          latitude: genericFloats[1],
          longitude: genericFloats[2],
          isEnabled: true,
        },
      }));
      return;
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const latitude = formData.officeLocation?.latitude;
    const longitude = formData.officeLocation?.longitude;
    if (
      latitude === '' ||
      longitude === '' ||
      !Number.isFinite(Number(latitude)) ||
      Number(latitude) < -90 ||
      Number(latitude) > 90 ||
      !Number.isFinite(Number(longitude)) ||
      Number(longitude) < -180 ||
      Number(longitude) > 180
    ) {
      alert('Enter valid office latitude and longitude coordinates before saving the 50-meter attendance rule.');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const payload = {
        companyTimezone: formData.companyTimezone,
        qrTokenExpiresSeconds: Number(formData.qrTokenExpiresSeconds),
        qrRefreshIntervalSeconds: Number(formData.qrRefreshIntervalSeconds),
        gpsAccuracyThresholdMeters: Number(formData.gpsAccuracyThresholdMeters),
        wfhEnabled: Boolean(formData.wfhEnabled),
        wfhMaxDaysPerMonth: Number(formData.wfhMaxDaysPerMonth),
        wfhRequiresApproval: Boolean(formData.wfhRequiresApproval),
        wfhAdvanceNoticeDays: Number(formData.wfhAdvanceNoticeDays),
        wfhEligibleWorkTypes: formData.wfhEligibleWorkTypes,
        halfDayDurationMinutes: Number(formData.halfDayDurationMinutes),
        fullDayDurationMinutes: Number(formData.fullDayDurationMinutes),
        officeLocation: {
          latitude: Number(latitude),
          longitude: Number(longitude),
          address: formData.officeLocation?.address || '',
          locationLink: formData.officeLocation?.locationLink || '',
          radiusMeters: 50,
          isEnabled: true,
        },
      };

      const targetId = policy?._id || 'current';
      const res = await policyService.update(targetId, payload);
      setPolicy(res.data || res);
      await fetchPolicy();
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      alert(err.message || 'Failed to update policy');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleWorkType = (type) => {
    const current = formData.wfhEligibleWorkTypes || [];
    if (current.includes(type)) {
      setFormData({
        ...formData,
        wfhEligibleWorkTypes: current.filter((t) => t !== type),
      });
    } else {
      setFormData({
        ...formData,
        wfhEligibleWorkTypes: [...current, type],
      });
    }
  };

  if (isLoading) {
    return (
      <div className="py-24">
        <LoadingSpinner size="lg" message="Loading attendance policies..." />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchPolicy} />;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header & Edit/Save Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Company Attendance Policies
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Global shift rules, dynamic QR issuance intervals, and remote work quotas
          </p>
        </div>

        <div>
          {!isEditing ? (
            <Button
              variant="primary"
              onClick={() => setIsEditing(true)}
              icon={Edit}
              className="shadow-glow"
            >
              Edit Policies
            </Button>
          ) : (
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={isSaving}
                icon={RotateCcw}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                isLoading={isSaving}
                icon={Save}
                className="shadow-glow"
              >
                Save Policies
              </Button>
            </div>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm flex items-center space-x-3 shadow-lg animate-fade-in">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>Policies updated and applied across the attendance engine successfully.</span>
        </div>
      )}

      {/* 1. Attendance & QR Policy */}
      <Card
        title="1. Core Attendance & QR Token Configuration"
        subtitle="Cryptographic rotation times and company timezone"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              Timezone
            </label>
            {isEditing ? (
              <Input
                value={formData.companyTimezone}
                onChange={(e) =>
                  setFormData({ ...formData, companyTimezone: e.target.value })
                }
              />
            ) : (
              <p className="text-base font-semibold text-white">
                {policy?.companyTimezone || 'Asia/Kolkata'}
              </p>
            )}
            <p className="text-[11px] text-gray-500 mt-1">Used for shift boundary calculation</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              QR Token Expiry (Seconds)
            </label>
            {isEditing ? (
              <Input
                type="number"
                min="5"
                max="30"
                value={formData.qrTokenExpiresSeconds}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    qrTokenExpiresSeconds: e.target.value,
                  })
                }
              />
            ) : (
              <p className="text-base font-semibold text-cyan-400">
                {policy?.qrTokenExpiresSeconds || 30}s
              </p>
            )}
            <p className="text-[11px] text-gray-500 mt-1">Maximum window for camera scan</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              QR Refresh Interval (Seconds)
            </label>
            {isEditing ? (
              <Input
                type="number"
                min="5"
                max="30"
                value={formData.qrRefreshIntervalSeconds}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    qrRefreshIntervalSeconds: e.target.value,
                  })
                }
              />
            ) : (
              <p className="text-base font-semibold text-cyan-400">
                {policy?.qrRefreshIntervalSeconds || 30}s
              </p>
            )}
            <p className="text-[11px] text-gray-500 mt-1">Kiosk screen polling interval</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              Maximum GPS Accuracy (Meters)
            </label>
            {isEditing ? (
              <Input
                type="number"
                min="1"
                max="100"
                value={formData.gpsAccuracyThresholdMeters}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    gpsAccuracyThresholdMeters: e.target.value,
                  })
                }
              />
            ) : (
              <p className="text-base font-semibold text-cyan-400">
                ±{policy?.gpsAccuracyThresholdMeters || 50}m
              </p>
            )}
            <p className="text-[11px] text-gray-500 mt-1">GPS fixes less accurate than this are rejected (Recommended: 50m for indoor mobile scanning)</p>
          </div>
        </div>
      </Card>

      {/* 2. WFH Policy */}
      <Card
        title="2. Work-From-Home (WFH) Governance"
        subtitle="Remote quotas, approval mandates, and notice requirements"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              WFH System Status
            </label>
            {isEditing ? (
              <div className="mt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.wfhEnabled}
                    onChange={(e) =>
                      setFormData({ ...formData, wfhEnabled: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500 bg-navy-800"
                  />
                  <span className="text-sm text-white">WFH Program Enabled</span>
                </label>
              </div>
            ) : (
              <Badge
                status={policy?.wfhEnabled ? 'active' : 'inactive'}
                label={policy?.wfhEnabled ? 'Enabled' : 'Disabled'}
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              Max WFH Days / Month
            </label>
            {isEditing ? (
              <Input
                type="number"
                min="0"
                max="31"
                value={formData.wfhMaxDaysPerMonth}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    wfhMaxDaysPerMonth: e.target.value,
                  })
                }
              />
            ) : (
              <p className="text-base font-semibold text-white">
                {policy?.wfhMaxDaysPerMonth || 8} days
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              HR Approval Required
            </label>
            {isEditing ? (
              <div className="mt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.wfhRequiresApproval}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        wfhRequiresApproval: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500 bg-navy-800"
                  />
                  <span className="text-sm text-white">Mandatory HR Review</span>
                </label>
              </div>
            ) : (
              <Badge
                status={policy?.wfhRequiresApproval ? 'pending' : 'approved'}
                label={policy?.wfhRequiresApproval ? 'Required' : 'Auto-Approve'}
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              Advance Notice
            </label>
            {isEditing ? (
              <Input
                type="number"
                min="0"
                max="14"
                value={formData.wfhAdvanceNoticeDays}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    wfhAdvanceNoticeDays: e.target.value,
                  })
                }
              />
            ) : (
              <p className="text-base font-semibold text-white">
                {policy?.wfhAdvanceNoticeDays || 1} day(s) before
              </p>
            )}
          </div>
        </div>

        {/* Eligible Work Types */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Eligible Work Types For WFH Requests
          </label>
          <div className="flex flex-wrap gap-3">
            {['office', 'hybrid', 'remote'].map((type) => {
              const selected = isEditing
                ? formData.wfhEligibleWorkTypes?.includes(type)
                : policy?.wfhEligibleWorkTypes?.includes(type);

              return (
                <button
                  key={type}
                  type="button"
                  disabled={!isEditing}
                  onClick={() => isEditing && handleToggleWorkType(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border ${
                    selected
                      ? 'bg-primary-600/20 text-cyan-400 border-cyan-400/40'
                      : 'bg-white/5 text-gray-500 border-white/10'
                  } ${!isEditing ? 'cursor-default' : 'hover:border-cyan-400'}`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* 3. Shift Duration Thresholds */}
      <Card
        title="3. Working Hour Thresholds"
        subtitle="Classification criteria for full-day vs half-day attendance"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              Half-Day Minimum (Minutes)
            </label>
            {isEditing ? (
              <Input
                type="number"
                min="60"
                max="360"
                value={formData.halfDayDurationMinutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    halfDayDurationMinutes: e.target.value,
                  })
                }
              />
            ) : (
              <p className="text-base font-semibold text-white">
                {policy?.halfDayDurationMinutes || 240} mins ({((policy?.halfDayDurationMinutes || 240) / 60).toFixed(1)} hrs)
              </p>
            )}
            <p className="text-[11px] text-gray-500 mt-1">Below this duration, status marked incomplete</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              Full-Day Standard (Minutes)
            </label>
            {isEditing ? (
              <Input
                type="number"
                min="300"
                max="600"
                value={formData.fullDayDurationMinutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    fullDayDurationMinutes: e.target.value,
                  })
                }
              />
            ) : (
              <p className="text-base font-semibold text-white">
                {policy?.fullDayDurationMinutes || 480} mins ({((policy?.fullDayDurationMinutes || 480) / 60).toFixed(1)} hrs)
              </p>
            )}
            <p className="text-[11px] text-gray-500 mt-1">Full shift minimum duration</p>
          </div>
        </div>
      </Card>

      {/* 4. Office Geofence Location & 50-Meter Radius Rule */}
      <Card
        title="4. Office Geofencing & 50-Meter Attendance Rule"
        subtitle="Specify office GPS coordinates. Only employees within 50 meters can mark attendance."
        action={
          !isEditing && (
            <Button
              size="sm"
              variant="outline"
              icon={Edit}
              onClick={() => setIsEditing(true)}
              className="border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
            >
              Update Office Location
            </Button>
          )
        }
      >
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-navy-950/60 border border-white/10">
            <div>
              <span className="text-sm font-semibold text-white block">
                50-Meter Geofence Enforcement
              </span>
              <span className="text-xs text-gray-400">
                Attendance requires a fresh GPS fix securely within 50 meters of the saved office location. The radius cannot be disabled or widened.
              </span>
            </div>

            <Badge status="approved" label="Always enforced (50m)" />
          </div>

          <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-100/80">
            If an employee at the office sees a distance of hundreds of kilometers, the saved office pin is incorrect. Update it while physically at the office using “Fetch Current Device GPS”; do not increase the 50m radius.
          </p>

          {/* Location Link Input (e.g. Google Maps URL) */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <LinkIcon className="w-4 h-4" />
                Office Google Maps Location Link / Coordinates
              </label>
              {policy?.officeLocation?.locationLink && !isEditing && (
                <a
                  href={policy.officeLocation.locationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                >
                  Open in Maps <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-1.5">
                <Input
                  type="text"
                  placeholder="Paste Google Maps URL (e.g. https://maps.google.com/?q=28.6139,77.2090) or '28.6139, 77.2090'"
                  value={formData.officeLocation?.locationLink || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      officeLocation: {
                        ...prev.officeLocation,
                        locationLink: val,
                      },
                    }));
                    handleParseMapLink(val);
                  }}
                />
                <p className="text-[11px] text-gray-400">
                  Tip: Google Maps link paste karne par Latitude aur Longitude coordinates automatically extract ho jayenge.
                </p>
              </div>
            ) : (
              <p className="text-sm font-mono text-gray-300 break-all">
                {policy?.officeLocation?.locationLink || 'No maps link configured yet'}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                Office Latitude
              </label>
              {isEditing ? (
                <Input
                  type="text"
                  placeholder="e.g. 28.6139"
                  value={formData.officeLocation?.latitude || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      officeLocation: {
                        ...formData.officeLocation,
                        latitude: e.target.value,
                      },
                    })
                  }
                />
              ) : (
                <p className="text-base font-mono font-semibold text-white">
                  {policy?.officeLocation?.latitude || 'Not set'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                Office Longitude
              </label>
              {isEditing ? (
                <Input
                  type="text"
                  placeholder="e.g. 77.2090"
                  value={formData.officeLocation?.longitude || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      officeLocation: {
                        ...formData.officeLocation,
                        longitude: e.target.value,
                      },
                    })
                  }
                />
              ) : (
                <p className="text-base font-mono font-semibold text-white">
                  {policy?.officeLocation?.longitude || 'Not set'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                Radius Restriction
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-cyan-400">
                  {formData.officeLocation?.radiusMeters || 50} meters
                </span>
                <span className="text-xs text-gray-500">(Strictly 50m)</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              Office Address / Label
            </label>
            {isEditing ? (
              <Input
                type="text"
                placeholder="e.g. VorldX Main Office, Ground Floor"
                value={formData.officeLocation?.address || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    officeLocation: {
                      ...formData.officeLocation,
                      address: e.target.value,
                    },
                  })
                }
              />
            ) : (
              <p className="text-sm text-gray-300">
                {policy?.officeLocation?.address || 'Main Office'}
              </p>
            )}
          </div>

          {isEditing && (
            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Navigation}
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setFormData({
                          ...formData,
                          officeLocation: {
                            ...formData.officeLocation,
                            latitude: pos.coords.latitude.toFixed(6),
                            longitude: pos.coords.longitude.toFixed(6),
                            isEnabled: true,
                          },
                        });
                        alert(
                          `Current device location captured (±${Math.round(pos.coords.accuracy)}m accuracy).\nLatitude: ${pos.coords.latitude.toFixed(6)}\nLongitude: ${pos.coords.longitude.toFixed(6)}\n\nUse this only when this device is physically at the office.`
                        );
                      },
                      (err) => {
                        alert(
                          `Location fetch failed: ${err.message}. Please allow GPS permissions in your browser.`
                        );
                      },
                      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                    );
                  } else {
                    alert('Geolocation is not supported by your browser.');
                  }
                }}
                className="text-xs text-cyan-400 border-cyan-400/30 hover:bg-cyan-500/10"
              >
                Fetch Current Device GPS
              </Button>

              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                  icon={RotateCcw}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  isLoading={isSaving}
                  icon={Save}
                  className="shadow-glow"
                >
                  Save Location & 50m Rule
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Shifts Section (Read-Only) */}
      <Card
        title="Active Work Shifts"
        subtitle="Standard operating shifts configured in the system"
      >
        {shifts.length === 0 ? (
          <p className="text-xs text-gray-500 py-4">No active shifts configured</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {shifts.map((shift) => (
              <div
                key={shift._id}
                className="p-4 rounded-xl bg-navy-900 border border-white/10 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">
                    {shift.name}
                  </span>
                  {shift.isDefault && (
                    <span className="text-[10px] bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded font-semibold border border-primary-500/30">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Shift Window:</span>
                  <span className="font-mono text-cyan-400">
                    {shift.startTime} - {shift.endTime}
                  </span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Grace Period:</span>
                  <span>{shift.gracePeriodMinutes ?? 15} mins</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Work Days:</span>
                  <span className="capitalize">{shift.workingDays?.join(', ') || 'Mon-Fri'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Warning Alert */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-3 text-amber-300 text-xs leading-relaxed">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold block mb-0.5">Important Historical Record Notice:</strong>
          Modifications made to attendance policies take effect immediately for new QR generations, future check-in scans, and upcoming WFH evaluations. Past attendance records and previously calculated working durations will remain preserved for audit integrity.
        </div>
      </div>
    </div>
  );
};

export default PoliciesPage;
