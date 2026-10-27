import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Calendar,
  Clock,
  Edit3,
  AlertTriangle,
  FileSpreadsheet,
  Grid,
  List,
  ChevronLeft,
  ChevronRight,
  Building,
  Hash,
} from 'lucide-react';
import { reportsService, attendanceService, employeeService } from '../../services/api';
import {
  formatDate,
  formatTime,
  formatDuration,
} from '../../utils/formatters';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import ErrorState from '../../components/ui/ErrorState';

export const AttendancePage = () => {
  const [viewMode, setViewMode] = useState('excel'); // 'list' or 'excel'
  const [records, setRecords] = useState([]);
  const [totals, setTotals] = useState({
    totalRecords: 0,
    totalPresent: 0,
    totalLate: 0,
    totalWFH: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);

  // Filters for List view
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchEmployee, setSearchEmployee] = useState('');

  // Datesheet / Excel View state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [matrixData, setMatrixData] = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixError, setMatrixError] = useState('');
  const [departments, setDepartments] = useState([]);
  const [departmentsError, setDepartmentsError] = useState('');
  const matrixRequestRef = useRef(0);
  const [deptFilter, setDeptFilter] = useState('');
  const [matrixSearch, setMatrixSearch] = useState('');

  // Cell Detail Modal State (Show image, timestamp, employee info)
  const [selectedCellDetail, setSelectedCellDetail] = useState(null);
  const [isCellDetailOpen, setIsCellDetailOpen] = useState(false);

  // Correction Modal state
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    checkIn: '',
    checkOut: '',
    status: 'present',
    reason: '',
  });
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [correctionError, setCorrectionError] = useState('');

  // Format date helper for datetime-local input (YYYY-MM-DDTHH:mm)
  const toDateTimeLocal = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  // Fetch Attendance Records for List view
  const fetchRecords = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = {
          page,
          limit: 15,
        };
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        if (statusFilter) params.status = statusFilter;
        if (searchEmployee.trim()) params.employeeId = searchEmployee.trim();

        const res = await reportsService.getAttendance(params);
        const data = res.data || res;
        setRecords(data.records || []);
        if (data.totals) setTotals(data.totals);
        if (res.pagination) setPagination(res.pagination);
      } catch (err) {
        console.error('Failed to load attendance:', err);
        setError(err.message || 'Failed to retrieve attendance logs');
      } finally {
        setIsLoading(false);
      }
    },
    [startDate, endDate, statusFilter, searchEmployee]
  );

  // Fetch Excel / Datesheet Matrix Data
  const fetchMatrix = useCallback(async () => {
    const requestId = ++matrixRequestRef.current;
    setMatrixLoading(true);
    setMatrixError('');
    try {
      const params = { month: selectedMonth };
      if (deptFilter) params.department = deptFilter;
      const res = await reportsService.getMatrix(params);
      const data = res?.data?.data || res?.data || res;
      if (!Array.isArray(data?.rows) || !Array.isArray(data?.days)) {
        throw new Error('Attendance matrix response was incomplete.');
      }
      if (requestId === matrixRequestRef.current) setMatrixData(data);
    } catch (err) {
      console.error('Failed to fetch attendance matrix:', err);
      if (requestId === matrixRequestRef.current) {
        setMatrixError(err.message || 'Failed to load attendance datesheet');
      }
    } finally {
      if (requestId === matrixRequestRef.current) setMatrixLoading(false);
    }
  }, [selectedMonth, deptFilter]);

  useEffect(() => {
    let isCurrent = true;
    employeeService.getDepartments()
      .then((res) => {
        if (isCurrent) setDepartments(res?.data || []);
      })
      .catch((err) => {
        console.error('Failed to load attendance departments:', err);
        if (isCurrent) setDepartmentsError(err.message || 'Unable to load departments');
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (viewMode === 'list') {
      fetchRecords(1);
    } else {
      fetchMatrix();
    }
  }, [viewMode, fetchRecords, fetchMatrix]);

  // Handle month navigation in Excel view
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Export CSV Handler
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (statusFilter) params.status = statusFilter;
      if (searchEmployee.trim()) params.employeeId = searchEmployee.trim();

      const response = await reportsService.exportCSV(params);
      const blob = new Blob([response], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `attendance_report_${new Date().toISOString().split('T')[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Failed to export CSV report');
    } finally {
      setIsExporting(false);
    }
  };

  // Open Correction Modal
  const handleOpenCorrection = (record) => {
    setSelectedRecord(record);
    setCorrectionError('');
    setCorrectionForm({
      checkIn: toDateTimeLocal(record.checkIn),
      checkOut: toDateTimeLocal(record.checkOut),
      status: record.status || 'present',
      reason: '',
    });
    setIsCorrectionOpen(true);
  };

  const handleSubmitCorrection = async (e) => {
    e.preventDefault();
    if (!correctionForm.reason || correctionForm.reason.trim().length < 10) {
      setCorrectionError('Reason must be at least 10 characters long.');
      return;
    }

    setCorrectionError('');
    setIsSubmittingCorrection(true);

    try {
      const payload = {
        reason: correctionForm.reason.trim(),
        status: correctionForm.status,
        checkIn: correctionForm.checkIn ? new Date(correctionForm.checkIn).toISOString() : undefined,
        checkOut: correctionForm.checkOut ? new Date(correctionForm.checkOut).toISOString() : undefined,
      };

      await attendanceService.correct(selectedRecord._id, payload);
      setIsCorrectionOpen(false);
      if (viewMode === 'list') {
        await fetchRecords(pagination.page);
      } else {
        await fetchMatrix();
      }
    } catch (err) {
      setCorrectionError(err.message || 'Failed to save correction.');
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  // Filter matrix rows by search query
  const filteredMatrixRows = (matrixData?.rows || []).filter((r) => {
    if (!matrixSearch.trim()) return true;
    const q = matrixSearch.toLowerCase();
    return (
      r.employee?.name?.toLowerCase().includes(q) ||
      r.employee?.employeeId?.toLowerCase().includes(q) ||
      r.employee?.department?.toLowerCase().includes(q)
    );
  });
  const selectedCellStatus = selectedCellDetail?.attInfo?.status === 'not_recorded'
    ? 'No record'
    : selectedCellDetail?.attInfo?.status === 'weekend'
    ? 'Weekend off'
    : selectedCellDetail?.attInfo?.status || 'No record';

  // Table Columns for list view
  const columns = [
    {
      key: 'employeeId',
      label: 'Emp ID',
      render: (row) => (
        <span className="font-mono font-semibold text-cyan-400">
          {row.employee?.employeeId || '-'}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Employee Name',
      render: (row) => (
        <div>
          <span className="font-medium text-white">{row.employee?.name || '-'}</span>
          <span className="text-xs text-gray-500 block">
            {row.employee?.department || '-'}
          </span>
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (row) => formatDate(row.date, 'MMM dd, yyyy'),
    },
    {
      key: 'day',
      label: 'Day',
      render: (row) => formatDate(row.date, 'EEEE'),
    },
    {
      key: 'checkIn',
      label: 'Check-In',
      render: (row) => (
        <span className="font-mono text-gray-300">
          {row.checkIn ? formatTime(row.checkIn) : '--:--'}
        </span>
      ),
    },
    {
      key: 'checkOut',
      label: 'Check-Out',
      render: (row) => (
        <span className="font-mono text-gray-300">
          {row.checkOut ? formatTime(row.checkOut) : '--:--'}
        </span>
      ),
    },
    {
      key: 'duration',
      label: 'Duration',
      render: (row) => (
        <span className="text-xs text-gray-300">
          {formatDuration(row.workingMinutes)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge status={row.status} size="sm" />,
    },
    {
      key: 'method',
      label: 'Method',
      render: (row) => (
        <span className="text-xs uppercase font-mono text-gray-400">
          {row.method ? row.method.replace('_', ' ') : 'QR SCAN'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Action',
      cellClassName: 'text-right',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpenCorrection(row)}
          className="text-xs py-1 px-2.5"
        >
          <Edit3 className="w-3.5 h-3.5 mr-1 text-cyan-400" />
          Correct
        </Button>
      ),
    },
  ];

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* Header, View Toggle and Export Action */}
      <div className="flex w-full min-w-0 max-w-full flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h1 className="flex min-w-0 flex-wrap items-center gap-2 text-[clamp(1.3rem,5vw,1.875rem)] font-bold leading-tight tracking-tight text-white">
            <span>Attendance</span>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-mono font-normal text-cyan-300 sm:text-xs">
              Live Datesheet
            </span>
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-400 sm:text-sm">
            Backend attendance records by employee and day. Dates without a stored record remain unrecorded.
          </p>
        </div>

        <div className="flex w-full min-w-0 max-w-full flex-col gap-2 xl:w-auto xl:flex-row">
          {/* View Mode Toggle */}
          <div className="grid w-full min-w-0 max-w-full flex-1 grid-cols-2 rounded-xl border border-white/10 bg-navy-900 p-1 xl:w-auto xl:flex-none">
            <button
              type="button"
              onClick={() => setViewMode('excel')}
              className={`flex min-h-10 w-full min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-lg px-2 py-2 text-xs font-medium transition sm:px-3 ${
                viewMode === 'excel'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Grid className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">Datesheet</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex min-h-10 w-full min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-lg px-2 py-2 text-xs font-medium transition sm:px-3 ${
                viewMode === 'list'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <List className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">List View</span>
            </button>
          </div>

          <Button
            variant="secondary"
            onClick={handleExportCSV}
            isLoading={isExporting}
            icon={FileSpreadsheet}
            className="w-full min-w-0 border border-white/10 hover:border-cyan-400/50 xl:w-auto"
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXCEL DATESHEET MATRIX VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'excel' && (
        <div className="space-y-4">
          {/* Datesheet Controls bar */}
          <div className="grid min-w-0 grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-3 shadow-card sm:p-4 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-center">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-navy-800 text-gray-300 transition-colors hover:bg-navy-700 hover:text-white"
                title="Previous Month"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="min-h-10 min-w-0 w-full rounded-xl border border-white/10 bg-navy-900 px-2 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 sm:w-auto sm:px-3 sm:text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-navy-800 text-gray-300 transition-colors hover:bg-navy-700 hover:text-white"
                title="Next Month"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center">
              {/* Legend Badges */}
              <div className="col-span-full flex flex-wrap items-center gap-2 text-[10px] text-gray-300 xl:border-r xl:border-white/10 xl:pr-4 xl:mr-2 sm:text-xs">
                <span className="flex items-center gap-1 font-mono">
                  <span className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">P</span> Present
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">L</span> Late
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <span className="w-5 h-5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold">W</span> WFH
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <span className="w-5 h-5 rounded bg-white/5 text-gray-400 border border-white/10 flex items-center justify-center">WO</span> Off
                </span>
                <span className="flex items-center gap-1 font-mono">I Incomplete</span>
              </div>

              {/* Department Filter */}
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="min-h-10 min-w-0 w-full rounded-xl border border-white/10 bg-navy-900 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 sm:w-auto xl:w-auto"
              >
                <option value="">All Departments</option>
                {departments.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>

              {/* Quick Search */}
              <div className="relative min-w-0">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter name or ID..."
                  value={matrixSearch}
                  onChange={(e) => setMatrixSearch(e.target.value)}
                  className="min-h-10 w-full rounded-xl border border-white/10 bg-navy-900 py-2 pl-8 pr-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 sm:w-full xl:w-56"
                />
              </div>
            </div>
          </div>

          {/* Matrix Table Container */}
          <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden shadow-2xl backdrop-blur-sm">
            {departmentsError && (
              <p className="border-t border-white/[0.06] px-4 py-2 text-xs text-amber-300" role="status">
                Department filters could not be loaded: {departmentsError}
              </p>
            )}
            {matrixError ? (
              <div className="p-5 sm:p-8">
                <ErrorState message={matrixError} onRetry={fetchMatrix} />
              </div>
            ) : matrixLoading ? (
              <div className="py-24 text-center">
                <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-gray-400">Loading Excel attendance datesheet...</p>
              </div>
            ) : filteredMatrixRows.length === 0 ? (
              <div className="py-20 text-center text-gray-400 text-sm">
                {matrixData?.rows?.length
                  ? 'No employees match this search.'
                  : 'No live attendance or employee records are available for this selection.'}
              </div>
            ) : (
              <div className="relative max-h-[70vh] overflow-auto overscroll-x-contain">
                <p className="sticky left-0 z-10 border-b border-white/[0.06] bg-navy-950 px-3 py-2 text-[11px] text-gray-500 sm:hidden">
                  Swipe horizontally to view the full month
                </p>
                <table className="w-max min-w-full text-left text-xs border-collapse">
                  {/* Table Header: Sticky on scroll */}
                  <thead className="bg-navy-950/95 text-gray-300 sticky top-0 z-20 backdrop-blur-md shadow-md">
                    <tr className="border-b border-white/10">
                      {/* Fixed Left Columns */}
                      <th className="sticky left-0 z-30 w-[112px] min-w-[112px] border-r border-white/10 bg-navy-950/95 px-3 py-3 font-semibold text-white">
                        ID
                      </th>
                      <th className="sticky left-28 z-30 w-[190px] min-w-[190px] border-r border-white/10 bg-navy-950/95 px-4 py-3 font-semibold text-white shadow-[4px_0_10px_rgba(0,0,0,0.3)]">
                        Employee Name
                      </th>

                      {/* Day Columns (1 to 31) */}
                      {(matrixData?.days || []).map((d) => (
                        <th
                          key={d.day}
                          className={`min-w-[36px] border-r border-white/5 px-1 py-2 text-center font-mono font-medium ${
                            d.isWeekend
                              ? 'bg-navy-900/40 text-gray-500'
                              : 'text-gray-300 hover:bg-white/5'
                          }`}
                        >
                          <div className="text-[10px] uppercase font-bold text-gray-400">{d.dayOfWeek[0]}</div>
                          <div className="text-xs font-semibold">{d.day}</div>
                        </th>
                      ))}

                      {/* Summary Columns */}
                      <th className="py-3 px-2 text-center font-semibold text-emerald-400 bg-emerald-500/10 border-l border-white/10 min-w-[45px]">
                        P
                      </th>
                      <th className="py-3 px-2 text-center font-semibold text-amber-400 bg-amber-500/10 min-w-[45px]">
                        L
                      </th>
                      <th className="py-3 px-2 text-center font-semibold text-sky-400 bg-sky-500/10 min-w-[45px]">
                        W
                      </th>
                      <th className="py-3 px-2 text-center font-semibold text-gray-300 bg-white/[0.04] min-w-[45px]">
                        I
                      </th>
                      <th className="py-3 px-3 text-center font-bold text-white bg-navy-900 border-l border-white/10 min-w-[65px]">
                        Total
                      </th>
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-white/5 font-mono">
                    {filteredMatrixRows.map((row) => (
                      <tr
                        key={row.employee._id}
                        className="hover:bg-white/5 transition-colors group"
                      >
                        {/* Sticky ID */}
                        <td className="sticky left-0 z-10 w-[112px] min-w-[112px] border-r border-white/10 bg-navy-950/90 px-3 py-2 font-bold text-cyan-400 group-hover:bg-navy-900">
                          {row.employee.employeeId}
                        </td>

                        {/* Sticky Name */}
                        <td className="sticky left-28 z-10 w-[190px] min-w-[190px] border-r border-white/10 bg-navy-950/90 px-4 py-2 shadow-[4px_0_10px_rgba(0,0,0,0.3)] group-hover:bg-navy-900">
                          <div className="font-sans font-medium text-white truncate max-w-[160px]">
                            {row.employee.name}
                          </div>
                          <div className="font-sans text-[10px] text-gray-400 truncate">
                            {row.employee.department}
                          </div>
                        </td>

                        {/* Attendance Cells for each day */}
                        {(matrixData?.days || []).map((d) => {
                          const att = row.dailyAttendance[d.day];
                          let cellColor = 'bg-transparent text-gray-500';

                          if (att?.status === 'present') {
                            cellColor = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold';
                          } else if (att?.status === 'late') {
                            cellColor = 'bg-amber-500/25 text-amber-300 border border-amber-500/50 font-bold';
                          } else if (att?.status === 'wfh') {
                            cellColor = 'bg-sky-500/25 text-sky-300 border border-sky-500/50 font-bold';
                          } else if (att?.status === 'incomplete') {
                            cellColor = 'bg-white/10 text-gray-200 border border-white/15 font-bold';
                          } else if (d.isWeekend) {
                            cellColor = 'bg-navy-900/30 text-gray-600';
                          } else if (att?.status === 'not_recorded') {
                            cellColor = 'bg-transparent text-gray-600';
                          }

                          return (
                            <td
                              key={d.day}
                              className={`py-1 px-0.5 text-center border-r border-white/5 ${
                                d.isWeekend ? 'bg-navy-900/30' : ''
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCellDetail({
                                    employee: row.employee,
                                    dayInfo: d,
                                    attInfo: att,
                                  });
                                  setIsCellDetailOpen(true);
                                }}
                                className={`flex h-8 w-8 min-w-[32px] items-center justify-center rounded-md text-[10px] transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400 ${cellColor}`}
                                title={`Click to view details: ${row.employee.name} on ${d.date}`}
                              >
                                {att?.label || '-'}
                              </button>
                            </td>
                          );
                        })}

                        {/* Summary Count Badges */}
                        <td className="py-2 px-1 text-center font-bold text-emerald-400 bg-emerald-500/5 border-l border-white/10">
                          {row.summary.present}
                        </td>
                        <td className="py-2 px-1 text-center font-bold text-amber-400 bg-amber-500/5">
                          {row.summary.late}
                        </td>
                        <td className="py-2 px-1 text-center font-bold text-sky-400 bg-sky-500/5">
                          {row.summary.wfh}
                        </td>
                        <td className="py-2 px-1 text-center font-bold text-gray-300 bg-white/[0.03]">
                          {row.summary.incomplete}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-white bg-navy-900/50 border-l border-white/10">
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            {row.summary.totalPresent}d
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STANDARD LIST VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Summary Stat Pills */}
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
              <span className="text-gray-400">Records</span>
              <span className="font-bold tabular-nums text-white">{totals.totalRecords ?? 0}</span>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <span className="text-emerald-300">Present</span>
              <span className="font-bold tabular-nums text-emerald-400">{totals.totalPresent ?? 0}</span>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
              <span className="text-amber-300">Late</span>
              <span className="font-bold tabular-nums text-amber-400">{totals.totalLate ?? 0}</span>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3">
              <span className="text-sky-300">WFH</span>
              <span className="font-bold tabular-nums text-sky-400">{totals.totalWFH ?? 0}</span>
            </div>
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4 xl:grid-cols-4">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              placeholder="All Statuses"
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'present', label: 'Present' },
                { value: 'late', label: 'Late' },
                { value: 'wfh', label: 'WFH' },
                { value: 'incomplete', label: 'Incomplete' },
                { value: 'not_checked_in', label: 'Not Checked In' },
              ]}
            />
            <Input
              label="Employee Filter"
              placeholder="Search by Emp ID..."
              value={searchEmployee}
              onChange={(e) => setSearchEmployee(e.target.value)}
            />
          </div>

          {/* Error state */}
          {error && <ErrorState message={error} onRetry={() => fetchRecords(1)} />}

          {/* Records Table */}
          {!error && (
            <div className="space-y-2">
              <div className="hidden md:block">
                <Table
                  columns={columns}
                  data={records}
                  isLoading={isLoading}
                  emptyMessage="No attendance records found matching filters"
                />
              </div>
              <div className="space-y-3 md:hidden">
                {isLoading && records.length === 0 ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="card-premium h-40 animate-pulse" />
                  ))
                ) : records.length === 0 ? (
                  <div className="card-premium px-4 py-10 text-center text-sm text-gray-400">
                    No attendance records found matching filters
                  </div>
                ) : (
                  records.map((record) => (
                    <article key={record._id} className="card-premium min-w-0 p-4">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-cyan-300">
                            <Hash className="h-3.5 w-3.5 shrink-0" />
                            {record.employee?.employeeId || 'ID unavailable'}
                          </span>
                          <h2 className="mt-1 break-words text-base font-semibold text-white">
                            {record.employee?.name || 'Employee unavailable'}
                          </h2>
                          <p className="mt-1 flex min-w-0 items-center gap-1.5 break-words text-xs text-gray-400">
                            <Building className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                            {record.employee?.department || 'Department unavailable'}
                          </p>
                        </div>
                        <Badge status={record.status} size="sm" />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-3 text-xs">
                        <div className="min-w-0">
                          <span className="flex items-center gap-1.5 text-gray-500">
                            <Calendar className="h-3.5 w-3.5" />
                            Date
                          </span>
                          <p className="mt-1 break-words font-medium text-gray-200">
                            {formatDate(record.date, 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <span className="flex items-center gap-1.5 text-gray-500">
                            <Clock className="h-3.5 w-3.5" />
                            Duration
                          </span>
                          <p className="mt-1 font-medium text-gray-200">
                            {formatDuration(record.workingMinutes)}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <span className="text-gray-500">Check-in</span>
                          <p className="mt-1 font-mono font-medium text-gray-200">
                            {record.checkIn ? formatTime(record.checkIn) : '--:--'}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <span className="text-gray-500">Check-out</span>
                          <p className="mt-1 font-mono font-medium text-gray-200">
                            {record.checkOut ? formatTime(record.checkOut) : '--:--'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-white/[0.07] bg-navy-950/60 p-3 text-xs">
                        <p className="font-semibold text-gray-300">Attendance verification</p>
                        {record.verification?.locationVerified ? (
                          <div className="mt-1 space-y-1 text-gray-400">
                            <p>
                              Check-in location verified: {Math.round(record.verification.distanceMeters)}m from office
                              (GPS accuracy ±{Math.round(record.verification.gpsAccuracyMeters)}m)
                            </p>
                            <p>
                              Kiosk: {record.qrDisplayId?.displayName || 'Office kiosk'}
                              {record.verification.selfieCaptured ? ' · Tablet photo captured' : ''}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-1 text-gray-500">No verification details recorded for this entry.</p>
                        )}
                        {record.checkoutVerification?.locationVerified && (
                          <p className="mt-1 text-gray-400">
                            Check-out verified: {Math.round(record.checkoutVerification.distanceMeters)}m from office
                            (GPS accuracy ±{Math.round(record.checkoutVerification.gpsAccuracyMeters)}m)
                            {record.checkoutVerification.selfieCaptured ? ' · Tablet photo captured' : ''}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
                        <span className="min-w-0 truncate text-[11px] uppercase text-gray-500">
                          {record.method ? record.method.replace('_', ' ') : 'Method unavailable'}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenCorrection(record)}
                          className="shrink-0"
                        >
                          <Edit3 className="mr-1.5 h-4 w-4 text-cyan-400" />
                          Correct
                        </Button>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={(p) => fetchRecords(p)}
              />
            </div>
          )}
        </div>
      )}


      {/* Manual Correction Modal */}
      <Modal
        isOpen={isCorrectionOpen}
        onClose={() => setIsCorrectionOpen(false)}
        title="Apply Attendance Record Correction"
        size="md"
      >
        <form onSubmit={handleSubmitCorrection} className="space-y-4">
          {correctionError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{correctionError}</span>
            </div>
          )}

          {/* Current Values Info Box */}
          {selectedRecord && (
            <div className="p-3 rounded-xl bg-navy-950 border border-white/10 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Target Employee:</span>
                <span className="font-semibold text-white">
                  {selectedRecord.employee?.name} ({selectedRecord.employee?.employeeId})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Record Date:</span>
                <span className="text-white">
                  {formatDate(selectedRecord.date, 'MMMM dd, yyyy')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Current Check-In / Out:</span>
                <span className="font-mono text-cyan-400">
                  {selectedRecord.checkIn ? formatTime(selectedRecord.checkIn) : '--'} -{' '}
                  {selectedRecord.checkOut ? formatTime(selectedRecord.checkOut) : '--'}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Check-In Timestamp
              </label>
              <input
                type="datetime-local"
                value={correctionForm.checkIn}
                onChange={(e) =>
                  setCorrectionForm({ ...correctionForm, checkIn: e.target.value })
                }
                className="w-full rounded-lg bg-navy-800/50 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Check-Out Timestamp
              </label>
              <input
                type="datetime-local"
                value={correctionForm.checkOut}
                onChange={(e) =>
                  setCorrectionForm({ ...correctionForm, checkOut: e.target.value })
                }
                className="w-full rounded-lg bg-navy-800/50 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <Select
            label="Corrected Attendance Status"
            value={correctionForm.status}
            onChange={(e) =>
              setCorrectionForm({ ...correctionForm, status: e.target.value })
            }
            options={[
              { value: 'present', label: 'Present' },
              { value: 'late', label: 'Late' },
              { value: 'wfh', label: 'Work From Home (WFH)' },
              { value: 'incomplete', label: 'Incomplete' },
            ]}
          />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Correction Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={correctionForm.reason}
              onChange={(e) =>
                setCorrectionForm({ ...correctionForm, reason: e.target.value })
              }
              placeholder="Provide a mandatory detailed explanation for this manual correction (minimum 10 characters)..."
              className="w-full rounded-lg bg-navy-800/50 border border-white/10 p-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Audit Warning */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start space-x-2 text-amber-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Permanent Audit Trail:</strong> This correction and your admin identity will be permanently logged in the immutable system audit log.
            </span>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-white/10 pt-3 sm:flex-row sm:justify-end sm:space-x-3 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setIsCorrectionOpen(false)}
              disabled={isSubmittingCorrection}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmittingCorrection}
              className="w-full sm:w-auto"
            >
              Apply Correction
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* DAY ATTENDANCE DETAIL MODAL (Photo, Timestamp, Employee Info) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCellDetailOpen}
        onClose={() => setIsCellDetailOpen(false)}
        title="Attendance Record Details"
        size="md"
      >
        {selectedCellDetail && (
          <div className="space-y-4">
            {/* Employee Info Header */}
            <div className="flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-navy-950 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <span className="font-mono text-xs font-bold text-cyan-400 block">
                  {selectedCellDetail.employee?.employeeId}
                </span>
                <h4 className="text-base font-bold text-white">
                  {selectedCellDetail.employee?.name}
                </h4>
                <p className="text-xs text-gray-400">
                  {selectedCellDetail.employee?.department} &bull; {selectedCellDetail.employee?.designation}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs text-gray-400 block font-mono">Date</span>
                <span className="text-sm font-semibold text-white">
                  {selectedCellDetail.dayInfo?.date}
                </span>
                <span className="text-[10px] text-gray-500 block uppercase">
                  ({selectedCellDetail.dayInfo?.dayOfWeek})
                </span>
              </div>
            </div>

            {/* Attendance Status & Times Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs text-gray-400 block mb-1">Status</span>
                <span
                  className={`text-sm font-bold uppercase px-2 py-0.5 rounded inline-block ${
                    selectedCellDetail.attInfo?.status === 'present'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : selectedCellDetail.attInfo?.status === 'late'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : selectedCellDetail.attInfo?.status === 'wfh'
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                        : selectedCellDetail.dayInfo?.isWeekend || selectedCellStatus === 'No record'
                      ? 'bg-white/5 text-gray-400'
                        : 'bg-white/5 text-gray-300'
                  }`}
                >
                  {selectedCellStatus}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs text-gray-400 block mb-1">Recorded Check-In</span>
                <span className="text-sm font-mono font-bold text-cyan-300">
                  {selectedCellDetail.attInfo?.checkIn
                    ? formatTime(selectedCellDetail.attInfo.checkIn)
                    : '--:--'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs text-gray-400 block mb-1">Recorded Check-Out</span>
                <span className="text-sm font-mono font-bold text-gray-300">
                  {selectedCellDetail.attInfo?.checkOut
                    ? formatTime(selectedCellDetail.attInfo.checkOut)
                    : '--:--'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs text-gray-400 block mb-1">Total Duration</span>
                <span className="text-sm font-mono font-bold text-white">
                  {selectedCellDetail.attInfo?.workingMinutes
                    ? formatDuration(selectedCellDetail.attInfo.workingMinutes)
                    : '--'}
                </span>
              </div>
            </div>

            {/* Captured Photo Section */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <span className="text-xs font-semibold text-gray-300 block">
                Attendance Selfie (Captured at Check-In)
              </span>
              {selectedCellDetail.attInfo?.capturedPhoto ? (
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                  <div className="relative">
                    <img
                      src={selectedCellDetail.attInfo.capturedPhoto}
                      alt="Attendance Capture"
                      className="w-36 h-36 rounded-2xl object-cover border-2 border-cyan-400/60 shadow-xl"
                    />
                    <span className="absolute bottom-1 right-1 px-2 py-0.5 rounded-full bg-emerald-500 text-navy-950 font-bold text-[9px]">
                      CAPTURED
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 space-y-1 text-center sm:text-left">
                    <p className="text-white font-medium">Attendance selfie</p>
                    <p className="text-gray-400">
                      Captured on the employee device. No face-identity matching is performed.
                    </p>
                    <p className="text-cyan-400 font-mono text-[11px] pt-1">
                      Time: {formatTime(selectedCellDetail.attInfo.checkIn)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center rounded-xl bg-navy-950 border border-dashed border-white/10 text-gray-500 text-xs">
                  No verification image is attached to this attendance record.
                </div>
              )}
            </div>

            <div className="flex justify-stretch pt-2 sm:justify-end">
              <Button
                variant="primary"
                onClick={() => setIsCellDetailOpen(false)}
                className="w-full px-6 sm:w-auto"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AttendancePage;
