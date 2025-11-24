import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeviceProfiles from '../src/pages/DeviceProfiles';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  remove: vi.fn()
}));

vi.mock('../src/services/api', () => ({
  deviceAPI: {
    list: mocks.list,
    create: mocks.create,
    remove: mocks.remove
  }
}));

describe('DeviceProfiles page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({
      data: { profiles: [{ id: 'p1', name: 'desktop', locale: 'de-DE', timezone: 'Europe/Berlin' }] }
    });
    mocks.create.mockResolvedValue({ data: { id: 'new' } });
    mocks.remove.mockResolvedValue({});
  });

  it('renders existing profiles', async () => {
    render(<DeviceProfiles />);

    await waitFor(() => {
      expect(screen.getByText('desktop')).toBeInTheDocument();
    });
  });

  it('creates a profile from custom form input', async () => {
    render(<DeviceProfiles />);
    await waitFor(() => expect(mocks.list).toHaveBeenCalled());

    await userEvent.type(screen.getByLabelText(/profile name/i), 'custom-device');
    await userEvent.type(screen.getByLabelText(/user agent/i), 'Mozilla/5.0');
    await userEvent.clear(screen.getByLabelText(/viewport width/i));
    await userEvent.type(screen.getByLabelText(/viewport width/i), '1024');
    await userEvent.clear(screen.getByLabelText(/viewport height/i));
    await userEvent.type(screen.getByLabelText(/viewport height/i), '768');
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => {
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'custom-device',
          viewportWidth: 1024,
          viewportHeight: 768
        })
      );
    });
  });
});
