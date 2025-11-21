const { createJobHandlers } = require('../../src/jobs/handlers');

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

      expect(setBaseTicketState).toHaveBeenCalledWith(
        expect.objectContaining({ baseTicketHash: 'def' })
      );
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
});
