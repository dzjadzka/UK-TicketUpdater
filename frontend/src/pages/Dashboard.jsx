import { useEffect, useState } from 'react';
import { ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { userAPI } from '../services/api';

const statusStyles = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  error: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
};

const Dashboard = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchTickets = async () => {
    setError('');
    try {
      const response = await userAPI.getTickets();
      setTickets(response.data.tickets || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load your tickets right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Dashboard</p>
          <h1 className="text-3xl font-bold text-slate-900">Your ticket history</h1>
          <p className="text-sm text-slate-600">
            Review past downloads, check their status, and re-download tickets when available.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading your tickets…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          {error}
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-lg font-semibold text-slate-900">No tickets yet</p>
          <p className="mt-2 text-sm text-slate-600">
            When your account downloads a ticket, it will show up here with a download link.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Ticket</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Downloaded</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                      {ticket.version || 'N/A'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {ticket.downloaded_at ? new Date(ticket.downloaded_at).toLocaleString() : 'Pending'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          statusStyles[ticket.status] || statusStyles.pending
                        }`}
                      >
                        {ticket.status || 'pending'}
                      </span>
                      {ticket.error_message && (
                        <p className="mt-1 text-xs text-rose-600">{ticket.error_message}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {ticket.download_url ? (
                        <a
                          href={ticket.download_url}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                          Download
                        </a>
                      ) : (
                        <span className="text-slate-500">Not available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
