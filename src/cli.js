const { Command, InvalidArgumentError } = require('commander');

function parseInteger(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new InvalidArgumentError('Not a number.');
  }
  return parsed;
}

function buildProgram() {
  const program = new Command();
  program
    .name('ticket-updater')
    .description('NVV ticket downloader CLI')
    .option('--users <path>', 'Path to users configuration file')
    .option('--source <path>', 'DEPRECATED: Use --users instead. Path to users configuration file')
    .option('--output <path>', 'Output directory for downloaded tickets', './downloads')
    .option('--device <name>', 'Device profile to emulate', 'desktop_chrome')
    .option('--db <path>', 'SQLite database path for persistence', './data/app.db')
    .option('--concurrency <number>', 'Job concurrency override', parseInteger)
    .option('--queue-backend <memory|persistent>', 'Queue backend', 'memory')
    .helpOption('-h, --help', 'Display help for ticket-updater CLI');

  return program;
}

function parseArgs(argv) {
  const program = buildProgram();
  program.exitOverride();
  const parsed = program.parse(argv, { from: 'user' });
  const opts = parsed.opts();

  // Handle deprecated --source option
  if (opts.source && !opts.users) {
    console.warn('DEPRECATED: --source is deprecated. Use --users instead.');
    opts.users = opts.source;
  }

  return opts;
}

module.exports = { buildProgram, parseArgs };
