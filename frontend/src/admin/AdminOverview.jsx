import { useEffect, useState } from 'react';
import { adminAPI } from '../services/api';
import { ArrowPathIcon, CloudArrowDownIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const accentClasses = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error'
};

const StatCard = ({ label, value, accent }) => (
  <div className="rounded-lg border border-base-200 bg-base-100 p-4 shadow-sm">
    <p className="text-sm text-base-content/70">{label}</p>
    <p className={`text-3xl font-bold ${accentClasses[accent] || 'text-base-content'}`}>{value}</p>
  </div>
);

const AdminOverview = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const loadOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminAPI.getOverview();
      setOverview(response.data.overview);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const triggerAction = async (action) => {
    setActionLoading(action);
    setError('');
    setNotice('');
    try {
      if (action === 'base') {
        await adminAPI.triggerBaseTicketCheck();
        setNotice('Base ticket check enqueued.');
      } else {
        await adminAPI.triggerDownloadAll();
        setNotice('Download job for all users enqueued.');
      }
      await loadOverview();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to trigger job');
    } finally {
      setActionLoading('');
    }
  };

  const renderBaseTicketState = () => {
    if (!overview?.base_ticket_state) return <p className="text-sm">No base ticket state recorded yet.</p>;
    const state = overview.base_ticket_state;
    return (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div>
          <p className="text-base-content/70">Last checked</p>
          <p className="font-semibold">{state.last_checked_at || 'N/A'}</p>
        </div>
        <div>
          <p className="text-base-content/70">Effective from</p>
          <p className="font-semibold">{state.effective_from || 'Unknown'}</p>
        </div>
        <div>
          <p className="text-base-content/70">Current hash/version</p>
          <p className="font-semibold break-all">{state.base_ticket_hash || 'Unknown'}</p>
        </div>
        <div>
          <p className="text-base-content/70">Updated</p>
          <p className="font-semibold">{state.updated_at || 'N/A'}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-base-content">System overview</h2>
          <p className="text-sm text-base-content/70">
            Track the health of the downloader and quickly kick off maintenance jobs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={`btn btn-outline btn-primary btn-sm ${actionLoading === 'base' ? 'loading' : ''}`}
            onClick={() => triggerAction('base')}
            disabled={!!actionLoading}
          >
            <ArrowPathIcon className="h-5 w-5" />
            Check base ticket now
          </button>
          <button
            className={`btn btn-primary btn-sm ${actionLoading === 'download' ? 'loading' : ''}`}
            onClick={() => triggerAction('download')}
            disabled={!!actionLoading}
          >
            <CloudArrowDownIcon className="h-5 w-5" />
            Download tickets for all users
          </button>
        </div>
      </div>

      {notice && <div className="alert alert-success text-sm">{notice}</div>}
      {error && <div className="alert alert-error text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="loading loading-spinner loading-lg" aria-label="Loading overview" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total users" value={overview?.counts?.total ?? 0} accent="primary" />
            <StatCard label="Active" value={overview?.counts?.active ?? 0} accent="success" />
            <StatCard label="Disabled" value={overview?.counts?.disabled ?? 0} accent="warning" />
            <StatCard label="Users with errors" value={overview?.login_errors ?? 0} accent="error" />
          </div>

          <div className="rounded-lg border border-base-200 bg-base-100 p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-base-content">
              <InformationCircleIcon className="h-5 w-5" />
              <h3 className="font-semibold">Base ticket status</h3>
            </div>
            {renderBaseTicketState()}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOverview;
