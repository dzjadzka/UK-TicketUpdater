import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { TicketIcon } from '@heroicons/react/24/outline';

const Login = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(formData.email, formData.password);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen hero bg-base-200">
      <div className="hero-content flex-col lg:flex-row-reverse max-w-6xl w-full">
        {/* Right side - Login Form */}
        <div className="card flex-shrink-0 w-full max-w-md shadow-2xl bg-base-100">
          <div className="card-body">
            <div className="text-center mb-4">
              <div className="flex justify-center mb-4">
                <div className="avatar placeholder">
                  <div className="bg-primary text-primary-content rounded-full w-16">
                    <TicketIcon className="h-8 w-8" />
                  </div>
                </div>
              </div>
              <h2 className="text-2xl font-bold">{t('app.title')}</h2>
              <p className="text-base-content/70 mt-2">{t('auth.loginTitle')}</p>
            </div>

            <form onSubmit={handleSubmit}>
              {error && (
                <div className="alert alert-error mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="form-control">
                <label className="label">
                  <span className="label-text">{t('auth.email')}</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="input input-bordered"
                />
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text">{t('auth.password')}</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="input input-bordered"
                />
              </div>

              <div className="form-control mt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading && <span className="loading loading-spinner"></span>}
                  {loading ? t('common.loading') : t('auth.loginButton')}
                </button>
              </div>

              <div className="divider">OR</div>

              <p className="text-center text-sm">
                {t('auth.noAccount')}{' '}
                <Link to="/register" className="link link-primary font-semibold">
                  {t('auth.register')}
                </Link>
              </p>
            </form>
          </div>
        </div>

        {/* Left side - Hero Content */}
        <div className="text-center lg:text-left max-w-md">
          <h1 className="text-5xl font-bold">{t('app.title')}</h1>
          <p className="py-6 text-lg">
            {t('app.description')}
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="badge badge-primary badge-lg">✓</div>
              <div className="text-left">
                <h3 className="font-semibold">Multi-user Support</h3>
                <p className="text-sm text-base-content/70">Manage multiple accounts with ease</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="badge badge-primary badge-lg">✓</div>
              <div className="text-left">
                <h3 className="font-semibold">Device Emulation</h3>
                <p className="text-sm text-base-content/70">Custom profiles for different devices</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="badge badge-primary badge-lg">✓</div>
              <div className="text-left">
                <h3 className="font-semibold">Secure & Private</h3>
                <p className="text-sm text-base-content/70">Encrypted credentials and JWT auth</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
