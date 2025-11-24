import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TicketIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { validateEmail, validatePassword } from '../utils/validation';

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const validateForm = () => {
    const errors = {};

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
    setTouched({ email: true, password: true });

    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <TicketIcon className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">UK Ticket Center</h1>
          <p className="mt-2 text-sm text-muted-foreground">Automated ticket management for university students</p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to access your ticket downloads and manage your credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="email">
                  Email address{' '}
                  <span className="text-destructive" aria-label="required">
                    *
                  </span>
                </label>
                <input
                  id="email"
                  type="email"
                  className={`flex h-10 w-full rounded-md border ${touched.email && validationErrors.email ? 'border-destructive' : 'border-input'} bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
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
                  Password{' '}
                  <span className="text-destructive" aria-label="required">
                    *
                  </span>
                </label>
                <input
                  id="password"
                  type="password"
                  className={`flex h-10 w-full rounded-md border ${touched.password && validationErrors.password ? 'border-destructive' : 'border-input'} bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
                  placeholder="Enter your password"
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
              </div>

              {error && (
                <div
                  className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  role="alert"
                  aria-live="polite"
                >
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-6 space-y-4 text-center text-sm">
              <div>
                <Link className="text-primary hover:underline text-xs" to="/forgot-password">
                  Forgot your password?
                </Link>
              </div>
              <div>
                <span className="text-muted-foreground">New here? </span>
                <Link className="font-semibold text-primary hover:underline" to="/register">
                  Create an account
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          By signing in, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
};

export default Login;
