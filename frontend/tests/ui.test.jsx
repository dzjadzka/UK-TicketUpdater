import { describe, expect, vi, beforeEach, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';

const mocks = vi.hoisted(() => ({
  loginMock: vi.fn(),
  registerMock: vi.fn(),
  getProfileMock: vi.fn(),
  getCredentialsMock: vi.fn(),
  updateCredentialsMock: vi.fn(),
  getTicketsMock: vi.fn(),
  deleteAccountMock: vi.fn()
}));

vi.mock('../src/services/api', () => {
  const apiStub = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    }
  };
  return {
    authAPI: { login: mocks.loginMock, register: mocks.registerMock },
    userAPI: {
      getProfile: mocks.getProfileMock,
      getCredentials: mocks.getCredentialsMock,
      updateCredentials: mocks.updateCredentialsMock,
      getTickets: mocks.getTicketsMock,
      deleteAccount: mocks.deleteAccountMock
    },
    default: apiStub,
    api: apiStub
  };
});

const setAuthenticatedUser = () => {
  localStorage.setItem('token', 'token-123');
  localStorage.setItem('user', JSON.stringify({ id: 'user-1', email: 'user@example.com' }));
};

describe('Frontend UI flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('logs in and redirects to the dashboard', async () => {
    mocks.getTicketsMock.mockResolvedValue({ data: { tickets: [] } });
    mocks.getCredentialsMock.mockResolvedValue({ data: { credential: null } });
    mocks.loginMock.mockResolvedValue({ data: { token: 'abc', user: { id: '1', email: 'person@example.com' } } });

    window.history.pushState({}, '', '/login');
    render(<App />);

    await userEvent.type(screen.getByLabelText(/email or username/i), 'person@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/your ticket history/i)).toBeInTheDocument();
    });
  });

  it('renders ticket history rows on the dashboard', async () => {
    setAuthenticatedUser();
    mocks.getProfileMock.mockResolvedValue({ data: { user: { id: '1', email: 'user@example.com' } } });
    mocks.getCredentialsMock.mockResolvedValue({
      data: { credential: { uk_number_masked: '******1234', has_password: true } }
    });
    mocks.getTicketsMock.mockResolvedValue({
      data: {
        tickets: [
          {
            id: 't-1',
            version: 'Winter 24/25',
            downloaded_at: '2024-12-01T10:00:00Z',
            status: 'success',
            download_url: '/tickets/winter.pdf'
          },
          {
            id: 't-2',
            version: 'Spring 25',
            downloaded_at: null,
            status: 'pending',
            download_url: null
          }
        ]
      }
    });

    window.history.pushState({}, '', '/dashboard');
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('Winter 24/25')).toHaveLength(2);
      expect(screen.getByText('Spring 25')).toBeInTheDocument();
    });
  });

  it('updates credentials and auto-download preference', async () => {
    setAuthenticatedUser();
    mocks.getProfileMock.mockResolvedValue({
      data: { user: { id: '1', email: 'user@example.com', auto_download_enabled: true } }
    });
    mocks.getCredentialsMock.mockResolvedValue({
      data: {
        user: { auto_download_enabled: true },
        credential: {
          uk_number_masked: '******1234',
          has_password: true,
          auto_download_enabled: true,
          updated_at: '2024-01-01T00:00:00Z'
        }
      }
    });
    mocks.updateCredentialsMock.mockResolvedValue({
      data: {
        credential: {
          uk_number_masked: '******9876',
          has_password: true,
          updated_at: '2024-02-01T00:00:00Z'
        }
      }
    });

    window.history.pushState({}, '', '/settings');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('******1234')).toBeInTheDocument();
    });

    await userEvent.clear(screen.getByLabelText(/uk number/i));
    await userEvent.type(screen.getByLabelText(/uk number/i), '999999');
    await userEvent.click(screen.getByLabelText(/enable automatic downloads/i));
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mocks.updateCredentialsMock).toHaveBeenCalledWith({ ukNumber: '999999', autoDownloadEnabled: false });
      expect(screen.getByText(/credentials saved/i)).toBeInTheDocument();
    });
  });
});
