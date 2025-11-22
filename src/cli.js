function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const [key, value] = argv[i].split('=');
    if (!key.startsWith('--')) {
      continue;
    }

    const normalizedKey = key.replace(/^--/, '');
    const nextValue = argv[i + 1];
    if (value !== undefined) {
      args[normalizedKey] = value;
    } else if (nextValue && !nextValue.startsWith('--')) {
      args[normalizedKey] = nextValue;
      i += 1;
    } else {
      args[normalizedKey] = true;
    }
  }
  return args;
}

module.exports = { parseArgs };
