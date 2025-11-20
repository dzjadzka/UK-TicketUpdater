const { DEVICE_PROFILES, getDeviceProfile } = require('../src/deviceProfiles');

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
});
