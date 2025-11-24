import { useEffect, useState } from 'react';
import { ArrowDownTrayIcon, FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { userAPI } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

const Tickets = () => {
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, success, error, pending
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    filterTickets();
  }, [tickets, filter, searchTerm]);

  const fetchTickets = async () => {
    setError('');
    try {
      const response = await userAPI.getTickets();
      setTickets(response.data.tickets || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load tickets.');
    } finally {
      setLoading(false);
    }
  };

  const filterTickets = () => {
    let filtered = tickets;

    // Filter by status
    if (filter !== 'all') {
      filtered = filtered.filter(t => t.status === filter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.version?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.error_message?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredTickets(filtered);
  };

  const statusCounts = {
    all: tickets.length,
    success: tickets.filter(t => t.status === 'success').length,
    error: tickets.filter(t => t.status === 'error').length,
    pending: tickets.filter(t => t.status === 'pending' || !t.status).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Tickets</p>
        <h1 className="text-4xl font-bold text-foreground">Download History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete history of all your ticket downloads
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Status Filter */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All ({statusCounts.all})
              </Button>
              <Button
                variant={filter === 'success' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('success')}
              >
                Success ({statusCounts.success})
              </Button>
              <Button
                variant={filter === 'error' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('error')}
              >
                Errors ({statusCounts.error})
              </Button>
              <Button
                variant={filter === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('pending')}
              >
                Pending ({statusCounts.pending})
              </Button>
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      {loading ? (
        <Card>
          <CardContent className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-4 text-sm text-muted-foreground">Loading tickets...</p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchTickets} variant="outline" size="sm" className="mt-4">
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FunnelIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No tickets found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {searchTerm || filter !== 'all'
                ? 'Try adjusting your filters or search term'
                : 'When your account downloads a ticket, it will appear here'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {filteredTickets.length} {filteredTickets.length === 1 ? 'Ticket' : 'Tickets'}
            </CardTitle>
            <CardDescription>
              {filter !== 'all' 
                ? `Showing ${filter} tickets` 
                : 'Showing all tickets'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="font-semibold">{ticket.version || 'N/A'}</h4>
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
                        : 'Download pending'
                      }
                    </p>
                    {ticket.error_message && (
                      <div className="mt-2 rounded-md bg-destructive/10 px-3 py-2">
                        <p className="text-xs text-destructive">{ticket.error_message}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {ticket.download_url ? (
                      <Button size="sm" asChild>
                        <a href={ticket.download_url} className="gap-2" download>
                          <ArrowDownTrayIcon className="h-4 w-4" />
                          Download
                        </a>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        Not Available
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Tickets;
