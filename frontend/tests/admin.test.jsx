import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';

const apiMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getCredentials: vi.fn(),
  updateCredentials: vi.fn(),
  getTickets: vi.fn(),
  getUsers: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  getUserTickets: vi.fn(),
  getRecentErrors: vi.fn()
}));

vi.mock('../src/services/api', () => {
  const apiStub = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    }
  };

  return {
    authAPI: {
      login: vi.fn(),
      register: vi.fn()
    },
    userAPI: {
      getProfile: apiMocks.getProfile,
      getCredentials: apiMocks.getCredentials,
      updateCredentials: apiMocks.updateCredentials,
      getTickets: apiMocks.getTickets,
      deleteAccount: vi.fn()
    },
    adminAPI: {
      getUsers: apiMocks.getUsers,
      getUser: apiMocks.getUser,
      updateUser: apiMocks.updateUser,
      getUserTickets: apiMocks.getUserTickets,
      getRecentErrors: apiMocks.getRecentErrors,
      deleteUser: vi.fn()
    },
    default: apiStub,
    api: apiStub
  };
});

const setAdminSession = () => {
  localStorage.setItem('token', 'token-123');
  localStorage.setItem('user', JSON.stringify({ id: 'admin-1', email: 'admin@example.com', role: 'admin' }));
};

describe('Admin UI flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the admin user list and surfaces login errors', async () => {
    setAdminSession();
    apiMocks.getProfile.mockResolvedValue({
      data: { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } }
    });
    apiMocks.getUsers.mockResolvedValue({
      data: {
        users: [
          {
            user: {
              id: 'user-1',
              email: 'user@example.com',
              role: 'user',
              is_active: true,
              auto_download_enabled: true
            },
            credential_status: {
              last_login_status: 'error',
              last_login_error: 'Invalid credentials',
              last_login_at: '2024-01-01T00:00:00Z'
            },
            has_error: true
          }
        ]
      }
    });

    window.history.pushState({}, '', '/admin/users');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('user@example.com')).toBeInTheDocument();
    });

    expect(screen.getByText(/Invalid credentials/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/only errors/i));
    expect(apiMocks.getUsers).toHaveBeenCalled();
  });

  it('updates user automation flags from the admin detail page', async () => {
    setAdminSession();
    apiMocks.getProfile.mockResolvedValue({
      data: { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } }
    });
    apiMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'user@example.com',
          role: 'user',
          auto_download_enabled: false,
          is_active: true
        },
        credential: { uk_number_masked: '******1234', has_password: true },
        last_ticket: null,
        ticket_stats: { success: 0, error: 0 }
      }
    });
    apiMocks.getUserTickets.mockResolvedValue({ data: { tickets: [] } });
    apiMocks.getRecentErrors.mockResolvedValue({ data: { errors: [] } });
    apiMocks.updateUser.mockResolvedValue({
      data: {
        user: { id: 'user-1', auto_download_enabled: true, is_active: true },
        credential: null
      }
    });

    window.history.pushState({}, '', '/admin/users/user-1');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/user@example.com/)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText(/auto-download/i));
    await userEvent.click(screen.getByRole('button', { name: /save flags/i }));

    await waitFor(() => {
      expect(apiMocks.updateUser).toHaveBeenCalledWith('user-1', {
        autoDownloadEnabled: true,
        isActive: true
      });
    });
  });
});
