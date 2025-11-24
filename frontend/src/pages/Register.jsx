import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TicketIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { validateEmail, validatePassword, validateRequired } from '../utils/validation';

// Get initial values from URL params (extracted to avoid duplication)
const getInitialUrlToken = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') || '';
};

const Register = () => {
  const navigate = useNavigate();
  const { register, isAuthenticated } = useAuth();
  
  const [inviteToken, setInviteToken] = useState(getInitialUrlToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [autoDownload, setAutoDownload] = useState(true);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(() => ({
    inviteToken: !!getInitialUrlToken(),
    email: false,
    password: false
  }));

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const validateForm = () => {
    const errors = {};
    
    const tokenValidation = validateRequired(inviteToken, 'Invite token');
    if (!tokenValidation.valid) {
      errors.inviteToken = tokenValidation.error;
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      errors.email = emailValidation.error;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      errors.password = passwordValidation.error;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (field) => {
    setTouched({ ...touched, [field]: true });
    validateForm();
  };

  const handleInviteTokenChange = (e) => {
    setInviteToken(e.target.value);
    if (touched.inviteToken) {
      validateForm();
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (touched.email) {
      validateForm();
    }
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (touched.password) {
      validateForm();
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    
    // Mark all fields as touched
    setTouched({ inviteToken: true, email: true, password: true });

    // Validate form
    if (!validateForm()) {
      return;
    }

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
            <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit} noValidate>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="invite">
                  Invite token <span className="text-destructive" aria-label="required">*</span>
                </label>
                <input
                  id="invite"
                  type="text"
                  className={`flex h-10 w-full rounded-md border ${touched.inviteToken && validationErrors.inviteToken ? 'border-destructive' : 'border-input'} bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                  placeholder="Paste your invite token"
                  value={inviteToken}
                  onChange={handleInviteTokenChange}
                  onBlur={() => handleBlur('inviteToken')}
                  required
                  aria-invalid={touched.inviteToken && validationErrors.inviteToken ? 'true' : 'false'}
                  aria-describedby={touched.inviteToken && validationErrors.inviteToken ? 'invite-error' : undefined}
                />
                {touched.inviteToken && validationErrors.inviteToken && (
                  <p id="invite-error" className="text-xs text-destructive" role="alert">
                    {validationErrors.inviteToken}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="email">
                  Email address <span className="text-destructive" aria-label="required">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  className={`flex h-10 w-full rounded-md border ${touched.email && validationErrors.email ? 'border-destructive' : 'border-input'} bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={() => handleBlur('email')}
                  required
                  aria-invalid={touched.email && validationErrors.email ? 'true' : 'false'}
                  aria-describedby={touched.email && validationErrors.email ? 'email-error' : undefined}
                />
                {touched.email && validationErrors.email && (
                  <p id="email-error" className="text-xs text-destructive" role="alert">
                    {validationErrors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="password">
                  Password <span className="text-destructive" aria-label="required">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  className={`flex h-10 w-full rounded-md border ${touched.password && validationErrors.password ? 'border-destructive' : 'border-input'} bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={() => handleBlur('password')}
                  required
                  aria-invalid={touched.password && validationErrors.password ? 'true' : 'false'}
                  aria-describedby={touched.password && validationErrors.password ? 'password-error' : undefined}
                />
                {touched.password && validationErrors.password && (
                  <p id="password-error" className="text-xs text-destructive" role="alert">
                    {validationErrors.password}
                  </p>
                )}
                {!validationErrors.password && password && touched.password && (
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 8 characters with a letter and number
                  </p>
                )}
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
                <div className="md:col-span-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert" aria-live="polite">
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
