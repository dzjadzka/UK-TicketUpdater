const { run } = require('./src/ticketService');

run().catch((error) => {
  console.error('Download failed', error);
  process.exitCode = 1;
});
