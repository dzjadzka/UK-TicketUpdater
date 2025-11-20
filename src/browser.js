export function resolveExecutablePath(puppeteer) {
  const envPath =
    process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROMIUM_PATH || process.env.BROWSER_PATH;
  if (envPath) {
    return envPath;
  }

  if (typeof puppeteer.executablePath === 'function') {
    return puppeteer.executablePath();
  }

  return undefined;
}

export async function launchBrowser(
  puppeteer,
  { headless = true, args = [], product = 'firefox' } = {}
) {
  const executablePath = resolveExecutablePath(puppeteer);
  const browser = await puppeteer.launch({ headless, args, product, executablePath });
  return { browser, executablePath };
}
