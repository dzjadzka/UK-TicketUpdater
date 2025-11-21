const fs = require('fs');

// Mock dependencies BEFORE requiring the module under test
jest.mock('fs');
jest.mock('puppeteer', () => ({
  launch: jest.fn()
}));
jest.mock('../src/deviceProfiles');
jest.mock('../src/history');

const puppeteer = require('puppeteer');
const { downloadTicketForUser, downloadTickets } = require('../src/downloader');
const { getDeviceProfile } = require('../src/deviceProfiles');
const { appendHistory } = require('../src/history');

describe('downloader module', () => {
  let mockBrowser;
  let mockPage;
  let mockDb;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock page methods
    mockPage = {
      newPage: jest.fn(),
      setUserAgent: jest.fn().mockResolvedValue(undefined),
      setViewport: jest.fn().mockResolvedValue(undefined),
      setExtraHTTPHeaders: jest.fn().mockResolvedValue(undefined),
      emulateTimezone: jest.fn().mockResolvedValue(undefined),
      setGeolocation: jest.fn().mockResolvedValue(undefined),
      goto: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      type: jest.fn().mockResolvedValue(undefined),
      click: jest.fn().mockResolvedValue(undefined),
      waitForNavigation: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn().mockResolvedValue('NVV-Semesterticket content'),
      content: jest.fn().mockResolvedValue('<html>Ticket Content</html>'),
      $: jest.fn().mockResolvedValue(null),
      close: jest.fn().mockResolvedValue(undefined)
    };

    // Mock browser methods
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined)
    };

    // Mock puppeteer.launch
    puppeteer.launch = jest.fn().mockResolvedValue(mockBrowser);

    // Mock device profile
    getDeviceProfile.mockReturnValue({
      name: 'desktop_chrome',
      userAgent: 'Mozilla/5.0 Test Agent',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezone: 'UTC',
      geolocation_latitude: null,
      geolocation_longitude: null
    });

    // Mock DB
    mockDb = {
      getDeviceProfileById: jest.fn().mockReturnValue(null),
      recordTicket: jest.fn()
    };

    // Mock fs
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.mkdirSync = jest.fn();
    fs.writeFileSync = jest.fn();

    // Mock appendHistory
    appendHistory.mockImplementation(() => {});
  });

  describe('downloadTicketForUser', () => {
    const validUser = {
      id: 'user123',
      username: 'testuser',
      password: 'testpass'
    };

    test('should successfully download ticket for valid user', async () => {
      const result = await downloadTicketForUser(validUser);

      expect(result.status).toBe('success');
      expect(result.message).toBe('Ticket downloaded');
      expect(result.filePath).toMatch(/ticket-.*\.html$/);
      expect(result.deviceProfile).toBe('desktop_chrome');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('should throw error for invalid user object - missing id', async () => {
      await expect(
        downloadTicketForUser({ username: 'test', password: 'pass' })
      ).rejects.toThrow('User object must contain id, username, and password');
    });

    test('should throw error for invalid user object - missing username', async () => {
      await expect(
        downloadTicketForUser({ id: '123', password: 'pass' })
      ).rejects.toThrow('User object must contain id, username, and password');
    });

    test('should throw error for invalid user object - missing password', async () => {
      await expect(
        downloadTicketForUser({ id: '123', username: 'test' })
      ).rejects.toThrow('User object must contain id, username, and password');
    });

    test('should create output directory if it does not exist', async () => {
      fs.existsSync.mockReturnValue(false);

      await downloadTicketForUser(validUser);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('user123'),
        { recursive: true }
      );
    });

    test('should use custom output directory from user config', async () => {
      const userWithCustomDir = {
        ...validUser,
        outputDir: '/custom/path'
      };

      await downloadTicketForUser(userWithCustomDir);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('/custom/path'),
        expect.any(String)
      );
    });

    test('should use custom device profile from user config', async () => {
      const customProfile = {
        name: 'custom_mobile',
        userAgent: 'Custom Mobile Agent',
        viewport: { width: 375, height: 667 }
      };
      getDeviceProfile.mockReturnValue(customProfile);

      const userWithCustomProfile = {
        ...validUser,
        deviceProfile: 'custom_mobile'
      };

      const result = await downloadTicketForUser(userWithCustomProfile);

      expect(getDeviceProfile).toHaveBeenCalledWith('custom_mobile');
      expect(result.deviceProfile).toBe('custom_mobile');
    });

    test('should fetch custom device profile from database if UUID provided', async () => {
      const customDbProfile = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'custom_db_profile',
        user_agent: 'DB Custom Agent',
        viewport_width: 1024,
        viewport_height: 768,
        locale: 'de-DE',
        timezone: 'Europe/Berlin',
        proxy_url: null,
        geolocation_latitude: 51.5074,
        geolocation_longitude: -0.1278
      };

      mockDb.getDeviceProfileById.mockReturnValue(customDbProfile);

      const userWithDbProfile = {
        ...validUser,
        deviceProfile: '550e8400-e29b-41d4-a716-446655440000'
      };

      const result = await downloadTicketForUser(userWithDbProfile, { db: mockDb });

      expect(mockDb.getDeviceProfileById).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        'user123'
      );
      expect(result.deviceProfile).toBe('custom_db_profile');
      expect(mockPage.setUserAgent).toHaveBeenCalledWith('DB Custom Agent');
    });

    test('should set browser proxy if configured in device profile', async () => {
      const profileWithProxy = {
        name: 'proxied_profile',
        userAgent: 'Test Agent',
        viewport: { width: 1920, height: 1080 },
        proxy_url: 'http://proxy.example.com:8080'
      };
      getDeviceProfile.mockReturnValue(profileWithProxy);

      await downloadTicketForUser(validUser);

      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.arrayContaining(['--proxy-server=http://proxy.example.com:8080'])
        })
      );
    });

    test('should set geolocation if provided in device profile', async () => {
      const profileWithGeo = {
        name: 'geo_profile',
        userAgent: 'Test Agent',
        viewport: { width: 1920, height: 1080 },
        geolocation_latitude: 52.5200,
        geolocation_longitude: 13.4050
      };
      getDeviceProfile.mockReturnValue(profileWithGeo);

      await downloadTicketForUser(validUser);

      expect(mockPage.setGeolocation).toHaveBeenCalledWith({
        latitude: 52.5200,
        longitude: 13.4050
      });
    });

    test('should not set geolocation if coordinates are null', async () => {
      const profileWithoutGeo = {
        name: 'no_geo_profile',
        userAgent: 'Test Agent',
        viewport: { width: 1920, height: 1080 },
        geolocation_latitude: null,
        geolocation_longitude: null
      };
      getDeviceProfile.mockReturnValue(profileWithoutGeo);

      await downloadTicketForUser(validUser);

      expect(mockPage.setGeolocation).not.toHaveBeenCalled();
    });

    test('should handle privacy consent page', async () => {
      mockPage.evaluate.mockResolvedValueOnce('Website of the semester ticket');
      const acceptButton = { click: jest.fn().mockResolvedValue(undefined) };
      mockPage.$.mockResolvedValueOnce(acceptButton);

      await downloadTicketForUser(validUser);

      expect(acceptButton.click).toHaveBeenCalled();
      expect(mockPage.content).toHaveBeenCalled();
    });

    test('should return null and log if ticket content not found', async () => {
      mockPage.evaluate.mockResolvedValueOnce('Some other page content');

      const result = await downloadTicketForUser(validUser);

      expect(result.status).toBe('error');
      expect(result.message).toBe('Ticket content not found');
      expect(result.filePath).toBeNull();
    });

    test('should handle login failure gracefully', async () => {
      mockPage.waitForSelector.mockRejectedValueOnce(new Error('Selector timeout'));

      const result = await downloadTicketForUser(validUser);

      expect(result.status).toBe('error');
      expect(result.message).toContain('Login failed');
    });

    test('should handle browser launch failure', async () => {
      puppeteer.launch.mockRejectedValueOnce(new Error('Browser launch failed'));

      const result = await downloadTicketForUser(validUser);

      expect(result.status).toBe('error');
      expect(result.message).toBe('Browser launch failed');
    });

    test('should close browser even if download fails', async () => {
      mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));

      await downloadTicketForUser(validUser);

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    test('should append history with correct parameters', async () => {
      await downloadTicketForUser(validUser, { historyPath: '/tmp/history.json' });

      expect(appendHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          deviceProfile: 'desktop_chrome',
          status: 'success',
          message: 'Ticket downloaded'
        }),
        '/tmp/history.json',
        undefined
      );
    });

    test('should record ticket in database if db is provided', async () => {
      await downloadTicketForUser(validUser, { db: mockDb });

      expect(mockDb.recordTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          filePath: expect.stringMatching(/ticket-.*\.html$/),
          status: 'success'
        })
      );
    });

    test('should handle browser close failure gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockBrowser.close.mockRejectedValueOnce(new Error('Close failed'));

      await downloadTicketForUser(validUser);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to close browser'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    test('should use output_dir (snake_case) if outputDir not available', async () => {
      const userWithSnakeCaseDir = {
        ...validUser,
        output_dir: '/snake/case/path'
      };

      await downloadTicketForUser(userWithSnakeCaseDir);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('/snake/case/path'),
        expect.any(String)
      );
    });

    test('should use device_profile (snake_case) if deviceProfile not available', async () => {
      const customProfile = {
        name: 'snake_case_profile',
        userAgent: 'Test Agent',
        viewport: { width: 1920, height: 1080 }
      };
      getDeviceProfile.mockReturnValue(customProfile);

      const userWithSnakeCaseProfile = {
        ...validUser,
        device_profile: 'snake_case_profile'
      };

      const result = await downloadTicketForUser(userWithSnakeCaseProfile);

      expect(getDeviceProfile).toHaveBeenCalledWith('snake_case_profile');
      expect(result.deviceProfile).toBe('snake_case_profile');
    });

    test('should apply all device profile settings', async () => {
      const fullProfile = {
        name: 'full_profile',
        userAgent: 'Full Test Agent',
        viewport: { width: 1440, height: 900 },
        locale: 'fr-FR',
        timezone: 'Europe/Paris'
      };
      getDeviceProfile.mockReturnValue(fullProfile);

      await downloadTicketForUser(validUser);

      expect(mockPage.setUserAgent).toHaveBeenCalledWith('Full Test Agent');
      expect(mockPage.setViewport).toHaveBeenCalledWith({ width: 1440, height: 900 });
      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({
        'Accept-Language': 'fr-FR'
      });
      expect(mockPage.emulateTimezone).toHaveBeenCalledWith('Europe/Paris');
    });
  });

  describe('downloadTickets', () => {
    const users = [
      { id: 'user1', username: 'user1', password: 'pass1' },
      { id: 'user2', username: 'user2', password: 'pass2' },
      { id: 'user3', username: 'user3', password: 'pass3' }
    ];

    test('should download tickets for multiple users sequentially', async () => {
      const results = await downloadTickets(users);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('success');
      expect(results[1].status).toBe('success');
      expect(results[2].status).toBe('success');
      expect(puppeteer.launch).toHaveBeenCalledTimes(3);
    });

    test('should continue processing if one user fails', async () => {
      // Create separate mock browsers for each user
      const mockBrowser1 = { ...mockBrowser };
      const mockBrowser2 = { ...mockBrowser };
      const mockBrowser3 = { ...mockBrowser };
      
      const mockPage2 = { ...mockPage };
      mockPage2.waitForSelector = jest.fn().mockRejectedValue(new Error('Login failed'));
      mockBrowser2.newPage = jest.fn().mockResolvedValue(mockPage2);

      puppeteer.launch
        .mockResolvedValueOnce(mockBrowser1)
        .mockResolvedValueOnce(mockBrowser2)
        .mockResolvedValueOnce(mockBrowser3);

      const results = await downloadTickets(users);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('success');
      expect(results[1].status).toBe('error');
      expect(results[2].status).toBe('success');
    });

    test('should pass options to each download', async () => {
      const options = {
        defaultDeviceProfile: 'mobile_android',
        outputRoot: '/tmp/tickets',
        historyPath: '/tmp/history.json'
      };

      await downloadTickets(users, options);

      expect(appendHistory).toHaveBeenCalledWith(
        expect.any(Object),
        '/tmp/history.json',
        undefined
      );
    });

    test('should handle empty user array', async () => {
      const results = await downloadTickets([]);

      expect(results).toHaveLength(0);
      expect(puppeteer.launch).not.toHaveBeenCalled();
    });

    test('should process users in order', async () => {
      const launchCalls = [];
      puppeteer.launch.mockImplementation(() => {
        launchCalls.push(Date.now());
        return Promise.resolve(mockBrowser);
      });

      await downloadTickets(users);

      // Verify sequential execution (each call should be after previous)
      expect(launchCalls[0]).toBeLessThanOrEqual(launchCalls[1]);
      expect(launchCalls[1]).toBeLessThanOrEqual(launchCalls[2]);
    });
  });

  describe('edge cases and error handling', () => {
    const validUser = {
      id: 'user123',
      username: 'testuser',
      password: 'testpass'
    };

    test('should handle null user object', async () => {
      await expect(downloadTicketForUser(null)).rejects.toThrow(
        'User object must contain id, username, and password'
      );
    });

    test('should handle undefined user object', async () => {
      await expect(downloadTicketForUser(undefined)).rejects.toThrow(
        'User object must contain id, username, and password'
      );
    });

    test('should handle file system write errors', async () => {
      fs.writeFileSync.mockImplementationOnce(() => {
        throw new Error('Disk full');
      });

      const result = await downloadTicketForUser(validUser);

      expect(result.status).toBe('error');
      expect(result.message).toContain('Disk full');
    });

    test('should handle navigation timeout', async () => {
      mockPage.goto.mockRejectedValueOnce(new Error('Navigation timeout'));

      const result = await downloadTicketForUser(validUser);

      expect(result.status).toBe('error');
      expect(result.message).toContain('Navigation timeout');
    });

    test('should handle missing device profile gracefully', async () => {
      // Device profile functions return a default profile, not null
      // This test should verify that the default profile is used
      getDeviceProfile.mockReturnValue({
        name: 'default',
        userAgent: 'Default Agent',
        viewport: { width: 1920, height: 1080 }
      });

      const result = await downloadTicketForUser(validUser);
      
      expect(result).toBeDefined();
      expect(result.deviceProfile).toBe('default');
    });

    test('should handle database errors when recording ticket', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockDb.recordTicket.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      // Download should still succeed, DB recording failure is caught
      const result = await downloadTicketForUser(validUser, { db: mockDb });

      // The download succeeded, just DB recording failed (which is caught internally)
      expect(result.status).toBe('success');
      expect(result.filePath).toBeTruthy();
      consoleErrorSpy.mockRestore();
    });

    test('should handle UUID validation correctly', async () => {
      // Valid UUIDs
      const validUUIDs = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        '123e4567-e89b-12d3-a456-426614174000'
      ];

      for (const uuid of validUUIDs) {
        mockDb.getDeviceProfileById.mockReturnValueOnce({
          id: uuid,
          name: 'test',
          user_agent: 'test',
          viewport_width: 1024,
          viewport_height: 768
        });

        await downloadTicketForUser(
          { ...validUser, deviceProfile: uuid },
          { db: mockDb }
        );

        expect(mockDb.getDeviceProfileById).toHaveBeenCalledWith(uuid, validUser.id);
      }
    });

    test('should not treat non-UUID strings as custom profiles', async () => {
      const nonUUIDProfiles = ['desktop_chrome', 'mobile', 'custom-profile-name'];

      for (const profileName of nonUUIDProfiles) {
        await downloadTicketForUser(
          { ...validUser, deviceProfile: profileName },
          { db: mockDb }
        );

        expect(getDeviceProfile).toHaveBeenCalledWith(profileName);
      }

      expect(mockDb.getDeviceProfileById).not.toHaveBeenCalled();
    });
  });
});
