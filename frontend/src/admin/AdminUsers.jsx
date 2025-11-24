import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../services/api';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  UserIcon
} from '@heroicons/react/24/outline';

const statusBadge = (user) => {
  if (user.deleted_at) return <span className="badge badge-sm badge-outline">Deleted</span>;
  if (!user.is_active) return <span className="badge badge-sm badge-warning">Disabled</span>;
  return <span className="badge badge-sm badge-success">Active</span>;
};

const loginStatusBadge = (status) => {
  if (!status) return <span className="badge badge-ghost badge-sm">Unknown</span>;
  if (status === 'success') return <span className="badge badge-success badge-sm">OK</span>;
  if (status === 'error') return <span className="badge badge-error badge-sm">Error</span>;
  return <span className="badge badge-ghost badge-sm">{status}</span>;
};

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminAPI.getUsers({ q: search || undefined, status: statusFilter, errors: true });
      let fetched = response.data.users || [];
      if (onlyErrors) {
        fetched = fetched.filter((u) => u.has_error || u.credential_status?.last_login_status === 'error');
      }
      setUsers(fetched);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadUsers();
    }, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, onlyErrors]);

  const stats = useMemo(() => {
    const total = users.length;
    const errorCount = users.filter((u) => u.has_error).length;
    return { total, errorCount };
  }, [users]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-base-content">Users</h2>
          <p className="text-sm text-base-content/70">Search users, review credential health, and drill into issues.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="badge badge-outline">{stats.total} loaded</span>
          <span className="badge badge-warning badge-outline">{stats.errorCount} with errors</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-3 py-2">
          <MagnifyingGlassIcon className="h-5 w-5 text-base-content/70" />
          <input
            type="search"
            className="input input-ghost w-full"
            placeholder="Search by email or ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="select select-bordered select-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="deleted">Deleted</option>
            <option value="all">All</option>
          </select>
          <label className="label cursor-pointer gap-2">
            <span className="text-sm">Only errors</span>
            <input
              type="checkbox"
              className="toggle toggle-warning toggle-sm"
              checked={onlyErrors}
              onChange={(e) => setOnlyErrors(e.target.checked)}
            />
          </label>
        </div>
      </div>

      {error && <div className="alert alert-error text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="loading loading-spinner loading-lg" aria-label="Loading users" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-base-content/80">
          <NoSymbolIcon className="h-10 w-10" />
          <p>No users match your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Last result</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.user.id} className="hover">
                  <td>
                    <Link to={`/admin/users/${row.user.id}`} className="font-medium link link-hover">
                      {row.user.email}
                    </Link>
                    <div className="text-xs text-base-content/70 flex items-center gap-1">
                      <UserIcon className="h-4 w-4" />
                      {row.user.id}
                    </div>
                  </td>
                  <td className="capitalize">{row.user.role}</td>
                  <td>{statusBadge(row.user)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      {loginStatusBadge(row.credential_status?.last_login_status)}
                      <span className="text-xs text-base-content/70">
                        {row.credential_status?.last_login_at || 'Never'}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-xs text-sm">
                    {row.credential_status?.last_login_error ? (
                      <div className="flex items-center gap-1 text-error">
                        <ExclamationCircleIcon className="h-4 w-4" />
                        <span className="truncate">{row.credential_status.last_login_error}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-success">
                        <CheckCircleIcon className="h-4 w-4" />
                        <span>No recent errors</span>
                      </div>
                    )}
                  </td>
                  <td>
                    {row.has_error && <span className="badge badge-error badge-outline badge-sm">Attention</span>}
                    {row.user.auto_download_enabled && (
                      <span className="badge badge-info badge-outline badge-sm ml-1">Auto</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
