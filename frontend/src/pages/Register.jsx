import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { TicketIcon } from '@heroicons/react/24/outline';

const Register = () => {
  const { t, i18n } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    inviteToken: '',
    email: '',
    password: '',
    locale: i18n.language || 'en'
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

    const result = await register(
      formData.inviteToken,
      formData.email,
      formData.password,
      formData.locale
    );

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
        {/* Right side - Register Form */}
        <div className="card flex-shrink-0 w-full max-w-md shadow-2xl bg-base-100">
          <div className="card-body">
            <div className="text-center mb-4">
              <div className="flex justify-center mb-4">
                <div className="avatar placeholder">
                  <div className="bg-secondary text-secondary-content rounded-full w-16">
                    <TicketIcon className="h-8 w-8" />
                  </div>
                </div>
              </div>
              <h2 className="text-2xl font-bold">{t('app.title')}</h2>
              <p className="text-base-content/70 mt-2">{t('auth.registerTitle')}</p>
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
                  <span className="label-text">{t('auth.inviteToken')}</span>
                </label>
                <input
                  id="inviteToken"
                  name="inviteToken"
                  type="text"
                  required
                  value={formData.inviteToken}
                  onChange={handleChange}
                  placeholder="XXXX-XXXX-XXXX"
                  className="input input-bordered"
                />
              </div>

              <div className="form-control mt-4">
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
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="input input-bordered"
                />
                <label className="label">
                  <span className="label-text-alt">{t('auth.passwordRequirements')}</span>
                </label>
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text">{t('auth.locale')}</span>
                </label>
                <select
                  id="locale"
                  name="locale"
                  value={formData.locale}
                  onChange={handleChange}
                  className="select select-bordered"
                >
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                  <option value="ru">Русский</option>
                </select>
              </div>

              <div className="form-control mt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading && <span className="loading loading-spinner"></span>}
                  {loading ? t('common.loading') : t('auth.registerButton')}
                </button>
              </div>

              <div className="divider">OR</div>

              <p className="text-center text-sm">
                {t('auth.hasAccount')}{' '}
                <Link to="/login" className="link link-primary font-semibold">
                  {t('auth.login')}
                </Link>
              </p>
            </form>
          </div>
        </div>

        {/* Left side - Hero Content */}
        <div className="text-center lg:text-left max-w-md">
          <h1 className="text-5xl font-bold">Join Our Community</h1>
          <p className="py-6 text-lg">
            Get started with automated ticket management. Register with your invite code.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="badge badge-secondary badge-lg">✓</div>
              <div className="text-left">
                <h3 className="font-semibold">Invite-Only Access</h3>
                <p className="text-sm text-base-content/70">Exclusive community for verified users</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="badge badge-secondary badge-lg">✓</div>
              <div className="text-left">
                <h3 className="font-semibold">Multi-language</h3>
                <p className="text-sm text-base-content/70">Available in English, German & Russian</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="badge badge-secondary badge-lg">✓</div>
              <div className="text-left">
                <h3 className="font-semibold">Get Started Fast</h3>
                <p className="text-sm text-base-content/70">Easy setup in just a few minutes</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
