import { render, screen } from '@testing-library/react';
import React from 'react';
import AuthGuard from '../src/components/AuthGuard';
import { AuthProvider } from '../src/components/AuthContext';
import '../src/i18n';

const Protected = () => <div>Protected content</div>;

describe('AuthGuard', () => {
  it('blocks access when not authenticated', () => {
    render(
      <AuthProvider>
        <AuthGuard>
          <Protected />
        </AuthGuard>
      </AuthProvider>
    );

    expect(screen.queryByText(/Protected content/)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/content is protected/i);
  });

  it('renders children when authenticated', () => {
    render(
      <AuthProvider initialAuthenticated>
        <AuthGuard>
          <Protected />
        </AuthGuard>
      </AuthProvider>
    );

    expect(screen.getByText(/Protected content/)).toBeInTheDocument();
  });
});
