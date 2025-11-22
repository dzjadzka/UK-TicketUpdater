import { useEffect, useMemo, useState } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { deviceAPI } from '../services/api';

const presets = [
  {
    label: 'Desktop Chrome (DE)',
    value: 'desktop_chrome',
    data: {
      name: 'desktop_chrome',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      viewportWidth: 1366,
      viewportHeight: 768,
      locale: 'de-DE,de',
      timezone: 'Europe/Berlin'
    }
  },
  {
    label: 'Mac Safari (UK)',
    value: 'mac_safari',
    data: {
      name: 'mac_safari',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
      viewportWidth: 1400,
      viewportHeight: 900,
      locale: 'en-GB,en',
      timezone: 'Europe/London'
    }
  },
  {
    label: 'Android (Pixel)',
    value: 'mobile_android',
    data: {
      name: 'mobile_android',
      userAgent:
        'Mozilla/5.0 (Linux; Android 13; Pixel 6 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
      viewportWidth: 412,
      viewportHeight: 915,
      locale: 'en-US,en',
      timezone: 'Europe/Berlin'
    }
  },
  {
    label: 'iPhone 15 Pro (NYC)',
    value: 'iphone_15_pro',
    data: {
      name: 'iphone_15_pro',
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      viewportWidth: 393,
      viewportHeight: 852,
      locale: 'en-US,en',
      timezone: 'America/New_York'
    }
  }
];

const emptyProfile = {
  name: '',
  userAgent: '',
  viewportWidth: 1280,
  viewportHeight: 720,
  locale: 'de-DE',
  timezone: 'Europe/Berlin',
  proxyUrl: '',
  geolocationLatitude: '',
  geolocationLongitude: ''
};

const DeviceProfiles = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyProfile);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');

  const presetOptions = useMemo(() => presets, []);

  const loadProfiles = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await deviceAPI.list();
      setProfiles(response.data.profiles || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load device profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handlePreset = async (value) => {
    const preset = presetOptions.find((p) => p.value === value);
    if (!preset) return;
    setSelectedPreset(value);
    setForm({ ...form, ...preset.data });
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    const payload = {
      name: form.name.trim(),
      userAgent: form.userAgent.trim(),
      viewportWidth: Number(form.viewportWidth),
      viewportHeight: Number(form.viewportHeight),
      locale: form.locale.trim() || 'de-DE',
      timezone: form.timezone.trim() || 'Europe/Berlin',
      proxyUrl: form.proxyUrl.trim() || null,
      geolocationLatitude:
        form.geolocationLatitude === '' ? null : Number.parseFloat(form.geolocationLatitude),
      geolocationLongitude:
        form.geolocationLongitude === '' ? null : Number.parseFloat(form.geolocationLongitude)
    };

    try {
      await deviceAPI.create(payload);
      setNotice('Profile saved.');
      setForm(emptyProfile);
      setSelectedPreset('');
      await loadProfiles();
    } catch (err) {
      const validation = err.response?.data?.details?.join?.(', ');
      setError(validation || err.response?.data?.error || 'Could not save device profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setError('');
    setNotice('');
    try {
      await deviceAPI.remove(id);
      setNotice('Profile deleted');
      await loadProfiles();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete profile');
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Device profiles</p>
        <h1 className="text-3xl font-bold text-slate-900">Choose how requests look</h1>
        <p className="text-sm text-slate-600">
          Create custom profiles or start from a preset to control user agent, locale, timezone, proxy, and geolocation.
        </p>
      </header>

      {error && <div className="alert alert-error text-sm">{error}</div>}
      {notice && <div className="alert alert-success text-sm">{notice}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Saved profiles</h2>
              <p className="text-sm text-slate-600">Profiles are scoped to your account and used during downloads.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {profiles.length} total
            </span>
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500">Loading…</div>
          ) : profiles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              No profiles yet. Add one from a preset or create a custom profile.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Locale</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Timezone</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Proxy</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {profiles.map((profile) => (
                    <tr key={profile.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{profile.name}</td>
                      <td className="px-4 py-3 text-slate-700">{profile.locale || 'default'}</td>
                      <td className="px-4 py-3 text-slate-700">{profile.timezone || 'default'}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {profile.proxy_url ? <span className="font-mono text-xs">{profile.proxy_url}</span> : 'None'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(profile.id)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <PlusIcon className="h-5 w-5" />
            <h2 className="text-lg font-semibold">New profile</h2>
          </div>
          <p className="text-sm text-slate-600">Use a preset or enter custom values. All fields are required unless noted.</p>

          <label className="block text-sm font-medium text-slate-700">Start from preset</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={selectedPreset}
            onChange={(e) => handlePreset(e.target.value)}
          >
            <option value="">Select a preset (optional)</option>
            {presetOptions.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700">Profile name</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">User agent</label>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.userAgent}
                onChange={(e) => handleChange('userAgent', e.target.value)}
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Viewport width</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.viewportWidth}
                  onChange={(e) => handleChange('viewportWidth', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Viewport height</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.viewportHeight}
                  onChange={(e) => handleChange('viewportHeight', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Locale</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.locale}
                  onChange={(e) => handleChange('locale', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Timezone</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.timezone}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Proxy URL (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.proxyUrl}
                onChange={(e) => handleChange('proxyUrl', e.target.value)}
                placeholder="http://proxy:8080"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Latitude (optional)</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.geolocationLatitude}
                  onChange={(e) => handleChange('geolocationLatitude', e.target.value)}
                  placeholder="51.3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Longitude (optional)</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.geolocationLongitude}
                  onChange={(e) => handleChange('geolocationLongitude', e.target.value)}
                  placeholder="9.5"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default DeviceProfiles;
