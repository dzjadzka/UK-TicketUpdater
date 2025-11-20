const DEVICE_PROFILES = {
  desktop_chrome: {
    name: 'desktop_chrome',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'en-US,en'
  },
  mobile_android: {
    name: 'mobile_android',
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 6 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 915, isMobile: true },
    locale: 'en-US,en'
  },
  iphone_13: {
    name: 'iphone_13',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844, isMobile: true },
    locale: 'en-US,en'
  },
  tablet_ipad: {
    name: 'tablet_ipad',
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 1024, height: 1366, isMobile: true },
    locale: 'en-US,en'
  }
};

function getDeviceProfile(name) {
  if (!name) {
    return DEVICE_PROFILES.desktop_chrome;
  }
  return DEVICE_PROFILES[name] || DEVICE_PROFILES.desktop_chrome;
}

module.exports = { DEVICE_PROFILES, getDeviceProfile };
