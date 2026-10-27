import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { adminInviteService } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';

const initialForm = {
  name: '',
  email: '',
  department: '',
  designation: 'HR Administrator',
  password: '',
};

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—';

export const AdminInvitesPage = () => {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState(null);

  const loadAdmins = useCallback(async () => {
    setIsLoading(true);
    setPageError('');
    try {
      const response = await adminInviteService.getAll();
      setAdmins(response.data || []);
    } catch (error) {
      setPageError(error.message || 'Could not load administrator accounts.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleInvite = async (event) => {
    event.preventDefault();
    setFormError('');
    setNotice(null);

    if (form.password.length < 8) {
      setFormError('Use a password with at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await adminInviteService.invite({
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        department: form.department.trim(),
        designation: form.designation.trim(),
      });
      const createdAdmin = response.data;
      setAdmins((current) => [createdAdmin, ...current.filter((admin) => admin._id !== createdAdmin._id)]);
      setForm(initialForm);
      setShowPassword(false);
      setNotice({
        type: createdAdmin.emailSent ? 'success' : 'warning',
        message: response.message,
      });
    } catch (error) {
      setFormError(error.message || 'Could not create the administrator account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6">
      <header className="rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-cyan-500/10 via-navy-900/80 to-primary-600/10 p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Super Admin Control</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Admin Invitations</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Create trusted HR administrator accounts. Passwords are securely hashed before storage; invitees sign in with their email and the password you provide.
            </p>
          </div>
        </div>
      </header>

      {notice && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
            notice.type === 'success'
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
              : 'border-amber-500/25 bg-amber-500/10 text-amber-100'
          }`}
        >
          {notice.type === 'success' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />}
          <span>{notice.message}</span>
        </div>
      )}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <Card title="Invite an administrator" subtitle="Create an active HR admin account with access to the admin portal." className="h-fit">
          <form onSubmit={handleInvite} className="space-y-4">
            <Input label="Full name" name="name" placeholder="e.g. Aditi Sharma" icon={Users} value={form.name} onChange={updateField} maxLength={100} required disabled={isSubmitting} />
            <Input label="Work email" name="email" type="email" placeholder="admin@company.com" icon={Mail} value={form.email} onChange={updateField} required disabled={isSubmitting} autoComplete="email" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Department" name="department" placeholder="e.g. Human Resources" icon={Building2} value={form.department} onChange={updateField} maxLength={100} required disabled={isSubmitting} />
              <Input label="Designation" name="designation" placeholder="HR Administrator" value={form.designation} onChange={updateField} maxLength={100} required disabled={isSubmitting} />
            </div>
            <div className="relative">
              <Input
                label="Temporary sign-in password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 8 characters"
                value={form.password}
                onChange={updateField}
                minLength={8}
                maxLength={128}
                required
                disabled={isSubmitting}
                autoComplete="new-password"
                helperText="Use 8+ characters with uppercase, lowercase, and a number. Share it securely."
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-3 top-9 rounded-md p-1 text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {formError && (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </p>
            )}
            <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting} icon={Send} className="w-full sm:w-auto">
              Create account &amp; send invite
            </Button>
          </form>
        </Card>

        <Card title="Invitation security" subtitle="Keep access limited to people who need it." bodyClassName="space-y-4">
          <div className="flex gap-3 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-cyan-300" />
            <div>
              <p className="text-sm font-semibold text-white">Super Admin only</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">The API independently checks your Super Admin role before allowing invitations or listing admin accounts.</p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <Mail className="h-5 w-5 shrink-0 text-sky-300" />
            <div>
              <p className="text-sm font-semibold text-white">Email never contains the password</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">The email notifies the invitee. Give them the password through a separate trusted channel.</p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <Clock3 className="h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-semibold text-white">Account is ready immediately</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">The new administrator can sign in with their email and provided password as soon as the account is created.</p>
            </div>
          </div>
          <p className="text-xs leading-5 text-slate-500">For best security, send a temporary password and ask the administrator to change it after signing in.</p>
        </Card>
      </div>

      <Card
        title="Administrator accounts"
        subtitle={`${admins.length} account${admins.length === 1 ? '' : 's'} shown`}
        action={<Button variant="outline" size="sm" icon={RefreshCw} onClick={loadAdmins} disabled={isLoading}>Refresh</Button>}
      >
        {pageError ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-rose-200">{pageError}</p>
            <Button variant="outline" size="sm" onClick={loadAdmins}>Try again</Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3" aria-label="Loading administrator accounts">
            {[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-white/5" />)}
          </div>
        ) : admins.length === 0 ? (
          <div className="py-10 text-center">
            <UserPlus className="mx-auto h-8 w-8 text-slate-500" />
            <p className="mt-3 text-sm font-semibold text-white">No invited administrators yet</p>
            <p className="mt-1 text-xs text-slate-400">New admin accounts will appear here after you invite them.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-3 font-semibold">Administrator</th>
                  <th className="px-3 py-3 font-semibold">Department</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {admins.map((admin) => (
                  <tr key={admin._id} className="text-slate-300">
                    <td className="px-3 py-4">
                      <p className="font-medium text-white">{admin.name}</p>
                      <p className="mt-0.5 break-all text-xs text-slate-400">{admin.email}</p>
                      <p className="mt-1 font-mono text-[11px] text-cyan-300">{admin.employeeId}</p>
                    </td>
                    <td className="px-3 py-4">
                      <p>{admin.department}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{admin.designation}</p>
                    </td>
                    <td className="px-3 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${admin.isActive ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-slate-500/20 bg-slate-500/10 text-slate-400'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${admin.isActive ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                        {admin.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-xs text-slate-400">{formatDate(admin.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
