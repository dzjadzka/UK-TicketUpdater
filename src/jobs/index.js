const { JobQueue } = require('./queue');
const { PersistentJobQueue } = require('./persistentQueue');
const { JobScheduler } = require('./scheduler');
const { createJobHandlers } = require('./handlers');
const { createRateLimiterFromEnv } = require('../rateLimiter');

function selectBackend(defaultBackend) {
  const fromEnv = (process.env.JOB_QUEUE_BACKEND || '').toLowerCase();
  if (fromEnv === 'memory' || fromEnv === 'persistent') {
    return fromEnv;
  }
  return defaultBackend;
}

function createJobSystem({ db, logger = console, defaults = {}, overrides = {} }) {
  const recommendedBackend = db ? 'persistent' : 'memory';
  const backend = overrides.backend || selectBackend(recommendedBackend);
  const concurrency = Number(process.env.JOB_CONCURRENCY) || 2;
  const rateLimiter = overrides.rateLimiter || createRateLimiterFromEnv(logger);
  const queueFactory =
    overrides.queueFactory ||
    ((opts) =>
      opts.backend === 'persistent' && opts.db
        ? new PersistentJobQueue({ db: opts.db, concurrency: opts.concurrency, logger: opts.logger })
        : new JobQueue({ concurrency: opts.concurrency, logger: opts.logger }));

  const queue = queueFactory({ backend, db, concurrency, logger });
  const handlerFactory = overrides.handlerFactory || createJobHandlers;
  const handlers = handlerFactory({ db, queue, logger, defaults, rateLimiter });

  queue.registerHandler('checkBaseTicket', handlers.checkBaseTicket);
  queue.registerHandler('downloadTicketForUser', handlers.downloadTicketForUser);
  queue.registerHandler('downloadTicketsForAllUsers', handlers.downloadTicketsForAllUsers);

  const intervalEnv = Number(process.env.BASE_TICKET_CHECK_INTERVAL_HOURS);
  const intervalMs = Number.isFinite(intervalEnv) ? intervalEnv * 60 * 60 * 1000 : undefined;
  const scheduler = new JobScheduler(queue, { intervalMs, logger });

  return { queue, scheduler, rateLimiter, backend };
}

module.exports = { createJobSystem };
