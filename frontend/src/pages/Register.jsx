import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TicketIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';

const Register = () => {
  const navigate = useNavigate();
  const { register, isAuthenticated } = useAuth();
  const [inviteToken, setInviteToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [autoDownload, setAutoDownload] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setInviteToken(token);
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const result = await register(inviteToken, email, password, 'en', autoDownload);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <TicketIcon className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">UK Ticket Center</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Automated ticket management for university students
          </p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              Enter your invite token and credentials to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="invite">
                  Invite token
                </label>
                <input
                  id="invite"
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Paste your invite token"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="email">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="md:col-span-2 rounded-lg border border-border bg-accent/50 px-4 py-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-input text-primary"
                    checked={autoDownload}
                    onChange={(e) => setAutoDownload(e.target.checked)}
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Enable automatic downloads</p>
                    <p className="text-sm text-muted-foreground">
                      Your tickets will be fetched automatically
                    </p>
                  </div>
                </label>
              </div>

              {error && (
                <div className="md:col-span-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="md:col-span-2">
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Creating account…' : 'Create account'}
                </Button>
              </div>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link className="font-semibold text-primary hover:underline" to="/login">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
