#!/usr/bin/env node
const readline = require('readline');
const { downloadTickets } = require('./downloader');

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '');
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        result[key] = next;
        i += 1;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const userId = args.userId || args.u;
  const username = args.username || args.name;
  const password = args.password || args.pw;
  const filename = args.filename || `${userId || 'ticket'}.html`;
  const outputDir = args.outputDir;

  const finalUserId = userId || (await ask('userId: '));
  const finalUsername = username || (await ask('Username (UK number): '));
  const finalPassword = password || (await ask('Password: '));

  try {
    const result = await downloadTickets({
      userId: finalUserId,
      username: finalUsername,
      password: finalPassword,
      filename,
      outputDir
    });

    if (result.status === 'success') {
      console.log(`Ticket saved to ${result.filePath}`);
    } else {
      console.error('Download failed:', result.error || 'Unknown error');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Download failed:', error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
