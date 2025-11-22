const { Command, InvalidArgumentError } = require('commander');

function parseInteger(value, previous) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new InvalidArgumentError('Not a number.');
  }
  return parsed; // always return parsed number
}

function buildProgram() {
  const program = new Command();
  program
    .name('ticket-updater')
    .description('NVV ticket downloader CLI')
    .option('--users <path>', 'Path to users JSON config', './config/users.json')
    // Deprecated alias kept for backward compatibility with older scripts (no default to avoid confusion)
    .option('--source <path>', 'DEPRECATED: use --users instead (alias)')
    .option('--output <path>', 'Output directory for downloaded tickets', './downloads')
    .option('--device <name>', 'Device profile to emulate', 'desktop_chrome')
    .option('--history <path>', 'History JSON path (ignored when using --db)', './data/history.json')
    .option('--db <path>', 'SQLite database path for persistence')
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
  // Normalize deprecated --source to --users if provided and users not explicitly set
  if (opts.source) {
    if (!opts.users) {
      opts.users = opts.source;
      console.warn('[DEPRECATED] --source flag detected. Please migrate to --users.');
    }
    delete opts.source; // drop deprecated alias from final options object
  }
  return opts;
}

module.exports = { buildProgram, parseArgs };
