const puppeteer = require('puppeteer');

const fallbackDesktopProfile = {
  name: 'Desktop Chrome',
  userAgent:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  viewport: {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    isLandscape: true
  }
};

const buildProfiles = () => {
  const knownDevices = puppeteer.KnownDevices || puppeteer.devices || {};
  const profileNames = [
    'Desktop Chrome',
    'Desktop Firefox',
    'Pixel 5',
    'iPhone 12 Pro',
    'iPad Mini',
    'Galaxy S9+',
    'iPhone SE'
  ];

  return profileNames.reduce((acc, name) => {
    const device = knownDevices[name];
    if (device) {
      acc[name] = { ...device, name };
    }
    return acc;
  }, {});
};

const profiles = buildProfiles();

if (!profiles['Desktop Chrome']) {
  profiles['Desktop Chrome'] = fallbackDesktopProfile;
}

function getDeviceProfile(profileName) {
  if (profileName && profiles[profileName]) {
    return profiles[profileName];
  }
  return fallbackDesktopProfile;
}

function listAvailableProfiles() {
  return Object.keys(profiles).sort();
}

module.exports = {
  getDeviceProfile,
  listAvailableProfiles
};
