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

/**
 * Validates a custom device profile configuration
 * @param {Object} profile - Device profile to validate
 * @returns {Object} Object with valid boolean and errors array
 */
function validateDeviceProfile(profile) {
  const errors = [];

  // Required fields
  if (!profile.name || typeof profile.name !== 'string' || profile.name.trim().length === 0) {
    errors.push('name is required and must be a non-empty string');
  }

  if (!profile.user_agent || typeof profile.user_agent !== 'string' || profile.user_agent.trim().length === 0) {
    errors.push('user_agent is required and must be a non-empty string');
  }

  if (
    typeof profile.viewport_width !== 'number' ||
    profile.viewport_width <= 0 ||
    !Number.isInteger(profile.viewport_width)
  ) {
    errors.push('viewport_width must be a positive integer');
  }

  if (
    typeof profile.viewport_height !== 'number' ||
    profile.viewport_height <= 0 ||
    !Number.isInteger(profile.viewport_height)
  ) {
    errors.push('viewport_height must be a positive integer');
  }

  // Optional proxy URL validation
  if (profile.proxy_url !== null && profile.proxy_url !== undefined && profile.proxy_url !== '') {
    try {
      const proxyUrl = new URL(profile.proxy_url);
      // Validate proxy URL has appropriate scheme (http, https, socks4, socks5)
      const validSchemes = ['http:', 'https:', 'socks4:', 'socks5:'];
      if (!validSchemes.includes(proxyUrl.protocol)) {
        errors.push('proxy_url must use http, https, socks4, or socks5 protocol');
      }
    } catch {
      errors.push('proxy_url must be a valid URL');
    }
  }

  // Optional geolocation validation
  if (profile.geolocation_latitude !== null && profile.geolocation_latitude !== undefined) {
    if (typeof profile.geolocation_latitude !== 'number') {
      errors.push('geolocation_latitude must be a number');
    } else if (profile.geolocation_latitude < -90 || profile.geolocation_latitude > 90) {
      errors.push('geolocation_latitude must be between -90 and 90');
    }
  }

  if (profile.geolocation_longitude !== null && profile.geolocation_longitude !== undefined) {
    if (typeof profile.geolocation_longitude !== 'number') {
      errors.push('geolocation_longitude must be a number');
    } else if (profile.geolocation_longitude < -180 || profile.geolocation_longitude > 180) {
      errors.push('geolocation_longitude must be between -180 and 180');
    }
  }

  // Check if both lat and lng are provided together
  const hasLat = profile.geolocation_latitude !== null && profile.geolocation_latitude !== undefined;
  const hasLng = profile.geolocation_longitude !== null && profile.geolocation_longitude !== undefined;
  if (hasLat && !hasLng) {
    errors.push('geolocation_longitude is required when geolocation_latitude is provided');
  }
  if (hasLng && !hasLat) {
    errors.push('geolocation_latitude is required when geolocation_longitude is provided');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = { DEVICE_PROFILES, getDeviceProfile, validateDeviceProfile };
