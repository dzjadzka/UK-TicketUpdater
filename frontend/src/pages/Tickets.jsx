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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      filtered = filtered.filter((t) => t.status === filter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (t) =>
          t.version?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.error_message?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredTickets(filtered);
  };

  const statusCounts = {
    all: tickets.length,
    success: tickets.filter((t) => t.status === 'success').length,
    error: tickets.filter((t) => t.status === 'error').length,
    pending: tickets.filter((t) => t.status === 'pending' || !t.status).length
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary/80 mb-1.5">Tickets</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">Download History</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Complete history of all your ticket downloads
        </p>
      </div>

      {/* Filters */}
      <Card className="animate-in fade-in slide-in-from-top-3 duration-500">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Status Filter */}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter tickets by status">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
                className="transition-all hover:shadow-md"
                aria-label={`Show all tickets (${statusCounts.all} total)`}
                aria-pressed={filter === 'all'}
              >
                All ({statusCounts.all})
              </Button>
              <Button
                variant={filter === 'success' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('success')}
                className="transition-all hover:shadow-md"
                aria-label={`Show successful tickets (${statusCounts.success} total)`}
                aria-pressed={filter === 'success'}
              >
                Success ({statusCounts.success})
              </Button>
              <Button
                variant={filter === 'error' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('error')}
                className="transition-all hover:shadow-md"
                aria-label={`Show failed tickets (${statusCounts.error} total)`}
                aria-pressed={filter === 'error'}
              >
                Errors ({statusCounts.error})
              </Button>
              <Button
                variant={filter === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('pending')}
                className="transition-all hover:shadow-md"
                aria-label={`Show pending tickets (${statusCounts.pending} total)`}
                aria-pressed={filter === 'pending'}
              >
                Pending ({statusCounts.pending})
              </Button>
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <label htmlFor="ticket-search" className="sr-only">
                Search tickets
              </label>
              <MagnifyingGlassIcon
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="ticket-search"
                type="text"
                placeholder="Search tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search tickets by version or error message"
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow hover:shadow-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      {loading ? (
        <Card className="animate-in fade-in duration-300">
          <CardContent className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-4 text-sm text-muted-foreground">Loading tickets...</p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/50 animate-in fade-in duration-300">
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{error}</p>
            <Button
              onClick={fetchTickets}
              variant="outline"
              size="sm"
              className="mt-4 hover:shadow-md transition-shadow"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : filteredTickets.length === 0 ? (
        <Card className="animate-in fade-in duration-300">
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
              <FunnelIcon className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-semibold">No tickets found</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {searchTerm || filter !== 'all'
                ? 'Try adjusting your filters or search term'
                : 'When your account downloads a ticket, it will appear here'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">
              {filteredTickets.length} {filteredTickets.length === 1 ? 'Ticket' : 'Tickets'}
            </CardTitle>
            <CardDescription>{filter !== 'all' ? `Showing ${filter} tickets` : 'Showing all tickets'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTickets.map((ticket, index) => (
                <div
                  key={ticket.id}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className="group flex flex-col gap-3 rounded-lg border bg-card p-4 hover:border-primary/50 hover:shadow-lg transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap mb-2">
                      <h4 className="font-semibold text-foreground truncate">{ticket.version || 'N/A'}</h4>
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
                    <p className="text-xs text-muted-foreground">
                      {ticket.downloaded_at ? new Date(ticket.downloaded_at).toLocaleString() : 'Download pending'}
                    </p>
                    {ticket.error_message && (
                      <div className="mt-2 rounded-md bg-destructive/10 px-2.5 py-1.5">
                        <p className="text-xs text-destructive line-clamp-2">{ticket.error_message}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-auto">
                    {ticket.download_url ? (
                      <a
                        href={ticket.download_url}
                        download
                        className="w-full"
                        aria-label={`Download ticket ${ticket.version || ticket.id}`}
                      >
                        <Button
                          size="sm"
                          className="w-full gap-2 shadow-sm hover:shadow-md transition-all group-hover:scale-[1.02]"
                          aria-hidden="true"
                          tabIndex={-1}
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
                          Download
                        </Button>
                      </a>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        className="w-full"
                        aria-label="Ticket download not available"
                      >
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
