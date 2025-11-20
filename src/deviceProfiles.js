const devicePresets = [
  {
    id: 'desktop-chrome',
    label: 'Desktop Chrome',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    proxy: ''
  },
  {
    id: 'desktop-firefox',
    label: 'Desktop Firefox',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
    viewport: { width: 1366, height: 768 },
    proxy: ''
  },
  {
    id: 'iphone-15-pro',
    label: 'iPhone 15 Pro',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 430, height: 932 },
    proxy: ''
  },
  {
    id: 'pixel-8',
    label: 'Pixel 8',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    proxy: ''
  }
];

module.exports = { devicePresets };
