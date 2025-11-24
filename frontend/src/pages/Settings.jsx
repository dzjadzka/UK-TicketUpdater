import { useEffect, useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { userAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { validateUKNumber, validatePassword } from '../utils/validation';

const Settings = () => {
  const [ukNumber, setUkNumber] = useState('');
  const [ukPassword, setUkPassword] = useState('');
  const [autoDownload, setAutoDownload] = useState(false);
  const [maskedNumber, setMaskedNumber] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [touched, setTouched] = useState({ ukNumber: false, ukPassword: false });
  const navigate = useNavigate();
  const { logout, refreshUser } = useAuth();

  const fetchCredentials = async () => {
    setError('');
    try {
      const response = await userAPI.getCredentials();
      const credential = response.data.credential;
      const user = response.data.user;
      setAutoDownload(!!credential?.auto_download_enabled || !!user?.auto_download_enabled);
      setMaskedNumber(credential?.uk_number_masked || 'Not set');
      setHasPassword(!!credential?.has_password);
      setLastUpdated(credential?.updated_at || '');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load your credentials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const validateForm = () => {
    const errors = {};

    if (ukNumber) {
      const ukNumberValidation = validateUKNumber(ukNumber);
      if (!ukNumberValidation.valid) {
        errors.ukNumber = ukNumberValidation.error;
      }
    }

    if (ukPassword) {
      const passwordValidation = validatePassword(ukPassword);
      if (!passwordValidation.valid) {
        errors.ukPassword = passwordValidation.error;
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (field) => {
    setTouched({ ...touched, [field]: true });
    validateForm();
  };

  const handleUkNumberChange = (e) => {
    setUkNumber(e.target.value);
    if (touched.ukNumber) {
      validateForm();
    }
  };

  const handleUkPasswordChange = (e) => {
    setUkPassword(e.target.value);
    if (touched.ukPassword) {
      validateForm();
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    // Mark all fields as touched
    setTouched({ ukNumber: true, ukPassword: true });

    if (!ukNumber && !ukPassword) {
      setError('Provide a UK number or password to update your credentials.');
      return;
    }

    // Validate form
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const payload = {};
      if (ukNumber) payload.ukNumber = ukNumber;
      if (ukPassword) payload.ukPassword = ukPassword;
      payload.autoDownloadEnabled = autoDownload;

      const response = await userAPI.updateCredentials(payload);
      const credential = response.data.credential;
      setMaskedNumber(credential.uk_number_masked);
      setHasPassword(credential.has_password);
      setLastUpdated(credential.updated_at || '');
      setUkNumber('');
      setUkPassword('');
      setTouched({ ukNumber: false, ukPassword: false });
      await refreshUser();
      setSuccess('Credentials saved successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to save credentials.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setError('');
    setSuccess('');
    setDeleting(true);
    try {
      await userAPI.deleteAccount();
      logout();
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete your account.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Settings</p>
        <h1 className="text-3xl font-bold text-slate-900">Credentials & Automation</h1>
        <p className="text-sm text-slate-600">
          Update your university login, control automatic downloads, and manage your account.
        </p>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <header className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">UK credentials</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Your UK number is masked. Update the password whenever it changes.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {autoDownload ? 'Auto-download on' : 'Auto-download off'}
              </span>
            </header>

            <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">UK number</dt>
                <dd className="mt-2 text-sm font-semibold text-slate-900">{maskedNumber}</dd>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">Password</dt>
                <dd className="mt-2 text-sm text-slate-900">{hasPassword ? 'Stored securely' : 'Not set'}</dd>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">Auto-download</dt>
                <dd className="mt-2 text-sm text-slate-900">{autoDownload ? 'Enabled' : 'Disabled'}</dd>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">Last updated</dt>
                <dd className="mt-2 text-sm text-slate-900">
                  {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Never'}
                </dd>
              </div>
            </dl>

            <form className="mt-6 space-y-4" onSubmit={handleSave} noValidate>
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="uk-number">
                  UK number
                </label>
                <input
                  id="uk-number"
                  type="text"
                  className={`mt-2 w-full rounded-lg border ${touched.ukNumber && validationErrors.ukNumber ? 'border-rose-500' : 'border-slate-200'} px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                  placeholder="Enter or update your UK number"
                  value={ukNumber}
                  onChange={handleUkNumberChange}
                  onBlur={() => handleBlur('ukNumber')}
                  aria-invalid={touched.ukNumber && validationErrors.ukNumber ? 'true' : 'false'}
                  aria-describedby={
                    touched.ukNumber && validationErrors.ukNumber ? 'uk-number-error' : 'uk-number-help'
                  }
                />
                {touched.ukNumber && validationErrors.ukNumber ? (
                  <p id="uk-number-error" className="mt-1 text-xs text-rose-600" role="alert">
                    {validationErrors.ukNumber}
                  </p>
                ) : (
                  <p id="uk-number-help" className="mt-1 text-xs text-slate-500">
                    We'll mask and store your number securely.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="uk-password">
                  UK password
                </label>
                <input
                  id="uk-password"
                  type="password"
                  className={`mt-2 w-full rounded-lg border ${touched.ukPassword && validationErrors.ukPassword ? 'border-rose-500' : 'border-slate-200'} px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                  placeholder="Enter a new password"
                  value={ukPassword}
                  onChange={handleUkPasswordChange}
                  onBlur={() => handleBlur('ukPassword')}
                  aria-invalid={touched.ukPassword && validationErrors.ukPassword ? 'true' : 'false'}
                  aria-describedby={
                    touched.ukPassword && validationErrors.ukPassword ? 'uk-password-error' : 'uk-password-help'
                  }
                />
                {touched.ukPassword && validationErrors.ukPassword ? (
                  <p id="uk-password-error" className="mt-1 text-xs text-rose-600" role="alert">
                    {validationErrors.ukPassword}
                  </p>
                ) : (
                  <p id="uk-password-help" className="mt-1 text-xs text-slate-500">
                    We never display your password. Save to replace it.
                  </p>
                )}
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={autoDownload}
                  onChange={(e) => setAutoDownload(e.target.checked)}
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Enable automatic downloads</p>
                  <p className="text-sm text-slate-600">Allow the system to refresh your ticket automatically.</p>
                </div>
              </label>

              {error && (
                <div
                  className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                  role="alert"
                >
                  {error}
                </div>
              )}
              {success && (
                <div
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                  role="alert"
                >
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </section>

          <section className="flex flex-col gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <header className="flex items-center gap-3 text-rose-700">
              <ExclamationTriangleIcon className="h-6 w-6" />
              <div>
                <p className="text-lg font-semibold">Delete account</p>
                <p className="text-sm text-rose-600">This action removes your profile and stored credentials.</p>
              </div>
            </header>

            <div className="rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm text-slate-700">
              <p>
                Type <span className="font-semibold">DELETE</span> to confirm. You will be signed out immediately.
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                placeholder="DELETE"
              />
            </div>

            <button
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || deleting}
              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
            >
              {deleting ? 'Deleting…' : 'Delete my account'}
            </button>
          </section>
        </div>
      )}
    </div>
  );
};

export default Settings;
