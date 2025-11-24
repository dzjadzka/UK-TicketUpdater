import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  ShieldExclamationIcon,
  TicketIcon
} from '@heroicons/react/24/outline';
import { adminAPI } from '../services/api';

const CredentialStatus = ({ credential }) => {
  if (!credential) {
    return <span className="badge badge-ghost">No credential</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="badge badge-success badge-outline">{credential.uk_number_masked || 'Masked'}</span>
      <span className={`badge ${credential.has_password ? 'badge-success' : 'badge-ghost'}`}>
        {credential.has_password ? 'Password stored' : 'Password missing'}
      </span>
      <span className="badge badge-ghost">Last login: {credential.last_login_status || 'Unknown'}</span>
    </div>
  );
};

const TicketList = ({ tickets }) => {
  if (!tickets?.length) {
    return <p className="text-sm text-base-content/70">No tickets recorded for this user yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Version</th>
            <th>Status</th>
            <th>Downloaded at</th>
            <th>File</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td>{ticket.ticket_version || ticket.version || 'N/A'}</td>
              <td>
                <span className={`badge badge-sm ${ticket.status === 'success' ? 'badge-success' : 'badge-warning'}`}>
                  {ticket.status || 'unknown'}
                </span>
              </td>
              <td>{ticket.downloaded_at || 'Unknown'}</td>
              <td className="max-w-xs truncate">{ticket.file_path || ticket.download_url || 'Not available'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ErrorList = ({ errors }) => {
  if (!errors?.length) {
    return <p className="text-sm text-base-content/70">No recent errors for this user.</p>;
  }
  return (
    <div className="space-y-2">
      {errors.map((err) => (
        <div key={err.id} className="rounded-lg border border-base-200 bg-base-100 p-3 text-sm">
          <div className="flex items-center gap-2 text-error">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <span>{err.error_message || err.message}</span>
          </div>
          <p className="text-xs text-base-content/70">{err.created_at || err.timestamp}</p>
        </div>
      ))}
    </div>
  );
};

const AdminUserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [errors, setErrors] = useState([]);
  const [ukNumber, setUkNumber] = useState('');
  const [ukPassword, setUkPassword] = useState('');
  const [autoDownload, setAutoDownload] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminAPI.getUser(id);
      const data = response.data;
      setDetail(data);
      setUkNumber('');
      setUkPassword('');
      setAutoDownload(!!data.user?.auto_download_enabled);
      setIsActive(!!data.user?.is_active);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load user');
    } finally {
      setLoading(false);
    }
  };

  const loadTickets = async () => {
    try {
      const response = await adminAPI.getUserTickets(id);
      setTickets(response.data.tickets || []);
    } catch {
      setTickets([]);
    }
  };

  const loadErrors = async () => {
    try {
      const response = await adminAPI.getRecentErrors({ limit: 50 });
      const rows = response.data.errors || [];
      setErrors(rows.filter((item) => item.user_id === id || item.userId === id));
    } catch {
      setErrors([]);
    }
  };

  useEffect(() => {
    loadDetail();
    loadTickets();
    loadErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleCredentialSave = async (event) => {
    event.preventDefault();
    setSaving('credentials');
    setMessage('');
    setError('');
    try {
      await adminAPI.updateUser(id, { ukNumber, ukPassword });
      setMessage('Credentials updated. Password is encrypted and never shown here.');
      await loadDetail();
      setUkPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update credentials');
    } finally {
      setSaving('');
    }
  };

  const handleFlagSave = async (event) => {
    event.preventDefault();
    setSaving('flags');
    setMessage('');
    setError('');
    try {
      await adminAPI.updateUser(id, { autoDownloadEnabled: autoDownload, isActive });
      setMessage('Settings updated successfully.');
      await loadDetail();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user');
    } finally {
      setSaving('');
    }
  };

  const disableUser = async () => {
    const confirmed = window.confirm('Disable this account? The user will no longer be able to log in.');
    if (!confirmed) return;
    setSaving('disable');
    setMessage('');
    setError('');
    try {
      await adminAPI.updateUser(id, { isActive: false });
      setMessage('User disabled.');
      await loadDetail();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disable user');
    } finally {
      setSaving('');
    }
  };

  const deleteUser = async () => {
    const confirmed = window.confirm('Delete this user? Tickets and history remain, but access will be removed.');
    if (!confirmed) return;
    setSaving('delete');
    setMessage('');
    setError('');
    try {
      await adminAPI.deleteUser(id);
      navigate('/admin/users');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
    } finally {
      setSaving('');
    }
  };

  const latestTicket = useMemo(() => detail?.last_ticket, [detail]);
  const stats = useMemo(() => detail?.ticket_stats || { success: 0, error: 0 }, [detail]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </button>
          <div>
            <h2 className="text-xl font-semibold text-base-content">{detail?.user?.email || 'User detail'}</h2>
            <p className="text-sm text-base-content/70">User ID: {id}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="badge badge-outline capitalize">{detail?.user?.role}</span>
          {detail?.user?.is_active ? (
            <span className="badge badge-success badge-outline">Active</span>
          ) : (
            <span className="badge badge-warning badge-outline">Disabled</span>
          )}
        </div>
      </div>

      {message && <div className="alert alert-success text-sm">{message}</div>}
      {error && <div className="alert alert-error text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="loading loading-spinner loading-lg" aria-label="Loading user" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-lg border border-base-200 bg-base-100 p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-base-content">
                <KeyIcon className="h-5 w-5" />
                <h3 className="font-semibold">Credential</h3>
              </div>
              <CredentialStatus credential={detail?.credential} />
              <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCredentialSave}>
                <div className="form-control">
                  <label className="label text-sm" htmlFor="uk-number-input">UK number</label>
                  <input
                    id="uk-number-input"
                    className="input input-bordered"
                    value={ukNumber}
                    onChange={(e) => setUkNumber(e.target.value)}
                    placeholder="Enter full UK number"
                    required
                  />
                  <label className="label text-xs text-base-content/70" htmlFor="uk-number-input">
                    Enter full number to replace stored credentials.
                  </label>
                </div>
                <div className="form-control">
                  <label className="label text-sm" htmlFor="uk-password-input">UK password</label>
                  <input
                    id="uk-password-input"
                    className="input input-bordered"
                    type="password"
                    value={ukPassword}
                    onChange={(e) => setUkPassword(e.target.value)}
                    placeholder="New password"
                    required
                  />
                  <label className="label text-xs text-base-content/70" htmlFor="uk-password-input">
                    Passwords are encrypted and never shown back.
                  </label>
                </div>
                <div className="md:col-span-2 flex justify-end gap-2">
                  <button type="submit" className={`btn btn-primary ${saving === 'credentials' ? 'loading' : ''}`}>
                    Save credentials
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-lg border border-base-200 bg-base-100 p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-base-content">
                <ShieldExclamationIcon className="h-5 w-5" />
                <h3 className="font-semibold">Flags</h3>
              </div>
              <form className="space-y-3" onSubmit={handleFlagSave}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-download</p>
                    <p className="text-sm text-base-content/70">Trigger background downloads for this user when jobs run.</p>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-info"
                    checked={autoDownload}
                    id="auto-download-toggle"
                    aria-label="Auto-download"
                    onChange={(e) => setAutoDownload(e.target.checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Active account</p>
                    <p className="text-sm text-base-content/70">Inactive accounts cannot log in or download tickets.</p>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-success"
                    checked={isActive}
                    id="active-toggle"
                    aria-label="Active account"
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="submit" className={`btn btn-primary ${saving === 'flags' ? 'loading' : ''}`}>
                    Save flags
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-lg border border-base-200 bg-base-100 p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-base-content">
                <TicketIcon className="h-5 w-5" />
                <h3 className="font-semibold">Tickets</h3>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="badge badge-outline">Success: {stats.success || 0}</span>
                <span className="badge badge-outline">Errors: {stats.error || 0}</span>
              </div>
              {latestTicket ? (
                <div className="rounded-lg border border-base-200 bg-base-100 p-3 text-sm space-y-1">
                  <p className="font-medium">Latest ticket</p>
                  <p>Version: {latestTicket.version || 'Unknown'}</p>
                  <p>Status: {latestTicket.status || 'Unknown'}</p>
                  <p>Downloaded: {latestTicket.downloaded_at || 'Unknown'}</p>
                  {latestTicket.download_url && (
                    <Link to={latestTicket.download_url} className="link link-primary" target="_blank" rel="noreferrer">
                      Open file
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-sm text-base-content/70">No tickets downloaded yet.</p>
              )}
              <TicketList tickets={tickets} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-base-200 bg-base-100 p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-error">
                <ExclamationCircleIcon className="h-5 w-5" />
                <h3 className="font-semibold">Recent errors</h3>
              </div>
              <ErrorList errors={errors} />
            </div>

            <div className="rounded-lg border border-base-200 bg-base-100 p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-warning">
                <ExclamationTriangleIcon className="h-5 w-5" />
                <h3 className="font-semibold">Danger zone</h3>
              </div>
              <p className="text-sm text-base-content/70">Actions below are destructive. Confirm before proceeding.</p>
              <div className="flex flex-col gap-2">
                <button
                  className={`btn btn-warning btn-sm ${saving === 'disable' ? 'loading' : ''}`}
                  onClick={disableUser}
                >
                  Disable user
                </button>
                <button
                  className={`btn btn-error btn-outline btn-sm ${saving === 'delete' ? 'loading' : ''}`}
                  onClick={deleteUser}
                >
                  Delete user
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserDetail;
