import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import {
  UserPlus,
  Search,
  Edit2,
  Power,
  AlertCircle,
  Building,
  Briefcase,
  Mail,
  Calendar,
  Monitor,
  CheckCircle,
  XCircle,
  Hash,
} from 'lucide-react';
import { employeeService } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import ErrorState from '../../components/ui/ErrorState';

export const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [departmentError, setDepartmentError] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null); // null = create mode
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Confirmation for status toggle
  const [statusDialog, setStatusDialog] = useState({
    isOpen: false,
    employee: null,
    newStatus: false,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  // Fetch employees list
  const fetchEmployees = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = {
          page,
          limit: 15,
        };
        if (searchTerm.trim()) params.search = searchTerm.trim();
        if (departmentFilter) params.department = departmentFilter;
        if (statusFilter !== '') params.isActive = statusFilter;

        const res = await employeeService.getAll(params);
        setEmployees(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } catch (err) {
        console.error('Failed to load employees:', err);
        setError(err.message || 'Failed to load employees');
      } finally {
        setIsLoading(false);
      }
    },
    [searchTerm, departmentFilter, statusFilter]
  );

  useEffect(() => {
    fetchEmployees(1);
  }, [fetchEmployees]);

  useEffect(() => {
    let isCurrent = true;

    employeeService.getDepartments()
      .then((res) => {
        if (isCurrent) setDepartments(res.data || []);
      })
      .catch((err) => {
        console.error('Failed to load employee departments:', err);
        if (isCurrent) setDepartmentError(err.message || 'Unable to load departments');
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setFormError('');
    reset({
      name: '',
      email: '',
      department: '',
      designation: '',
      joiningDate: new Date().toISOString().split('T')[0],
      workType: 'office',
      wfhEligible: false,
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (employee) => {
    setEditingEmployee(employee);
    setFormError('');
    reset({
      name: employee.name,
      email: employee.email || '',
      department: employee.department || '',
      designation: employee.designation || '',
      joiningDate: employee.joiningDate
        ? new Date(employee.joiningDate).toISOString().split('T')[0]
        : '',
      workType: employee.workType || 'office',
      wfhEligible: Boolean(employee.wfhEligible),
    });
    setIsModalOpen(true);
  };

  // Submit Create or Edit Form
  const onSubmit = async (values) => {
    setFormError('');
    setIsSaving(true);
    try {
      if (editingEmployee) {
        // Update
        const payload = {
          name: values.name.trim(),
          email: values.email?.trim() || undefined,
          department: values.department.trim(),
          designation: values.designation.trim(),
          joiningDate: values.joiningDate,
          workType: values.workType,
          wfhEligible: Boolean(values.wfhEligible),
        };
        await employeeService.update(editingEmployee._id, payload);
      } else {
        // Create
        const payload = {
          name: values.name.trim(),
          email: values.email?.trim() || undefined,
          department: values.department.trim(),
          designation: values.designation.trim(),
          joiningDate: values.joiningDate,
          workType: values.workType,
          wfhEligible: Boolean(values.wfhEligible),
        };
        await employeeService.create(payload);
      }

      setIsModalOpen(false);
      await fetchEmployees(pagination.page);
    } catch (err) {
      setFormError(err.message || 'Operation failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm Status Toggle
  const handleToggleStatusClick = (employee) => {
    setStatusDialog({
      isOpen: true,
      employee,
      newStatus: !employee.isActive,
    });
  };

  const handleConfirmStatusToggle = async () => {
    if (!statusDialog.employee) return;
    try {
      await employeeService.updateStatus(
        statusDialog.employee._id,
        statusDialog.newStatus
      );
      setStatusDialog({ isOpen: false, employee: null, newStatus: false });
      await fetchEmployees(pagination.page);
    } catch (err) {
      alert(err.message || 'Failed to update employee status');
    }
  };

  // Table columns definition
  const columns = [
    {
      key: 'employeeId',
      label: 'Employee ID',
      render: (row) => (
        <span className="font-mono font-semibold text-cyan-400">
          {row.employeeId}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Employee Name',
      render: (row) => (
        <div>
          <p className="font-medium text-white">{row.name}</p>
          <p className="text-xs text-gray-500">{row.email || 'No email'}</p>
        </div>
      ),
    },
    {
      key: 'department',
      label: 'Department',
      render: (row) => (
        <span className="text-gray-300">{row.department || '-'}</span>
      ),
    },
    {
      key: 'designation',
      label: 'Designation',
      render: (row) => (
        <span className="text-gray-300">{row.designation || '-'}</span>
      ),
    },
    {
      key: 'workType',
      label: 'Work Type',
      render: (row) => (
        <span className="capitalize text-xs font-medium px-2 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">
          {row.workType || 'office'}
        </span>
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
      key: 'wfhEligible',
      label: 'WFH',
      render: (row) =>
        row.wfhEligible ? (
          <span className="inline-flex items-center text-xs text-emerald-400 font-medium">
            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Yes
          </span>
        ) : (
          <span className="inline-flex items-center text-xs text-gray-500 font-medium">
            <XCircle className="w-3.5 h-3.5 mr-1" /> No
          </span>
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      cellClassName: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={() => handleOpenEdit(row)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={`Edit ${row.name}`}
            title="Edit Details"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleStatusClick(row)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
              row.isActive
                ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
            }`}
            aria-label={`${row.isActive ? 'Deactivate' : 'Activate'} ${row.name}`}
            title={row.isActive ? 'Deactivate Account' : 'Activate Account'}
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* Header and Add Button */}
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[clamp(1.35rem,5vw,1.875rem)] font-bold leading-tight text-white tracking-tight">
            Employee Directory
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-400 sm:text-sm">
            Manage company personnel, designations, work modes, and active status
          </p>
          {!isLoading && !error && (
            <p className="mt-2 text-xs text-gray-500">
              {pagination.total} {pagination.total === 1 ? 'employee' : 'employees'}
            </p>
          )}
        </div>
        <Button
          variant="primary"
          onClick={handleOpenCreate}
          icon={UserPlus}
          className="w-full shadow-glow font-semibold sm:w-auto"
        >
          Add Employee
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-3 shadow-card sm:grid-cols-2 sm:gap-4 sm:p-4 lg:grid-cols-3">
        <Input
          placeholder="Search by name, ID, or email..."
          icon={Search}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          placeholder="All Departments"
          options={[
            { value: '', label: 'All Departments' },
            ...departments.map((department) => ({ value: department, label: department })),
          ]}
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder="All Account Statuses"
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ]}
        />
      </div>
      {departmentError && (
        <p className="text-xs text-amber-300" role="status">{departmentError}</p>
      )}

      {/* Error state */}
      {error && <ErrorState message={error} onRetry={() => fetchEmployees(1)} />}

      {/* Employee Data Table */}
      {!error && (
        <div className="space-y-2">
          <div className="hidden md:block">
            <Table
              columns={columns}
              data={employees}
              isLoading={isLoading}
              emptyMessage="No employees found matching the filters"
            />
          </div>

          <div className="space-y-3 md:hidden">
            {isLoading && employees.length === 0 ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="card-premium h-36 animate-pulse" />
              ))
            ) : employees.length === 0 ? (
              <div className="card-premium px-4 py-10 text-center text-sm text-gray-400">
                No employees found matching the filters
              </div>
            ) : (
              employees.map((employee) => (
                <article key={employee._id} className="card-premium min-w-0 p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-cyan-300">
                        <Hash className="h-3.5 w-3.5" />
                        {employee.employeeId}
                      </span>
                      <h2 className="mt-1 break-words text-base font-semibold text-white">
                        {employee.name}
                      </h2>
                      {employee.email && (
                        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 break-all text-xs text-gray-400">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                          {employee.email}
                        </p>
                      )}
                    </div>
                    <Badge
                      status={employee.isActive ? 'active' : 'inactive'}
                      size="sm"
                      dot
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-3 text-xs">
                    <div className="min-w-0">
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <Building className="h-3.5 w-3.5 text-cyan-500" />
                        Department
                      </span>
                      <p className="mt-1 break-words font-medium text-gray-200">
                        {employee.department || '-'}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <Briefcase className="h-3.5 w-3.5 text-cyan-500" />
                        Designation
                      </span>
                      <p className="mt-1 break-words font-medium text-gray-200">
                        {employee.designation || '-'}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <Monitor className="h-3.5 w-3.5 text-cyan-500" />
                        Work type
                      </span>
                      <p className="mt-1 capitalize font-medium text-gray-200">
                        {employee.workType || 'office'}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <span className="flex items-center gap-1.5 text-gray-500">
                        {employee.wfhEligible
                          ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                          : <XCircle className="h-3.5 w-3.5 text-gray-500" />}
                        WFH
                      </span>
                      <p className="mt-1 font-medium text-gray-200">
                        {employee.wfhEligible ? 'Eligible' : 'Not eligible'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/[0.07] pt-3">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(employee)}
                      className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStatusClick(employee)}
                      className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-colors ${
                        employee.isActive
                          ? 'border-red-500/20 text-red-300 hover:bg-red-500/10'
                          : 'border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/10'
                      }`}
                    >
                      <Power className="h-4 w-4" />
                      {employee.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(p) => fetchEmployees(p)}
          />
        </div>
      )}

      {/* Create / Edit Employee Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEmployee ? 'Edit Employee Details' : 'Add New Employee'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {!editingEmployee && (
            <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.05] p-3.5">
              <span className="flex items-center gap-2 text-xs font-medium text-cyan-300">
                <Hash className="h-4 w-4" />
                Employee ID is generated automatically
              </span>
              <p className="mt-1 pl-6 text-xs text-gray-400">
                The next sequential ID will use the format VORLDX0001.
              </p>
            </div>
          )}

          {editingEmployee && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <span className="text-xs text-gray-500">Employee ID</span>
              <p className="mt-1 font-mono text-sm font-semibold text-cyan-300">
                {editingEmployee.employeeId}
              </p>
            </div>
          )}

          <Input
            label="Full Name"
            name="name"
            placeholder="e.g. Alex Morgan"
            register={register}
            error={errors.name}
            required
          />

          <Input
            label="Work Email"
            name="email"
            type="email"
            placeholder="e.g. alex.morgan@vorldx.com"
            register={register}
            error={errors.email}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Department"
              name="department"
              placeholder="e.g. Engineering"
              register={register}
              error={errors.department}
              required
            />
            <Input
              label="Designation"
              name="designation"
              placeholder="e.g. Senior Software Engineer"
              register={register}
              error={errors.designation}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Joining Date"
              name="joiningDate"
              type="date"
              register={register}
              error={errors.joiningDate}
              required
            />
            <Select
              label="Work Type"
              name="workType"
              register={register}
              error={errors.workType}
              placeholder=""
              options={[
                { value: 'office', label: 'Office Only' },
                { value: 'hybrid', label: 'Hybrid' },
                { value: 'remote', label: 'Fully Remote' },
              ]}
            />
          </div>

          {/* WFH Eligibility Checkbox */}
          <div className="pt-2">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('wfhEligible')}
                className="w-4 h-4 rounded bg-navy-800 border-white/20 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-300">
                Eligible for Work-From-Home (WFH)
              </span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
            <Button
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSaving}>
              {editingEmployee ? 'Save Changes' : 'Create Employee'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Dialog for Status Toggle */}
      <Modal
        isOpen={statusDialog.isOpen}
        onClose={() =>
          setStatusDialog({ isOpen: false, employee: null, newStatus: false })
        }
        title={statusDialog.newStatus ? 'Activate Employee' : 'Deactivate Employee'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            Are you sure you want to{' '}
            <strong className={statusDialog.newStatus ? 'text-emerald-400' : 'text-red-400'}>
              {statusDialog.newStatus ? 'activate' : 'deactivate'}
            </strong>{' '}
            account for{' '}
            <span className="text-white font-semibold">
              {statusDialog.employee?.name}
            </span>{' '}
            ({statusDialog.employee?.employeeId})?
          </p>

          {!statusDialog.newStatus && (
            <p className="text-xs text-amber-300/80 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
              Deactivated employees cannot check in, log into their portal, or submit WFH requests.
            </p>
          )}

          <div className="flex justify-end space-x-3 pt-3">
            <Button
              variant="ghost"
              onClick={() =>
                setStatusDialog({ isOpen: false, employee: null, newStatus: false })
              }
            >
              Cancel
            </Button>
            <Button
              variant={statusDialog.newStatus ? 'primary' : 'danger'}
              onClick={handleConfirmStatusToggle}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EmployeesPage;
