const path = require('path');
const { createDatabase } = require('./db');
const { parseArgs } = require('./cli');

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = path.resolve(args.db || './data/app.db');

  const db = createDatabase(dbPath);
  // Schema initialization happens in createDatabase()
  console.log(`Database initialized at ${dbPath}`);
  console.log('Next steps:');
  console.log(
    '- Create initial admin: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD="StrongPass123!" npm run init:admin'
  );
  console.log('- Start API: npm run api');
  console.log(
    '- Register users with the invite token via POST /auth/register and set credentials via PUT /me/credentials'
  );
  db.close();
}

if (require.main === module) {
  main();
}

module.exports = { parseArgs };
