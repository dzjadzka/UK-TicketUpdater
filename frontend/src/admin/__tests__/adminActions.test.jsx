import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminUserDetail from '../AdminUserDetail';
import AdminOverview from '../AdminOverview';

const authState = { isAuthenticated: true, isAdmin: true, loading: false };

const mockGetUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockGetUserTickets = vi.fn();
const mockGetRecentErrors = vi.fn();
const mockGetOverview = vi.fn();
const mockTriggerBaseTicketCheck = vi.fn();
const mockTriggerDownloadAll = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState
}));

vi.mock('../../services/api', () => ({
  adminAPI: {
    getUser: (...args) => mockGetUser(...args),
    updateUser: (...args) => mockUpdateUser(...args),
    deleteUser: vi.fn(),
    getUserTickets: (...args) => mockGetUserTickets(...args),
    getRecentErrors: (...args) => mockGetRecentErrors(...args),
    getOverview: (...args) => mockGetOverview(...args),
    triggerBaseTicketCheck: (...args) => mockTriggerBaseTicketCheck(...args),
    triggerDownloadAll: (...args) => mockTriggerDownloadAll(...args),
    getUsers: vi.fn().mockResolvedValue({ data: { users: [] } })
  }
}));

const renderWithRouter = (ui, path = '/admin/users/u1') => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/users/:id" element={ui} />
        <Route path="/admin/overview" element={<AdminOverview />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('admin actions', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'u1', email: 'user@example.com', role: 'user', is_active: true, auto_download_enabled: false },
        credential: null,
        last_ticket: null,
        ticket_stats: { success: 0, error: 0 }
      }
    });
    mockGetUserTickets.mockResolvedValue({ data: { tickets: [] } });
    mockGetRecentErrors.mockResolvedValue({ data: { errors: [] } });
    mockUpdateUser.mockResolvedValue({ data: {} });
    mockGetOverview.mockResolvedValue({
      data: {
        overview: {
          counts: { total: 1, active: 1, disabled: 0, deleted: 0 },
          login_errors: 0,
          base_ticket_state: null
        }
      }
    });
    mockTriggerBaseTicketCheck.mockResolvedValue({ data: { status: 'queued' } });
    mockTriggerDownloadAll.mockResolvedValue({ data: { status: 'queued' } });
  });

  it('updates user credentials through admin API', async () => {
    renderWithRouter(<AdminUserDetail />);

    const numberInput = await screen.findByLabelText('UK number');
    await userEvent.clear(numberInput);
    await userEvent.type(numberInput, '123456');

    const passwordInput = screen.getByLabelText('UK password');
    await userEvent.type(passwordInput, 'secret');

    await userEvent.click(screen.getByRole('button', { name: /save credentials/i }));

    expect(mockUpdateUser).toHaveBeenCalledWith('u1', { ukNumber: '123456', ukPassword: 'secret' });
  });

  it('triggers base ticket check and download jobs', async () => {
    renderWithRouter(<AdminOverview />, '/admin/overview');

    const baseButton = await screen.findByRole('button', { name: /check base ticket now/i });
    await userEvent.click(baseButton);
    expect(mockTriggerBaseTicketCheck).toHaveBeenCalled();

    const downloadButton = screen.getByRole('button', { name: /download tickets for all users/i });
    await userEvent.click(downloadButton);
    expect(mockTriggerDownloadAll).toHaveBeenCalled();
  });
});
