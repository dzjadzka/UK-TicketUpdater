const fs = require('fs');
const path = require('path');
const { createDatabase } = require('./db');
const { loadUsers } = require('./index');
const { parseArgs } = require('./cli');

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = path.resolve(args.source || './config/users.json');
  const dbPath = path.resolve(args.db || './data/app.db');

  const db = createDatabase(dbPath);
  if (fs.existsSync(sourcePath)) {
    const users = loadUsers(sourcePath);
    db.upsertUsers(users);
    console.log(`Imported ${users.length} users into ${dbPath}`);
  } else {
    console.warn(`Source user file not found at ${sourcePath}. Database initialized without users.`);
  }
  db.close();
}

if (require.main === module) {
  main();
}

module.exports = { parseArgs };
