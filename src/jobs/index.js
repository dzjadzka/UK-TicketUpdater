const { JobQueue } = require('./queue');
const { JobScheduler } = require('./scheduler');
const { createJobHandlers } = require('./handlers');

function createJobSystem({ db, logger = console, defaults = {} }) {
  const queue = new JobQueue({ concurrency: Number(process.env.JOB_CONCURRENCY) || 2, logger });
  const handlers = createJobHandlers({ db, queue, logger, defaults });

  queue.registerHandler('checkBaseTicket', handlers.checkBaseTicket);
  queue.registerHandler('downloadTicketForUser', handlers.downloadTicketForUser);
  queue.registerHandler('downloadTicketsForAllUsers', handlers.downloadTicketsForAllUsers);

  const intervalEnv = Number(process.env.BASE_TICKET_CHECK_INTERVAL_HOURS);
  const intervalMs = Number.isFinite(intervalEnv) ? intervalEnv * 60 * 60 * 1000 : undefined;
  const scheduler = new JobScheduler(queue, { intervalMs, logger });

  return { queue, scheduler };
}

module.exports = { createJobSystem };
