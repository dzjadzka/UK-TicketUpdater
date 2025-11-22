import { describe, expect, it, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import ProtectedRoute from '../../components/ProtectedRoute';
import AdminLayout from '../AdminLayout';

const authState = { isAuthenticated: false, isAdmin: false, loading: false };

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState
}));

describe('admin access control', () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.isAdmin = false;
    authState.loading = false;
  });

  it('redirects unauthenticated users to login', () => {
    render(
      <MemoryRouter initialEntries={['/admin/overview']}>
        <Routes>
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="overview" element={<div>Overview page</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects authenticated non-admins to home', () => {
    authState.isAuthenticated = true;
    render(
      <MemoryRouter initialEntries={['/admin/overview']}>
        <Routes>
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="overview" element={<div>Overview page</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('allows admins to view admin routes', () => {
    authState.isAuthenticated = true;
    authState.isAdmin = true;
    render(
      <MemoryRouter initialEntries={['/admin/overview']}>
        <Routes>
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="overview" element={<div>Overview page</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Overview page')).toBeInTheDocument();
  });
});
