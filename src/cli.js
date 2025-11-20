import path from 'path';

const DEFAULT_HISTORY_FILE = path.resolve(process.cwd(), 'download-history.json');
const DEFAULT_OUTPUT_DIR = process.cwd();

export function parseArgs(argv = []) {
  const options = {
    device: 'desktop',
    headless: true,
    historyFile: DEFAULT_HISTORY_FILE,
    outputDir: DEFAULT_OUTPUT_DIR,
    filename: 'Filename.html',
    product: 'firefox'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    switch (value) {
      case '--device':
        options.device = argv[index + 1] || options.device;
        index += 1;
        break;
      case '--history':
        options.historyFile = path.resolve(argv[index + 1] || options.historyFile);
        index += 1;
        break;
      case '--output':
        options.outputDir = path.resolve(argv[index + 1] || options.outputDir);
        index += 1;
        break;
      case '--filename':
        options.filename = argv[index + 1] || options.filename;
        index += 1;
        break;
      case '--product':
        options.product = (argv[index + 1] || options.product).toLowerCase();
        index += 1;
        break;
      case '--headless':
        options.headless = true;
        break;
      case '--no-headless':
        options.headless = false;
        break;
      default:
        break;
    }
  }

  return {
    ...options,
    outputPath: path.join(options.outputDir, options.filename)
  };
}

const devices = {
  desktop: {
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome'
  },
  tablet: {
    viewport: { width: 1024, height: 768 },
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15 Mobile/15A372'
  },
  mobile: {
    viewport: { width: 430, height: 932 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Mobile'
  }
};

export function getDeviceProfile(deviceName = 'desktop') {
  const normalized = deviceName.toLowerCase();
  return devices[normalized] || devices.desktop;
}
