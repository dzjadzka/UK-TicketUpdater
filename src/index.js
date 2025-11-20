require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { runMigration } = require('./db/migrate');
const { getUsers, createUser, getUserByUsername } = require('./db/users');

const AUTOLOGIN_SECRET = process.env.AUTOLOGIN_SECRET;

async function seedUsersFromJson() {
  const jsonPath = path.join(__dirname, '..', 'config', 'users.json');
  if (!fs.existsSync(jsonPath)) {
    return;
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const users = JSON.parse(raw);

  for (const user of users) {
    const existing = await getUserByUsername(user.username, AUTOLOGIN_SECRET);
    if (existing) {
      continue;
    }

    await createUser({
      username: user.username,
      password: user.password,
      role: user.role || 'user',
      devicePreferences: user.devicePreferences || {},
      autoLoginData: user.autoLoginData,
      autoLoginSecret: AUTOLOGIN_SECRET,
    });
  }
}

async function loadUsersFromDatabase() {
  await runMigration();
  await seedUsersFromJson();
  const users = await getUsers(AUTOLOGIN_SECRET);
  return users;
}

async function main() {
  const users = await loadUsersFromDatabase();
  console.log('Benutzer aus der Datenbank geladen:', users.map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    devicePreferences: u.devicePreferences,
    hasAutoLogin: Boolean(u.autoLogin),
  })));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  loadUsersFromDatabase,
};
