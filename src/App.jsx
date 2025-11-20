import React from 'react';
import { useTranslation } from 'react-i18next';
import AuthGuard from './components/AuthGuard';
import { AuthProvider, useAuth } from './components/AuthContext';
import LanguageSwitcher from './components/LanguageSwitcher';
import ValidationForm from './components/ValidationForm';
import HistoryTable from './components/HistoryTable';

const AuthControls = () => {
  const { isAuthenticated, login, logout } = useAuth();
  const { t } = useTranslation('common');

  return (
    <div className="auth-controls">
      {isAuthenticated ? (
        <button type="button" onClick={logout} aria-label={t('logout')}>
          {t('logout')}
        </button>
      ) : (
        <button type="button" onClick={login} aria-label="Login">
          Login
        </button>
      )}
    </div>
  );
};

const AppShell = () => {
  const { t } = useTranslation('common');

  return (
    <div className="layout">
      <header>
        <h1>{t('appTitle')}</h1>
        <LanguageSwitcher />
        <AuthControls />
      </header>
      <main>
        <ValidationForm />
        <AuthGuard>
          <HistoryTable />
        </AuthGuard>
      </main>
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <AppShell />
  </AuthProvider>
);

export default App;
