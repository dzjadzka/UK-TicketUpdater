const crypto = require('crypto');

module.exports = {
  hash: async (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const digest = crypto
      .createHash('sha256')
      .update(password + salt)
      .digest('hex');
    return `${salt}:${digest}`;
  },
  compare: async (password, hash) => {
    if (!hash || !hash.includes(':')) {
      return false;
    }
    const [salt, digest] = hash.split(':');
    const check = crypto
      .createHash('sha256')
      .update(password + salt)
      .digest('hex');
    return check === digest;
  }
};
