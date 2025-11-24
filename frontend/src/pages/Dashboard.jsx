import { useEffect, useState } from 'react';
import { ArrowPathIcon, ArrowDownTrayIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
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
      const [ticketsRes, credentialsRes] = await Promise.all([
        userAPI.getTickets(),
        userAPI.getCredentials()
      ]);
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
  const successCount = tickets.filter(t => t.status === 'success').length;
  const errorCount = tickets.filter(t => t.status === 'error').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Dashboard</p>
          <h1 className="text-4xl font-bold text-foreground">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's an overview of your ticket activity
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="gap-2"
        >
          <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {!loading && !error && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credentials Status</CardTitle>
              {credentials ? (
                <CheckCircleIcon className="h-4 w-4 text-primary" />
              ) : (
                <XCircleIcon className="h-4 w-4 text-destructive" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {credentials ? 'Configured' : 'Not Set'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {credentials ? (
                  <>Auto-download: {credentials.auto_download_enabled ? 'Enabled' : 'Disabled'}</>
                ) : (
                  <Link to="/settings" className="text-primary hover:underline">Configure now</Link>
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
              <ArrowDownTrayIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tickets.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {successCount} successful, {errorCount} failed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Latest Ticket</CardTitle>
              <ClockIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {latestTicket ? latestTicket.version || 'N/A' : 'None'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {latestTicket?.downloaded_at 
                  ? new Date(latestTicket.downloaded_at).toLocaleDateString()
                  : 'No downloads yet'
                }
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <Card>
          <CardContent className="flex min-h-[300px] items-center justify-center">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-4 text-sm text-muted-foreground">Loading your data...</p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <XCircleIcon className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <h3 className="font-semibold text-destructive">Error loading data</h3>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
                <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-3">
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Tickets</CardTitle>
            <CardDescription>
              Your latest ticket downloads. {tickets.length > 5 && (
                <Link to="/tickets" className="text-primary hover:underline ml-1">
                  View all →
                </Link>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tickets.length === 0 ? (
              <div className="text-center py-12">
                <TicketIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No tickets yet</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                  When your account downloads a ticket, it will appear here. Make sure your credentials are configured.
                </p>
                {!credentials && (
                  <Button asChild className="mt-4">
                    <Link to="/settings">Configure Credentials</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.slice(0, 5).map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <p className="font-medium truncate">
                          {ticket.version || 'N/A'}
                        </p>
                        <Badge variant={
                          ticket.status === 'success' ? 'success' : 
                          ticket.status === 'error' ? 'destructive' : 
                          'warning'
                        }>
                          {ticket.status || 'pending'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {ticket.downloaded_at 
                          ? new Date(ticket.downloaded_at).toLocaleString()
                          : 'Pending'
                        }
                      </p>
                      {ticket.error_message && (
                        <p className="text-xs text-destructive mt-1">{ticket.error_message}</p>
                      )}
                    </div>
                    {ticket.download_url && (
                      <Button size="sm" asChild>
                        <a href={ticket.download_url} className="gap-2">
                          <ArrowDownTrayIcon className="h-4 w-4" />
                          Download
                        </a>
                      </Button>
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
