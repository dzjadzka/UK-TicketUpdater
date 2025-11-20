import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';

const AuthGuard = ({ children }) => {
  const { t } = useTranslation('common');
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div role="alert" aria-live="assertive" className="guard-message">
        {t('authOnly')}
      </div>
    );
  }

  return children;
};

export default AuthGuard;
