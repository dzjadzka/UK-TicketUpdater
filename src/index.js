#!/usr/bin/env node
const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const {
  addFile,
  listFiles,
  getFileById,
  deleteExpired,
  deleteFileById,
  DB_PATH,
} = require('./db');

const program = new Command();
const DEFAULT_TTL_HOURS = Number(process.env.DEFAULT_TTL_HOURS || 720);

program
  .name('ticket-files')
  .description('CLI for managing ticket download files and retention policies')
  .version('1.0.0');

program
  .command('register')
  .description('Register a downloaded file in the database')
  .requiredOption('-u, --user <id>', 'user id')
  .requiredOption('-p, --path <path>', 'absolute path to the downloaded file')
  .option('-s, --status <status>', 'status label', 'active')
  .action(async (options) => {
    const result = await addFile({ userId: options.user, filePath: options.path, status: options.status });
    console.log(`Registered file #${result.id} for user ${options.user}`);
    console.log(`Database: ${DB_PATH}`);
  });

program
  .command('list')
  .description('List tracked files')
  .option('-u, --user <id>', 'user id filter')
  .action(async (options) => {
    const files = await listFiles({ userId: options.user });
    if (!files.length) {
      console.log('No files tracked.');
      return;
    }
    files.forEach((file) => {
      console.log(`#${file.id} | user=${file.userId} | status=${file.status} | createdAt=${file.createdAt} | path=${file.path}`);
    });
  });

program
  .command('download')
  .description('Selectively copy tracked files to a target directory')
  .requiredOption('-i, --ids <ids>', 'comma separated file ids to copy')
  .requiredOption('-o, --output <directory>', 'target directory')
  .action(async (options) => {
    const ids = options.ids.split(',').map((id) => Number(id.trim())).filter(Boolean);
    const outputDir = options.output;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const id of ids) {
      const row = await getFileById(id);
      if (!row) {
        console.warn(`Skipping #${id}: not found in database`);
        continue;
      }
      if (!fs.existsSync(row.path)) {
        console.warn(`Skipping #${id}: file missing at ${row.path}`);
        continue;
      }
      const destPath = path.join(outputDir, path.basename(row.path));
      fs.copyFileSync(row.path, destPath);
      console.log(`Copied #${id} -> ${destPath}`);
    }
  });

program
  .command('cleanup')
  .description('Delete files older than the TTL and drop their records')
  .option('-t, --ttl <hours>', 'time-to-live in hours', DEFAULT_TTL_HOURS.toString())
  .action(async (options) => {
    const ttlHours = Number(options.ttl || DEFAULT_TTL_HOURS);
    if (!Number.isFinite(ttlHours) || ttlHours <= 0) {
      console.error('TTL must be a positive number of hours');
      process.exitCode = 1;
      return;
    }
    const deletedIds = await deleteExpired(ttlHours);
    if (!deletedIds.length) {
      console.log(`No files older than ${ttlHours}h found.`);
      return;
    }
    console.log(`Deleted ${deletedIds.length} files older than ${ttlHours}h (ids: ${deletedIds.join(', ')}).`);
  });

program
  .command('remove')
  .description('Remove a file entry (and delete the file if it exists)')
  .argument('<id>', 'file id')
  .action(async (id) => {
    const removed = await deleteFileById(Number(id));
    if (!removed) {
      console.log(`File #${id} not found.`);
      return;
    }
    console.log(`Removed file #${id}.`);
  });

program.parseAsync().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
