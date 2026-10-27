import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Plus,
  Power,
  Copy,
  Check,
  ExternalLink,
  Monitor,
  Info,
  AlertCircle,
  MapPin,
  Clock,
} from 'lucide-react';
import { qrDisplayService } from '../../services/api';
import { formatDate, formatDateTime } from '../../utils/formatters';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Card from '../../components/ui/Card';
import ErrorState from '../../components/ui/ErrorState';

export const QRDisplaysPage = () => {
  const [displays, setDisplays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Registration Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState('');

  // Newly registered display displayId for quick kiosk launch
  const [newlyRegistered, setNewlyRegistered] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const fetchDisplays = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await qrDisplayService.getAll();
      setDisplays(res.data || []);
    } catch (err) {
      console.error('Failed to load QR displays:', err);
      setError(err.message || 'Unable to retrieve office QR displays');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDisplays();
  }, []);

  // Handle Register Display
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setRegisterError('Please provide a display name.');
      return;
    }

    setRegisterError('');
    setIsSubmitting(true);

    try {
      const res = await qrDisplayService.pair({
        displayName: displayName.trim(),
        location: location.trim() || undefined,
      });
      const created = res.data || res;
      setNewlyRegistered(created);
      setDisplayName('');
      setLocation('');
      await fetchDisplays();
    } catch (err) {
      setRegisterError(err.message || 'Failed to register display.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Display Status
  const handleToggleStatus = async (display) => {
    try {
      await qrDisplayService.updateStatus(display._id, !display.isActive);
      await fetchDisplays();
    } catch (err) {
      alert(err.message || 'Failed to update display status');
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getDisplayKioskUrl = (id) => {
    return `${window.location.origin}/office/qr-display?displayId=${id}`;
  };

  const columns = [
    {
      key: 'displayName',
      label: 'Display Name',
      render: (row) => (
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-navy-800 border border-white/10 flex items-center justify-center text-cyan-400">
            <Monitor className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-white">{row.displayName}</p>
            <p className="text-[11px] font-mono text-gray-400">{row.displayId || row._id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Office Location',
      render: (row) => (
        <div className="flex items-center space-x-1.5 text-gray-300">
          <MapPin className="w-3.5 h-3.5 text-gray-500" />
          <span>{row.location || 'General Lobby'}</span>
        </div>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => (
        <Badge
          status={row.isActive ? 'active' : 'inactive'}
          size="sm"
          dot={true}
        />
      ),
    },
    {
      key: 'isPaired',
      label: 'Paired State',
      render: (row) => (
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
            row.isPaired
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}
        >
          {row.isPaired ? 'Paired' : 'Awaiting Pair'}
        </span>
      ),
    },
    {
      key: 'lastTokenIssuedAt',
      label: 'Last Token Issued',
      render: (row) => (
        <span className="text-xs text-gray-400">
          {row.lastTokenIssuedAt ? formatDateTime(row.lastTokenIssuedAt) : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      cellClassName: 'text-right',
      render: (row) => {
        const url = getDisplayKioskUrl(row.displayId || row._id);
        return (
          <div className="flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => copyToClipboard(url, row._id)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Copy Kiosk Screen URL"
            >
              {copiedId === row._id ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
              title="Open Kiosk Screen in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={() => handleToggleStatus(row)}
              className={`p-1.5 rounded-lg transition-colors ${
                row.isActive
                  ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                  : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
              }`}
              title={row.isActive ? 'Deactivate Device' : 'Activate Device'}
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Office QR Display Devices
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Register and supervise wall-mounted tablets and lobby attendance screens
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setNewlyRegistered(null);
            setIsRegisterOpen(true);
          }}
          icon={Plus}
          className="self-start sm:self-auto shadow-glow font-semibold"
        >
          Register Display
        </Button>
      </div>

      {/* Info & Screenshot Disclaimer Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-primary-950/60 to-cyan-950/40 border border-primary-500/20 text-gray-300 text-xs sm:text-sm space-y-2">
        <div className="flex items-center space-x-2 text-cyan-400 font-semibold">
          <Info className="w-4 h-4" />
          <span>About Dynamic Rotating QR Codes</span>
        </div>
        <p className="leading-relaxed text-gray-400">
          Each office QR display screen continuously rotates cryptographically signed attendance tokens every 30 seconds. Because each token expires in 30 seconds and is consumed on scan, static photo copies or shared screenshots cannot be used to forge attendance.
        </p>
      </div>

      {/* Error state */}
      {error && <ErrorState message={error} onRetry={fetchDisplays} />}

      {/* Table */}
      {!error && (
        <Table
          columns={columns}
          data={displays}
          isLoading={isLoading}
          emptyMessage="No QR displays registered yet. Click 'Register Display' to setup an office kiosk."
        />
      )}

      {/* Register Display Modal */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title={newlyRegistered ? 'Display Registered Successfully' : 'Register New Office QR Display'}
        size="md"
      >
        {!newlyRegistered ? (
          <form onSubmit={handleRegister} className="space-y-4">
            {registerError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{registerError}</span>
              </div>
            )}

            <Input
              label="Display Name"
              placeholder="e.g. 4th Floor Main Reception Kiosk"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />

            <Input
              label="Physical Location"
              placeholder="e.g. Building A - Reception Gate 2"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />

            <div className="flex justify-end space-x-3 pt-3 border-t border-white/10">
              <Button
                variant="ghost"
                onClick={() => setIsRegisterOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={isSubmitting}>
                Register & Get Kiosk URL
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-5 animate-fade-in">
            <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start space-x-3">
              <Check className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white text-sm">
                  {newlyRegistered.displayName} is ready for deployment!
                </p>
                <p className="mt-1 text-emerald-300">
                  Load the URL below in the browser of the kiosk screen tablet to start broadcasting the attendance QR code.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Kiosk Screen URL:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={getDisplayKioskUrl(newlyRegistered.displayId || newlyRegistered._id)}
                  className="flex-1 bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      getDisplayKioskUrl(newlyRegistered.displayId || newlyRegistered._id),
                      'new'
                    )
                  }
                >
                  {copiedId === 'new' ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-white/10">
              <a
                href={getDisplayKioskUrl(newlyRegistered.displayId || newlyRegistered._id)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center font-medium"
              >
                <span>Launch Display Screen</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </a>

              <Button
                variant="primary"
                onClick={() => setIsRegisterOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default QRDisplaysPage;
