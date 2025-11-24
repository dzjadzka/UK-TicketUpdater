import { useEffect, useState } from 'react';
import {
  ArrowPathIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TicketIcon
} from '@heroicons/react/24/outline';
import { userAPI } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [tickets, setTickets] = useState([]);
  const [credentials, setCredentials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setError('');
    try {
      const [ticketsRes, credentialsRes] = await Promise.all([userAPI.getTickets(), userAPI.getCredentials()]);
      setTickets(ticketsRes.data.tickets || []);
      setCredentials(credentialsRes.data.credential);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load your data right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const latestTicket = tickets.length > 0 ? tickets[0] : null;
  const successCount = tickets.filter((t) => t.status === 'success').length;
  const errorCount = tickets.filter((t) => t.status === 'error').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary/80 mb-1.5">Dashboard</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Here's an overview of your ticket activity
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          size="sm"
          className="gap-2 hover:shadow-md transition-all duration-200"
          aria-label={refreshing ? 'Refreshing dashboard data' : 'Refresh dashboard data'}
        >
          <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {!loading && !error && (
        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Credentials Status</CardTitle>
              {credentials ? (
                <CheckCircleIcon className="h-5 w-5 text-primary" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-destructive" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{credentials ? 'Configured' : 'Not Set'}</div>
              <p className="text-xs text-muted-foreground mt-2">
                {credentials ? (
                  <>Auto-download: {credentials.auto_download_enabled ? 'Enabled' : 'Disabled'}</>
                ) : (
                  <Link to="/settings" className="text-primary hover:underline font-medium">
                    Configure now →
                  </Link>
                )}
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-75">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Downloads</CardTitle>
              <ArrowDownTrayIcon className="h-5 w-5 text-muted-foreground/60" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{tickets.length}</div>
              <p className="text-xs text-muted-foreground mt-2">
                <span className="text-green-600 font-medium">{successCount} successful</span> ·{' '}
                <span className="text-red-600 font-medium">{errorCount} failed</span>
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150 sm:col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Latest Ticket</CardTitle>
              <ClockIcon className="h-5 w-5 text-muted-foreground/60" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">
                {latestTicket ? latestTicket.version || 'N/A' : 'None'}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {latestTicket?.downloaded_at
                  ? new Date(latestTicket.downloaded_at).toLocaleDateString()
                  : 'No downloads yet'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <Card className="animate-in fade-in duration-300">
          <CardContent className="flex min-h-[300px] items-center justify-center">
            <div className="text-center">
              <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-4 text-sm text-muted-foreground">Loading your data...</p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/50 animate-in fade-in duration-300">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <XCircleIcon className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <h3 className="font-semibold text-destructive">Error loading data</h3>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  size="sm"
                  className="mt-3 hover:shadow-md transition-shadow"
                >
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Your ticket history</CardTitle>
                <CardDescription className="mt-1.5">
                  Your latest ticket downloads
                  {tickets.length > 5 && (
                    <Link
                      to="/tickets"
                      className="text-primary hover:underline ml-2 font-medium inline-flex items-center"
                    >
                      View all →
                    </Link>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {tickets.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                  <ArrowDownTrayIcon className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No tickets yet</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  When your account downloads a ticket, it will appear here. Make sure your credentials are configured.
                </p>
                {!credentials && (
                  <Link to="/settings">
                    <Button className="mt-6 shadow-md hover:shadow-lg transition-all">Configure Credentials</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.slice(0, 5).map((ticket, index) => (
                  <div
                    key={ticket.id}
                    style={{ animationDelay: `${index * 50}ms` }}
                    className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all duration-200 animate-in fade-in slide-in-from-left-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <p className="font-semibold text-foreground truncate">{ticket.version || 'N/A'}</p>
                        <Badge
                          variant={
                            ticket.status === 'success'
                              ? 'success'
                              : ticket.status === 'error'
                                ? 'destructive'
                                : 'warning'
                          }
                        >
                          {ticket.status || 'pending'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {ticket.downloaded_at ? new Date(ticket.downloaded_at).toLocaleString() : 'Pending'}
                      </p>
                      {ticket.error_message && (
                        <p className="text-xs text-destructive mt-1.5 line-clamp-1">{ticket.error_message}</p>
                      )}
                    </div>
                    {ticket.download_url && (
                      <a href={ticket.download_url} aria-label={`Download ticket ${ticket.version || ticket.id}`}>
                        <Button
                          size="sm"
                          className="shrink-0 gap-2 shadow-sm hover:shadow-md transition-all group-hover:scale-105"
                          aria-hidden="true"
                          tabIndex={-1}
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
                          <span className="hidden sm:inline">Download</span>
                        </Button>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
