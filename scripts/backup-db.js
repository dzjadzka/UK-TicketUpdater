// filepath: /Users/zozo/WebstormProjects/UK-TicketUpdater/scripts/backup-db.js
// Database backup utility
// Usage: npm run db:backup
// Or with custom paths: DB_PATH=./custom.db BACKUP_DIR=./backups node scripts/backup-db.js

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function backupDatabase() {
  const dbPath = process.env.DB_PATH || './data/app.db';
  const backupDir = process.env.BACKUP_DIR || './data/backups';

  const resolvedDbPath = path.resolve(dbPath);

  if (!fs.existsSync(resolvedDbPath)) {
    console.error(`Database not found: ${resolvedDbPath}`);
    process.exit(1);
  }

  ensureDirExists(backupDir);

  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const backupFileName = `app-${timestamp}.db`;
  const backupPath = path.resolve(backupDir, backupFileName);

  console.log('Backing up database...');
  console.log(`  Source: ${resolvedDbPath}`);
  console.log(`  Destination: ${backupPath}`);

  try {
    const db = new Database(resolvedDbPath);
    const backup = db.backup(backupPath);

    // Wait for backup to complete
    let remaining = -1;
    do {
      remaining = backup.step(100);
    } while (remaining > 0);

    backup.close();
    db.close();

    const stats = fs.statSync(backupPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log('✓ Backup completed successfully');
    console.log(`  Size: ${sizeMB} MB`);
    console.log(`  Location: ${backupPath}`);

    // Clean up old backups (keep last 7)
    cleanupOldBackups(backupDir, 7);
  } catch (error) {
    console.error('Backup failed:', error.message);
    process.exit(1);
  }
}

function cleanupOldBackups(backupDir, keepCount) {
  try {
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith('.db'))
      .map((f) => ({
        name: f,
        path: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount);
      console.log(`Cleaning up ${toDelete.length} old backup(s)...`);
      toDelete.forEach((file) => {
        fs.unlinkSync(file.path);
        console.log(`  Deleted: ${file.name}`);
      });
    }
  } catch (error) {
    console.warn('Could not clean up old backups:', error.message);
  }
}

if (require.main === module) {
  backupDatabase();
}

module.exports = { backupDatabase };
