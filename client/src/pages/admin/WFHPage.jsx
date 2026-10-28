import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Home,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  AlertCircle,
  User,
  Calendar,
  Search,
  Building,
  Hash,
  FileText,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { differenceInCalendarDays, isToday, isTomorrow } from 'date-fns';
import { wfhService } from '../../services/api';
import { formatDate, formatDateTime } from '../../utils/formatters';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';

const TABS = [
  { key: '', label: 'All Requests', icon: Home, countKey: 'all' },
  { key: 'pending', label: 'Pending', icon: Clock, countKey: 'pending' },
  { key: 'approved', label: 'Approved', icon: CheckCircle2, countKey: 'approved' },
  { key: 'rejected', label: 'Rejected', icon: XCircle, countKey: 'rejected' },
];

const formatRequestedDate = (date) => {
  if (!date) return { date: '-', relative: '' };
  const requested = new Date(date);
  if (Number.isNaN(requested.getTime())) return { date: '-', relative: '' };
  const daysFromToday = differenceInCalendarDays(requested, new Date());
  let relative = 'Past date';
  if (isToday(requested)) relative = 'Today';
  else if (isTomorrow(requested)) relative = 'Tomorrow';
  else if (daysFromToday > 1) relative = `In ${daysFromToday} days`;
  return { date: formatDate(requested, 'MMM dd, yyyy'), relative };
};

const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
};

export const WFHPage = () => {
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [counts, setCounts] = useState({ all: null, pending: null, approved: null, rejected: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [countsError, setCountsError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [decisionStatus, setDecisionStatus] = useState('approved');
  const [reviewComment, setReviewComment] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const [inspectedRequest, setInspectedRequest] = useState(null);
  const [inspectionType, setInspectionType] = useState('reason');
  const requestSequence = useRef(0);
  const currentPageRef = useRef(1);
  const toastTimerRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    setCountsError('');
    try {
      const statuses = [
        { key: 'all', status: '' },
        { key: 'pending', status: 'pending' },
        { key: 'approved', status: 'approved' },
        { key: 'rejected', status: 'rejected' },
      ];
      const responses = await Promise.all(
        statuses.map(({ status }) => wfhService.getAllRequests({
          ...(status ? { status } : {}),
          page: 1,
          limit: 1,
        }))
      );
      const nextCounts = {};
      statuses.forEach(({ key }, index) => {
        const total = responses[index]?.pagination?.total;
        if (!Number.isFinite(total) || total < 0) {
          throw new Error(`The backend returned an invalid ${key} request count`);
        }
        nextCounts[key] = total;
      });
      setCounts(nextCounts);
    } catch (err) {
      console.error('Failed to load WFH request counts:', err);
      setCountsError(err.message || 'Unable to refresh request counts');
    }
  }, []);

  const fetchRequests = useCallback(async (page = 1, { silent = false } = {}) => {
    const sequence = ++requestSequence.current;
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const params = { page, limit: 15 };
      if (activeTab) params.status = activeTab;
      const res = await wfhService.getAllRequests(params);
      if (sequence !== requestSequence.current) return;
      if (!Array.isArray(res?.data) || !res?.pagination) {
        throw new Error('The backend returned an invalid WFH requests response');
      }
      const list = Array.isArray(res.data) ? res.data : (res.data?.requests || []); setRequests(list);
      setPagination(res.pagination);
      currentPageRef.current = res.pagination.page || page;
    } catch (err) {
      console.error('Failed to load WFH requests:', err);
      if (sequence === requestSequence.current) {
        setError(err.message || 'Failed to retrieve WFH requests');
      }
    } finally {
      if (sequence === requestSequence.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [activeTab]);

  useEffect(() => {
    currentPageRef.current = 1;
    fetchRequests(1);
    fetchCounts();
    const refreshTimer = window.setInterval(() => {
      fetchRequests(currentPageRef.current, { silent: true });
      fetchCounts();
    }, 30000);

    return () => {
      window.clearInterval(refreshTimer);
      requestSequence.current += 1;
    };
  }, [fetchRequests, fetchCounts]);

  useEffect(() => () => {
    window.clearTimeout(toastTimerRef.current);
  }, []);

  const showToast = (message) => {
    window.clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(''), 4000);
  };

  const handleOpenDecision = (request, status) => {
    setSelectedRequest(request);
    setDecisionStatus(status);
    setReviewComment('');
    setDecisionError('');
    setIsDecisionModalOpen(true);
  };

  const handleSubmitDecision = async (event) => {
    event.preventDefault();
    if (!selectedRequest || isSubmittingDecision) return;

    setDecisionError('');
    setIsSubmittingDecision(true);
    try {
      const response = await wfhService.makeDecision(selectedRequest._id, {
        status: decisionStatus,
        reviewComment: reviewComment.trim() || undefined,
      });
      const updatedRequest = response?.data;

      setRequests((current) => {
        if (activeTab && activeTab !== decisionStatus) {
          return current.filter((request) => request._id !== selectedRequest._id);
        }
        return current.map((request) => (
          request._id === selectedRequest._id && updatedRequest
            ? updatedRequest
            : request
        ));
      });
      if (activeTab && activeTab !== decisionStatus) {
        setPagination((current) => ({
          ...current,
          total: Math.max(0, (current.total || 0) - 1),
        }));
      }
      setIsDecisionModalOpen(false);
      showToast(`Request for ${selectedRequest.employee?.name || 'employee'} ${decisionStatus} successfully.`);
      fetchCounts();
      fetchRequests(currentPageRef.current, { silent: true });
    } catch (err) {
      console.error('Failed to process WFH decision:', err);
      setDecisionError(err.message || 'Failed to process decision. Please try again.');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const openInspection = (request, type) => {
    setInspectedRequest(request);
    setInspectionType(type);
  };

  const visibleRequests = requests.filter((request) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return [
      request.employee?.name,
      request.employee?.employeeId,
      request.employee?.department,
      request.reason,
      request.status,
    ].some((value) => String(value || '').toLowerCase().includes(query));
  });

  const getStatusDisplay = (status) => {
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
          <Clock className="h-3.5 w-3.5" /> Pending
        </span>
      );
    }
    if (status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
          <Check className="h-3.5 w-3.5" /> Approved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300">
        <X className="h-3.5 w-3.5" /> Rejected
      </span>
    );
  };

  const renderActions = (request) => {
    if (request.status === 'pending') {
      return (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => handleOpenDecision(request, 'approved')}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <Check className="h-4 w-4" /> Approve
          </button>
          <button
            type="button"
            onClick={() => handleOpenDecision(request, 'rejected')}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-rose-400"
          >
            <X className="h-4 w-4" /> Reject
          </button>
        </div>
      );
    }
    return (
      <div className="flex min-w-0 items-center justify-end gap-2">
        <span className="min-w-0 max-w-36 truncate text-xs text-gray-400" title={request.reviewer?.name || ''}>
          {request.reviewer?.name || '—'}
        </span>
        {request.reviewComment && (
          <button
            type="button"
            onClick={() => openInspection(request, 'review')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-cyan-300 transition hover:bg-cyan-400/10 hover:text-white"
            title="View reviewer note"
            aria-label="View reviewer note"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  };

  const columns = [
    {
      key: 'employee',
      label: 'Employee',
      render: (request) => (
        <div className="flex min-w-[190px] items-center gap-3 whitespace-normal">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/25 to-blue-600/20 text-sm font-bold text-cyan-200 ring-1 ring-white/10">
            {getInitials(request.employee?.name) || <User className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="break-words font-semibold text-white">{request.employee?.name || '—'}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
              <span className="inline-flex items-center gap-1 font-mono text-cyan-300">
                <Hash className="h-3 w-3" />{request.employee?.employeeId || '—'}
              </span>
              <span className="text-gray-500">{request.employee?.department || '—'}</span>
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'requestedDate',
      label: 'Requested Date',
      render: (request) => {
        const requested = formatRequestedDate(request.requestedDate);
        return (
          <div className="min-w-[145px] whitespace-normal">
            <p className="flex items-center gap-1.5 font-medium text-white">
              <Calendar className="h-4 w-4 shrink-0 text-cyan-400" />
              {requested.date}
            </p>
            <p className="mt-1 pl-5 text-[11px] text-gray-400">{requested.relative}</p>
          </div>
        );
      },
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (request) => (
        <button
          type="button"
          onClick={() => openInspection(request, 'reason')}
          className="flex min-h-10 max-w-sm items-center gap-2 whitespace-normal rounded-lg px-2 text-left text-sm text-gray-300 transition hover:bg-white/5 hover:text-white"
          title="Read full reason"
        >
          <FileText className="h-4 w-4 shrink-0 text-cyan-400" />
          <span className="line-clamp-2 break-words">{request.reason || '—'}</span>
        </button>
      ),
    },
    {
      key: 'createdAt',
      label: 'Submitted On',
      render: (request) => (
        <span className="min-w-[130px] whitespace-normal text-xs text-gray-300">
          {formatDateTime(request.createdAt, 'MMM dd, yyyy, hh:mm a')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (request) => getStatusDisplay(request.status),
    },
    {
      key: 'actions',
      label: 'Decision / Reviewer',
      cellClassName: 'text-right',
      render: (request) => renderActions(request),
    },
  ];

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {toastMessage && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200 shadow-lg animate-fade-in">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <span className="min-w-0 break-words">{toastMessage}</span>
        </div>
      )}

      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[clamp(1.35rem,5vw,1.875rem)] font-bold leading-tight tracking-tight text-white">
              Work From Home Approvals
            </h1>
            {isRefreshing && <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" aria-label="Refreshing requests" />}
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-400 sm:text-sm">
            Review employee requests, read the complete reason, and record a decision.
          </p>
        </div>
        <div className="relative w-full min-w-0 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search employee, department..."
            aria-label="Search WFH requests"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-navy-900/80 py-2 pl-10 pr-3 text-sm text-white placeholder-gray-500 outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
          />
        </div>
      </header>

      <nav aria-label="WFH request status filters" className="overflow-x-auto rounded-2xl border border-white/10 bg-navy-900 p-1.5">
        <div className="flex min-w-max items-center gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.key;
            const isPending = tab.key === 'pending';
            return (
              <button
                key={tab.key || 'all'}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                aria-pressed={selected}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                  selected
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-200 shadow-inner ring-1 ring-cyan-400/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${selected ? 'text-cyan-300' : ''}`} />
                <span>{tab.label}</span>
                {isPending && counts.pending > 0 && (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-label="Pending requests awaiting review" />
                )}
                <span className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
                  selected ? 'bg-cyan-400/15 text-cyan-100' : isPending && counts.pending > 0
                    ? 'bg-amber-400/10 text-amber-300'
                    : 'bg-white/[0.06] text-gray-400'
                }`}>
                  {counts[tab.countKey] ?? '—'}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
      {countsError && (
        <p role="status" className="text-xs text-amber-300">
          Request counts could not be refreshed: {countsError}
        </p>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => fetchRequests(1)} />
      ) : (
        <section className="min-w-0 space-y-3">
          <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-navy-900/40 backdrop-blur-md md:block">
            <div className="overflow-x-auto">
              <Table
                columns={columns}
                data={visibleRequests}
                isLoading={isLoading}
                emptyMessage={activeTab === 'pending'
                  ? 'There are no pending Work From Home requests to review.'
                  : 'No WFH requests match this view.'}
                className="min-w-[1040px] rounded-none border-0"
              />
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {isLoading && requests.length === 0 ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="card-premium h-56 animate-pulse" />
              ))
            ) : visibleRequests.length === 0 ? (
              activeTab === 'pending' && !searchTerm ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="All Caught Up!"
                  message="There are no pending Work From Home requests to review."
                  className="text-emerald-300"
                />
              ) : (
                <div className="card-premium px-4 py-10 text-center text-sm text-gray-400">
                  No WFH requests match this view.
                </div>
              )
            ) : (
              visibleRequests.map((request) => {
                const requested = formatRequestedDate(request.requestedDate);
                return (
                  <article key={request._id} className="card-premium min-w-0 p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/25 to-blue-600/20 font-bold text-cyan-200 ring-1 ring-white/10">
                          {getInitials(request.employee?.name) || <User className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <h2 className="break-words text-base font-semibold text-white">
                            {request.employee?.name || '—'}
                          </h2>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                            <span className="inline-flex items-center gap-1 font-mono text-cyan-300">
                              <Hash className="h-3 w-3" />{request.employee?.employeeId || '—'}
                            </span>
                            <span className="inline-flex items-center gap-1 text-gray-400">
                              <Building className="h-3 w-3" />{request.employee?.department || '—'}
                            </span>
                          </p>
                        </div>
                      </div>
                      {getStatusDisplay(request.status)}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-white/[0.07] pt-3 min-[420px]:grid-cols-2">
                      <div className="min-w-0">
                        <span className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Calendar className="h-3.5 w-3.5 text-cyan-400" />Requested date
                        </span>
                        <p className="mt-1 font-medium text-gray-200">{requested.date}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{requested.relative}</p>
                      </div>
                      <div className="min-w-0">
                        <span className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock className="h-3.5 w-3.5 text-cyan-400" />Submitted
                        </span>
                        <p className="mt-1 break-words text-xs text-gray-300">
                          {formatDateTime(request.createdAt, 'MMM dd, yyyy, hh:mm a')}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openInspection(request, 'reason')}
                      className="mt-4 flex min-h-11 w-full min-w-0 items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-left transition hover:border-cyan-400/20 hover:bg-white/[0.05]"
                    >
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Reason</span>
                        <span className="mt-1 block break-words text-sm leading-relaxed text-gray-200">{request.reason || '—'}</span>
                      </span>
                    </button>

                    {request.status === 'pending' ? (
                      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-3">
                        <button
                          type="button"
                          onClick={() => handleOpenDecision(request, 'approved')}
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-3 text-sm font-semibold text-white transition hover:from-emerald-500 hover:to-emerald-400"
                        >
                          <Check className="h-4 w-4" />Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDecision(request, 'rejected')}
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-600 hover:text-white"
                        >
                          <X className="h-4 w-4" />Reject
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 flex min-w-0 items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
                        <p className="min-w-0 break-words text-xs text-gray-400">
                          Reviewed by <span className="font-medium text-gray-200">{request.reviewer?.name || '—'}</span>
                        </p>
                        {request.reviewComment && (
                          <button
                            type="button"
                            onClick={() => openInspection(request, 'review')}
                            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-cyan-300 hover:bg-cyan-400/10"
                          >
                            <MessageSquare className="h-4 w-4" />View note
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>

          {visibleRequests.length > 0 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(page) => fetchRequests(page)}
            />
          )}
        </section>
      )}

      <Modal
        isOpen={isDecisionModalOpen}
        onClose={() => !isSubmittingDecision && setIsDecisionModalOpen(false)}
        title={decisionStatus === 'approved' ? 'Approve WFH Request' : 'Reject WFH Request'}
        size="md"
      >
        {selectedRequest && (
          <form onSubmit={handleSubmitDecision} className="space-y-4">
            {decisionError && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{decisionError}</span>
              </div>
            )}
            <div className="space-y-3 rounded-2xl border border-white/10 bg-navy-950/70 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/25 to-blue-600/20 font-bold text-cyan-200">
                  {getInitials(selectedRequest.employee?.name) || <User className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="break-words font-semibold text-white">{selectedRequest.employee?.name || '—'}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
                    <span className="font-mono text-cyan-300">{selectedRequest.employee?.employeeId || '—'}</span>
                    <span>{selectedRequest.employee?.department || '—'}</span>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 border-t border-white/[0.07] pt-3 min-[420px]:grid-cols-2">
                <div>
                  <p className="text-xs text-gray-500">Requested date</p>
                  <p className="mt-1 break-words text-sm font-medium text-gray-200">{formatDate(selectedRequest.requestedDate, 'EEEE, MMMM dd, yyyy')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Submitted</p>
                  <p className="mt-1 break-words text-sm text-gray-200">{formatDateTime(selectedRequest.createdAt, 'MMM dd, yyyy, hh:mm a')}</p>
                </div>
              </div>
              <div className="border-t border-white/[0.07] pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Employee reason</p>
                <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-white/[0.04] p-3 text-sm leading-relaxed text-gray-200">
                  {selectedRequest.reason || '—'}
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="wfh-review-comment" className="mb-1.5 block text-sm font-medium text-gray-300">
                Admin remarks <span className="text-gray-500">(optional)</span>
              </label>
              <textarea
                id="wfh-review-comment"
                rows={3}
                maxLength={500}
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder="Add a note for the employee..."
                className="w-full resize-y rounded-xl border border-white/10 bg-navy-800/70 p-3 text-sm text-white placeholder-gray-500 outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
              />
              <p className="mt-1 text-right text-[11px] text-gray-500">{reviewComment.length}/500</p>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-white/10 pt-3 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                onClick={() => setIsDecisionModalOpen(false)}
                disabled={isSubmittingDecision}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant={decisionStatus === 'approved' ? 'primary' : 'danger'}
                type="submit"
                isLoading={isSubmittingDecision}
                icon={decisionStatus === 'approved' ? CheckCircle2 : XCircle}
                className={`w-full sm:w-auto ${decisionStatus === 'approved' ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400' : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500'}`}
              >
                Confirm {decisionStatus === 'approved' ? 'Approval' : 'Rejection'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(inspectedRequest)}
        onClose={() => setInspectedRequest(null)}
        title={inspectionType === 'reason' ? 'WFH Request Reason' : 'Reviewer Note'}
        size="md"
      >
        {inspectedRequest && (
          <div className="space-y-4">
            <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-white/10 bg-navy-950/70 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/25 to-blue-600/20 font-bold text-cyan-200">
                {getInitials(inspectedRequest.employee?.name) || <User className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="break-words font-semibold text-white">{inspectedRequest.employee?.name || '—'}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
                  <span className="font-mono text-cyan-300">{inspectedRequest.employee?.employeeId || '—'}</span>
                  <span>{inspectedRequest.employee?.department || '—'}</span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-gray-500">Requested date</p>
                <p className="mt-1 break-words text-sm font-medium text-gray-200">{formatDate(inspectedRequest.requestedDate, 'EEEE, MMMM dd, yyyy')}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-gray-500">Submitted on</p>
                <p className="mt-1 break-words text-sm text-gray-200">{formatDateTime(inspectedRequest.createdAt, 'MMM dd, yyyy, hh:mm a')}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {inspectionType === 'reason' ? 'Employee reason' : 'Admin remarks'}
              </p>
              <p className="mt-2 max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-200">
                {inspectionType === 'reason'
                  ? (inspectedRequest.reason || '—')
                  : (inspectedRequest.reviewComment || '—')}
              </p>
            </div>
            {inspectionType === 'review' && inspectedRequest.reviewer?.name && (
              <p className="text-xs text-gray-500">
                Reviewed by <span className="font-medium text-gray-300">{inspectedRequest.reviewer.name}</span>
              </p>
            )}
            <Button variant="outline" className="w-full sm:ml-auto sm:w-auto" onClick={() => setInspectedRequest(null)}>
              Close
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default WFHPage;
