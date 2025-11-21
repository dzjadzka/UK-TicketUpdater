const { DEVICE_PROFILES, getDeviceProfile, validateDeviceProfile } = require('../src/deviceProfiles');

describe('deviceProfiles', () => {
  describe('DEVICE_PROFILES', () => {
    it('should contain all required device profiles', () => {
      expect(DEVICE_PROFILES).toHaveProperty('desktop_chrome');
      expect(DEVICE_PROFILES).toHaveProperty('mobile_android');
      expect(DEVICE_PROFILES).toHaveProperty('iphone_13');
      expect(DEVICE_PROFILES).toHaveProperty('tablet_ipad');
    });

    it('should have complete profile data for each device', () => {
      Object.values(DEVICE_PROFILES).forEach((profile) => {
        expect(profile).toHaveProperty('name');
        expect(profile).toHaveProperty('userAgent');
        expect(profile).toHaveProperty('viewport');
        expect(profile).toHaveProperty('locale');
        expect(profile.viewport).toHaveProperty('width');
        expect(profile.viewport).toHaveProperty('height');
      });
    });

    it('should mark mobile devices with isMobile flag', () => {
      expect(DEVICE_PROFILES.desktop_chrome.viewport.isMobile).toBeUndefined();
      expect(DEVICE_PROFILES.mobile_android.viewport.isMobile).toBe(true);
      expect(DEVICE_PROFILES.iphone_13.viewport.isMobile).toBe(true);
      expect(DEVICE_PROFILES.tablet_ipad.viewport.isMobile).toBe(true);
    });
  });

  describe('getDeviceProfile', () => {
    it('should return the correct profile when given a valid name', () => {
      const profile = getDeviceProfile('mobile_android');
      expect(profile).toBe(DEVICE_PROFILES.mobile_android);
      expect(profile.name).toBe('mobile_android');
    });

    it('should return desktop_chrome as default when no name is provided', () => {
      const profile = getDeviceProfile();
      expect(profile).toBe(DEVICE_PROFILES.desktop_chrome);
    });

    it('should return desktop_chrome as default when null is provided', () => {
      const profile = getDeviceProfile(null);
      expect(profile).toBe(DEVICE_PROFILES.desktop_chrome);
    });

    it('should return desktop_chrome as default when invalid name is provided', () => {
      const profile = getDeviceProfile('invalid_device');
      expect(profile).toBe(DEVICE_PROFILES.desktop_chrome);
    });

    it('should work for all valid device names', () => {
      expect(getDeviceProfile('desktop_chrome').name).toBe('desktop_chrome');
      expect(getDeviceProfile('mobile_android').name).toBe('mobile_android');
      expect(getDeviceProfile('iphone_13').name).toBe('iphone_13');
      expect(getDeviceProfile('tablet_ipad').name).toBe('tablet_ipad');
    });
  });

  describe('validateDeviceProfile', () => {
    const validProfile = {
      name: 'Test Profile',
      user_agent: 'Mozilla/5.0...',
      viewport_width: 1920,
      viewport_height: 1080,
      locale: 'en-US',
      timezone: 'America/New_York',
      proxy_url: null,
      geolocation_latitude: null,
      geolocation_longitude: null
    };

    it('should validate a valid profile', () => {
      const result = validateDeviceProfile(validProfile);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject profile without name', () => {
      const profile = { ...validProfile, name: '' };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name is required and must be a non-empty string');
    });

    it('should reject profile without user_agent', () => {
      const profile = { ...validProfile, user_agent: '' };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('user_agent is required and must be a non-empty string');
    });

    it('should reject profile with invalid viewport_width', () => {
      const profile = { ...validProfile, viewport_width: -100 };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('viewport_width must be a positive integer');
    });

    it('should reject profile with non-integer viewport_width', () => {
      const profile = { ...validProfile, viewport_width: 100.5 };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('viewport_width must be a positive integer');
    });

    it('should reject profile with invalid viewport_height', () => {
      const profile = { ...validProfile, viewport_height: 0 };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('viewport_height must be a positive integer');
    });

    it('should reject profile with invalid proxy_url', () => {
      const profile = { ...validProfile, proxy_url: 'not-a-url' };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('proxy_url must be a valid URL');
    });

    it('should accept valid http proxy_url', () => {
      const profile = { ...validProfile, proxy_url: 'http://proxy.example.com:8080' };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(true);
    });

    it('should accept valid https proxy_url', () => {
      const profile = { ...validProfile, proxy_url: 'https://proxy.example.com:8080' };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(true);
    });

    it('should accept valid socks5 proxy_url', () => {
      const profile = { ...validProfile, proxy_url: 'socks5://proxy.example.com:1080' };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(true);
    });

    it('should reject proxy_url with invalid scheme', () => {
      const profile = { ...validProfile, proxy_url: 'ftp://proxy.example.com:8080' };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('proxy_url must use http, https, socks4, or socks5 protocol');
    });

    it('should reject latitude without longitude', () => {
      const profile = { ...validProfile, geolocation_latitude: 40.7128 };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('geolocation_longitude is required when geolocation_latitude is provided');
    });

    it('should reject longitude without latitude', () => {
      const profile = { ...validProfile, geolocation_longitude: -74.006 };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('geolocation_latitude is required when geolocation_longitude is provided');
    });

    it('should reject latitude out of range', () => {
      const profile = { ...validProfile, geolocation_latitude: 100, geolocation_longitude: 0 };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('geolocation_latitude must be between -90 and 90');
    });

    it('should reject longitude out of range', () => {
      const profile = { ...validProfile, geolocation_latitude: 0, geolocation_longitude: 200 };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('geolocation_longitude must be between -180 and 180');
    });

    it('should accept valid geolocation', () => {
      const profile = {
        ...validProfile,
        geolocation_latitude: 40.7128,
        geolocation_longitude: -74.006
      };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(true);
    });

    it('should accept profile with all optional fields', () => {
      const profile = {
        ...validProfile,
        proxy_url: 'http://proxy.example.com:8080',
        geolocation_latitude: 40.7128,
        geolocation_longitude: -74.006
      };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(true);
    });

    it('should collect multiple errors', () => {
      const profile = {
        name: '',
        user_agent: '',
        viewport_width: -1,
        viewport_height: -1,
        proxy_url: 'invalid',
        geolocation_latitude: 100
      };
      const result = validateDeviceProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
