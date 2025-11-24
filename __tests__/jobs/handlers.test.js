const { createJobHandlers, buildDeviceProfile } = require('../../src/jobs/handlers');

describe('job handlers', () => {
  describe('checkBaseTicket', () => {
    test('does not enqueue downloads when hash unchanged', async () => {
      const setBaseTicketState = jest.fn();
      const db = {
        getBaseTicketState: jest.fn().mockReturnValue({ base_ticket_hash: 'abc', effective_from: '2024-01-01' }),
        setBaseTicketState
      };
      const queue = { enqueue: jest.fn() };
      const handlers = createJobHandlers({
        db,
        queue,
        fetchBaseTicketFn: async () => ({ hash: 'abc' })
      });

      await handlers.checkBaseTicket();

      expect(setBaseTicketState).toHaveBeenCalledWith(
        expect.objectContaining({ baseTicketHash: 'abc', effectiveFrom: '2024-01-01' })
      );
      expect(queue.enqueue).not.toHaveBeenCalledWith('downloadTicketsForAllUsers');
    });

    test('enqueues downloads when hash changes', async () => {
      const setBaseTicketState = jest.fn();
      const db = {
        getBaseTicketState: jest.fn().mockReturnValue({ base_ticket_hash: 'abc', effective_from: '2024-01-01' }),
        setBaseTicketState
      };
      const queue = { enqueue: jest.fn() };
      const handlers = createJobHandlers({
        db,
        queue,
        fetchBaseTicketFn: async () => ({ hash: 'def' })
      });

      await handlers.checkBaseTicket();

      expect(setBaseTicketState).toHaveBeenCalledWith(expect.objectContaining({ baseTicketHash: 'def' }));
      expect(queue.enqueue).toHaveBeenCalledWith('downloadTicketsForAllUsers');
    });
  });

  describe('downloadTicketsForAllUsers', () => {
    test('enqueues download jobs only for users with auto download enabled', async () => {
      const db = {
        listActiveUsers: jest.fn().mockReturnValue([
          { id: 'u1', auto_download_enabled: 1 },
          { id: 'u2', auto_download_enabled: 0 },
          { id: 'u3', auto_download_enabled: true }
        ])
      };
      const queue = { enqueue: jest.fn() };
      const handlers = createJobHandlers({ db, queue });

      await handlers.downloadTicketsForAllUsers();

      expect(queue.enqueue).toHaveBeenCalledTimes(2);
      expect(queue.enqueue).toHaveBeenCalledWith('downloadTicketForUser', { userId: 'u1' });
      expect(queue.enqueue).toHaveBeenCalledWith('downloadTicketForUser', { userId: 'u3' });
    });
  });

  describe('buildDeviceProfile', () => {
    test('returns DB-backed profile when UUID provided and includes proxy/geolocation', () => {
      const db = {
        getDeviceProfileById: jest.fn().mockReturnValue({
          name: 'custom',
          user_agent: 'UA',
          viewport_width: 100,
          viewport_height: 200,
          locale: 'de-DE',
          timezone: 'Europe/Berlin',
          proxy_url: 'http://proxy.local:8080',
          geolocation_latitude: 10,
          geolocation_longitude: 20
        })
      };
      const profile = buildDeviceProfile(
        { deviceProfile: '123e4567-e89b-12d3-a456-426614174000', id: 'u1' },
        db,
        'desktop_chrome'
      );

      expect(profile.proxy_url).toBe('http://proxy.local:8080');
      expect(profile.geolocation_latitude).toBe(10);
      expect(profile.geolocation_longitude).toBe(20);
    });
  });
});
