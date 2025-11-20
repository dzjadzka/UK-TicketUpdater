const {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  generateInviteToken,
  getInviteExpiration,
  isInviteExpired,
  isValidEmail,
  validatePassword,
  encrypt,
  decrypt,
  INVITE_TOKEN_EXPIRY_HOURS
} = require('../src/auth');

describe('auth module', () => {
  describe('password hashing', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'TestPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should verify correct password', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);
      const isValid = await comparePassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);
      const isValid = await comparePassword('WrongPassword123', hash);

      expect(isValid).toBe(false);
    });
  });

  describe('JWT tokens', () => {
    it('should generate a valid JWT token', () => {
      const user = { id: 'user-123', email: 'test@example.com', role: 'user' };
      const token = generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should verify and decode valid token', () => {
      const user = { id: 'user-123', email: 'test@example.com', role: 'admin' };
      const token = generateToken(user);
      const decoded = verifyToken(token);

      expect(decoded.id).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.role).toBe(user.role);
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow('Invalid token');
    });

    it('should throw error for malformed token', () => {
      expect(() => verifyToken('not.a.token')).toThrow();
    });
  });

  describe('invite tokens', () => {
    it('should generate invite token', () => {
      const token = generateInviteToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes in hex
    });

    it('should generate unique invite tokens', () => {
      const token1 = generateInviteToken();
      const token2 = generateInviteToken();

      expect(token1).not.toBe(token2);
    });

    it('should get invite expiration date', () => {
      const expiresAt = getInviteExpiration();
      const now = new Date();
      const expected = new Date(now.getTime() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      const expiresDate = new Date(expiresAt);
      expect(Math.abs(expiresDate.getTime() - expected.getTime())).toBeLessThan(1000);
    });

    it('should allow custom expiration hours', () => {
      const hours = 24;
      const expiresAt = getInviteExpiration(hours);
      const now = new Date();
      const expected = new Date(now.getTime() + hours * 60 * 60 * 1000);

      const expiresDate = new Date(expiresAt);
      expect(Math.abs(expiresDate.getTime() - expected.getTime())).toBeLessThan(1000);
    });

    it('should detect expired invite token', () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);
      const expiresAt = pastDate.toISOString();

      expect(isInviteExpired(expiresAt)).toBe(true);
    });

    it('should detect non-expired invite token', () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      const expiresAt = futureDate.toISOString();

      expect(isInviteExpired(expiresAt)).toBe(false);
    });
  });

  describe('email validation', () => {
    it('should validate correct email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('no@domain')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('password validation', () => {
    it('should validate strong password', () => {
      const result = validatePassword('StrongPass123');
      expect(result.isValid).toBe(true);
    });

    it('should reject short password', () => {
      const result = validatePassword('Short1A');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('8 characters');
    });

    it('should reject password without lowercase', () => {
      const result = validatePassword('UPPERCASE123');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('lowercase');
    });

    it('should reject password without uppercase', () => {
      const result = validatePassword('lowercase123');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('uppercase');
    });

    it('should reject password without number', () => {
      const result = validatePassword('NoNumberHere');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('number');
    });

    it('should reject empty password', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
    });
  });

  describe('encryption and decryption', () => {
    const key = 'test-encryption-key-32-chars!!';

    it('should encrypt and decrypt text', () => {
      const plaintext = 'secret-password-123';
      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);

      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
    });

    it('should generate different encrypted values for same plaintext', () => {
      const plaintext = 'secret-password-123';
      const encrypted1 = encrypt(plaintext, key);
      const encrypted2 = encrypt(plaintext, key);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error with wrong decryption key', () => {
      const plaintext = 'secret-password-123';
      const encrypted = encrypt(plaintext, key);

      expect(() => decrypt(encrypted, 'wrong-key')).toThrow();
    });

    it('should throw error with malformed encrypted data', () => {
      expect(() => decrypt('invalid:data', key)).toThrow('Invalid encrypted data format');
      expect(() => decrypt('only:two:parts', key)).toThrow();
    });

    it('should handle special characters in plaintext', () => {
      const plaintext = 'password!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters in plaintext', () => {
      const plaintext = 'пароль-密码-🔒';
      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });
  });
});
