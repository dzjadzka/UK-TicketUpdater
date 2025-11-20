const fs = require('fs');
const path = require('path');
const { createConnection, DB_PATH } = require('./connection');

const schemaPath = path.join(__dirname, 'schema.sql');

function runMigration() {
  const db = createConnection();
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  return new Promise((resolve, reject) => {
    db.exec(schema, (err) => {
      if (err) {
        console.error('Migration failed:', err.message);
        db.close();
        reject(err);
        return;
      }

      console.log(`Schema applied to ${DB_PATH}`);
      db.close();
      resolve();
    });
  });
}

if (require.main === module) {
  runMigration().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runMigration };
