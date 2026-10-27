import React, { useState, useEffect } from 'react';
import {
  Home,
  Calendar,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { wfhService, policyService } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';

const TABS = [
  { key: 'myRequests', label: 'My Requests' },
  { key: 'submit', label: 'Submit New Request' },
  { key: 'policy', label: 'WFH Guidelines' },
];

export const WFHPage = () => {
  const [activeTab, setActiveTab] = useState('myRequests');

  // Requests List State
  const [myRequests, setMyRequests] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [requestError, setRequestError] = useState(null);

  // Submit Request State
  const [targetDate, setTargetDate] = useState('');
  const [reason, setReason] = useState('');
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [eligibility, setEligibility] = useState(null); // { eligible: boolean, reason: string }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Policy Tab State
  const [policyData, setPolicyData] = useState(null);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(false);

  // Calculate minimum selectable date (tomorrow)
  const getTomorrowString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const pad = (n) => String(n).padStart(2, '0');
    return `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
  };

  const tomorrowStr = getTomorrowString();

  // Load My Requests
  const fetchMyRequests = async () => {
    setIsLoadingRequests(true);
    setRequestError(null);
    try {
      const res = await wfhService.getMyRequests();
      setMyRequests(res.data || res.requests || []);
    } catch (err) {
      console.error('Failed to load my WFH requests:', err);
      setRequestError(err.message || 'Unable to load your WFH applications');
    } finally {
      setIsLoadingRequests(false);
    }
  };

  // Load Policy
  const fetchPolicy = async () => {
    setIsLoadingPolicy(true);
    try {
      const res = await policyService.getAll();
      setPolicyData(res.data?.policy || res.policy);
    } catch (err) {
      console.error('Failed to load policy guidelines:', err);
    } finally {
      setIsLoadingPolicy(false);
    }
  };

  useEffect(() => {
    fetchMyRequests();
    fetchPolicy();
  }, []);

  // When date changes, check eligibility
  const handleDateChange = async (dateVal) => {
    setTargetDate(dateVal);
    setSubmitSuccess('');
    setSubmitError('');

    if (!dateVal) {
      setEligibility(null);
      return;
    }

    setIsCheckingEligibility(true);
    try {
      const res = await wfhService.getEligibility({ date: dateVal });
      setEligibility(res.data || res);
    } catch (err) {
      setEligibility({
        eligible: false,
        reason: err.message || 'Error verifying eligibility for selected date',
      });
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  // Handle Request Submission
  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!targetDate || !eligibility?.eligible) return;

    if (!reason.trim()) {
      setSubmitError('Please provide a reason for your remote work application.');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      await wfhService.submitRequest({
        requestedDate: targetDate,
        reason: reason.trim(),
      });

      setSubmitSuccess('WFH request submitted successfully and queued for HR review!');
      setTargetDate('');
      setReason('');
      setEligibility(null);

      // Refresh requests list
      await fetchMyRequests();

      // Switch to list tab after 2s
      setTimeout(() => {
        setActiveTab('myRequests');
      }, 1500);
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit WFH request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Work From Home (WFH) Portal
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">
          Apply for remote working days, track manager reviews, and check policy eligibility
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 space-x-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 px-4 text-sm font-medium transition-all relative ${
              activeTab === tab.key
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: MY REQUESTS */}
      {activeTab === 'myRequests' && (
        <div className="space-y-4">
          {isLoadingRequests ? (
            <div className="py-16">
              <LoadingSpinner size="md" message="Loading your requests..." />
            </div>
          ) : requestError ? (
            <ErrorState message={requestError} onRetry={fetchMyRequests} />
          ) : myRequests.length === 0 ? (
            <EmptyState
              icon={Home}
              title="No WFH Requests"
              message="You have not submitted any remote work applications yet."
              action={
                <Button
                  variant="primary"
                  onClick={() => setActiveTab('submit')}
                >
                  Submit WFH Request
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {myRequests.map((req) => (
                <div
                  key={req._id}
                  className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3 hover:border-white/20 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-navy-800 border border-white/10 flex items-center justify-center text-cyan-400 shrink-0">
                        <Home className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-semibold text-white text-sm block">
                          {formatDate(req.requestedDate, 'EEEE, MMMM dd, yyyy')}
                        </span>
                        <span className="text-xs text-gray-400">
                          Applied on {formatDate(req.createdAt, 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>

                    <Badge status={req.status} size="md" />
                  </div>

                  {/* Reason & Review Note */}
                  <div className="text-xs space-y-1.5 pt-2 border-t border-white/5">
                    <p className="text-gray-300">
                      <span className="text-gray-500 font-medium">My Reason:</span>{' '}
                      {req.reason || 'None stated'}
                    </p>

                    {req.reviewComment && (
                      <p className="text-cyan-300 bg-cyan-950/40 p-2.5 rounded-xl border border-cyan-500/20">
                        <span className="font-semibold">Reviewer Comment:</span>{' '}
                        {req.reviewComment}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUBMIT NEW REQUEST */}
      {activeTab === 'submit' && (
        <Card
          title="New Work From Home Application"
          subtitle="Check your date eligibility and state your justification"
          className="max-w-xl mx-auto"
        >
          <form onSubmit={handleSubmitRequest} className="space-y-5 pt-2">
            {submitSuccess && (
              <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2.5 animate-fade-in">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <span>{submitSuccess}</span>
              </div>
            )}

            {submitError && (
              <div className="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2.5 animate-fade-in">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Target Date Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Requested WFH Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                min={tomorrowStr}
                value={targetDate}
                onChange={(e) => handleDateChange(e.target.value)}
                required
                className="w-full rounded-lg bg-navy-800 border border-white/10 px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Policy requirement: WFH must be requested at least 1 day in advance.
              </span>
            </div>

            {/* Live Eligibility Status Banner */}
            {isCheckingEligibility && (
              <div className="p-3 rounded-xl bg-navy-800 border border-white/10 flex items-center space-x-2 text-xs text-gray-400 animate-pulse">
                <Clock className="w-4 h-4 text-cyan-400 animate-spin" />
                <span>Checking company remote work quota for this date...</span>
              </div>
            )}

            {!isCheckingEligibility && eligibility && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 ${
                  eligibility.eligible
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/15 border-red-500/30 text-red-300'
                }`}
              >
                {eligibility.eligible ? (
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div>
                  <strong className="block font-semibold">
                    {eligibility.eligible
                      ? 'Eligible for WFH on this date'
                      : 'Ineligible for WFH on this date'}
                  </strong>
                  <span className="text-[11px] opacity-90">
                    {eligibility.reason ||
                      (eligibility.eligible
                        ? 'You have remaining remote work quota for this month.'
                        : 'Quota exceeded or policy restrictions apply.')}
                  </span>
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Reason / Task Plan <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the reason for remote work and summarize your expected deliverables..."
                className="w-full rounded-lg bg-navy-800 border border-white/10 p-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              disabled={!targetDate || !eligibility?.eligible}
              icon={Send}
              className="w-full shadow-glow"
            >
              Submit Application
            </Button>
          </form>
        </Card>
      )}

      {/* TAB 3: POLICY */}
      {activeTab === 'policy' && (
        <Card
          title="Company Work From Home Policy Guidelines"
          subtitle="Official conditions governing remote attendance"
          className="max-w-2xl mx-auto space-y-4"
        >
          {isLoadingPolicy ? (
            <div className="py-12">
              <LoadingSpinner size="md" message="Loading guidelines..." />
            </div>
          ) : (
            <div className="space-y-4 text-xs sm:text-sm text-gray-300 leading-relaxed">
              <div className="p-4 rounded-xl bg-navy-950 border border-white/10 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">Monthly Allowance:</span>
                  <span className="font-bold text-cyan-400">
                    {policyData?.wfhMaxDaysPerMonth ?? 8} days per calendar month
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">Notice Requirement:</span>
                  <span className="font-bold text-white">
                    {policyData?.wfhAdvanceNoticeDays ?? 1} day(s) advance submission
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">Approval Workflow:</span>
                  <span className="font-bold text-white">
                    {policyData?.wfhRequiresApproval ? 'Mandatory HR Approval' : 'Auto-approved'}
                  </span>
                </div>
              </div>

              <h4 className="text-sm font-semibold text-white pt-2">
                Key Remote Work Guidelines:
              </h4>
              <ul className="list-disc list-inside space-y-2 text-gray-400 text-xs">
                <li>
                  Applications must be submitted prior to the scheduled work day to ensure department coverage.
                </li>
                <li>
                  Employees are expected to remain available via official communication channels during regular shift hours.
                </li>
                <li>
                  Unapproved remote days or unsubmitted absences will be categorized as Incomplete attendance.
                </li>
                <li>
                  Unused WFH days do not carry over to subsequent calendar months.
                </li>
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default WFHPage;
