/**
 * Form validation utilities
 */

/**
 * Validate email format
 * @param {string} email
 * @returns {{valid: boolean, error: string}}
 */
export const validateEmail = (email) => {
  if (!email || email.trim() === '') {
    return { valid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  return { valid: true, error: '' };
};

/**
 * Validate login identifier (email or username)
 * More permissive than validateEmail - allows non-email usernames like 'admin'
 * @param {string} login
 * @returns {{valid: boolean, error: string}}
 */
export const validateLogin = (login) => {
  if (!login || login.trim() === '') {
    return { valid: false, error: 'Login is required' };
  }

  if (login.length < 2) {
    return { valid: false, error: 'Login must be at least 2 characters' };
  }

  return { valid: true, error: '' };
};

/**
 * Validate password strength
 * Requires: min 8 characters, at least one letter and one number
 * @param {string} password
 * @returns {{valid: boolean, error: string, strength: string}}
 */
export const validatePassword = (password) => {
  if (!password || password.trim() === '') {
    return { valid: false, error: 'Password is required', strength: 'none' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long', strength: 'weak' };
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter || !hasNumber) {
    return { valid: false, error: 'Password must contain at least one letter and one number', strength: 'weak' };
  }

  // Check strength
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  let strength = 'medium';
  if (password.length >= 12 && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar) {
    strength = 'strong';
  }

  return { valid: true, error: '', strength };
};

/**
 * Validate required field
 * @param {string} value
 * @param {string} fieldName
 * @returns {{valid: boolean, error: string}}
 */
export const validateRequired = (value, fieldName) => {
  if (!value || value.toString().trim() === '') {
    return { valid: false, error: `${fieldName} is required` };
  }
  return { valid: true, error: '' };
};

/**
 * Validate UK number format
 * @param {string} ukNumber
 * @returns {{valid: boolean, error: string}}
 */
export const validateUKNumber = (ukNumber) => {
  if (!ukNumber || ukNumber.trim() === '') {
    return { valid: false, error: 'UK number is required' };
  }

  // Basic validation - must be alphanumeric
  const ukNumberRegex = /^[a-zA-Z0-9]+$/;
  if (!ukNumberRegex.test(ukNumber)) {
    return { valid: false, error: 'UK number must contain only letters and numbers' };
  }

  if (ukNumber.length < 3) {
    return { valid: false, error: 'UK number is too short' };
  }

  return { valid: true, error: '' };
};

/**
 * Validate URL format
 * @param {string} url
 * @returns {{valid: boolean, error: string}}
 */
export const validateURL = (url) => {
  if (!url || url.trim() === '') {
    return { valid: true, error: '' }; // URL is optional in most cases
  }

  try {
    new URL(url);
    return { valid: true, error: '' };
  } catch {
    return { valid: false, error: 'Please enter a valid URL' };
  }
};

/**
 * Validate positive number
 * @param {string|number} value
 * @param {string} fieldName
 * @returns {{valid: boolean, error: string}}
 */
export const validatePositiveNumber = (value, fieldName) => {
  const num = Number(value);
  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a number` };
  }
  if (num <= 0) {
    return { valid: false, error: `${fieldName} must be greater than 0` };
  }
  return { valid: true, error: '' };
};

/**
 * Validate user agent string
 * @param {string} userAgent
 * @returns {{valid: boolean, error: string}}
 */
export const validateUserAgent = (userAgent) => {
  if (!userAgent || userAgent.trim() === '') {
    return { valid: false, error: 'User agent is required' };
  }

  if (userAgent.length < 10) {
    return { valid: false, error: 'User agent string is too short' };
  }

  return { valid: true, error: '' };
};
