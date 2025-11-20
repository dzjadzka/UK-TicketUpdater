'use client';

import { useEffect, useMemo, useState } from 'react';
import { createInvitation, fetchDownloads, fetchUsers } from '../lib/apiClient';
import { messages } from '../i18n/messages';

const roles = [
  { value: 'member', key: 'member' },
  { value: 'admin', key: 'admin' }
];

export default function HomePage() {
  const [locale, setLocale] = useState('en');
  const t = useMemo(() => messages[locale], [locale]);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [users, setUsers] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [fetchedUsers, fetchedDownloads] = await Promise.all([
          fetchUsers(locale),
          fetchDownloads(locale)
        ]);
        setUsers(fetchedUsers);
        setDownloads(fetchedDownloads);
      } catch (error) {
        setMessage(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [locale]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);

    try {
      await createInvitation({ email, role }, locale);
      setEmail('');
      setRole('member');
      setMessage(t.invitationSuccess);
    } catch (error) {
      setMessage(error.message || t.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <header>
        <div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="flex-row">
          <label htmlFor="language" className="lang-switch">
            {t.language}
          </label>
          <select
            id="language"
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
          >
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
        </div>
      </header>

      <div className="card-grid">
        <section className="card">
          <h2>{t.invitationTitle}</h2>
          <form onSubmit={handleSubmit}>
            <label htmlFor="email">{t.emailLabel}</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="user@example.com"
            />

            <label htmlFor="role">{t.roleLabel}</label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              {roles.map((option) => (
                <option key={option.value} value={option.value}>
                  {t[option.key]}
                </option>
              ))}
            </select>

            <button type="submit" disabled={submitting}>
              {submitting ? t.sending : t.sendInvite}
            </button>
          </form>
          {message ? <p>{message}</p> : null}
        </section>

        <section className="card">
          <h2>{t.usersTitle}</h2>
          {loading ? (
            <p>Loading...</p>
          ) : users.length === 0 ? (
            <p>{t.emptyUsers}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>{t.role}</th>
                  <th>{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{t[user.role]}</td>
                    <td>
                      <span className="badge">{user.status === 'active' ? t.active : t.invited}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2>{t.downloadsTitle}</h2>
          {loading ? (
            <p>Loading...</p>
          ) : downloads.length === 0 ? (
            <p>{t.emptyDownloads}</p>
          ) : (
            <ul className="list">
              {downloads.map((item) => (
                <li key={item.id}>
                  <div className="flex-row">
                    <div>
                      <strong>{item.filename}</strong>
                      <div className="timestamp">
                        {t.timestampPrefix}: {new Date(item.downloadedAt).toLocaleString(locale)}
                      </div>
                    </div>
                    <span className="badge">{item.size}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
