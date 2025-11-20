const { createConnection } = require('./db/connection');

function logDownload({ userId = null, status, device, filePath, timestamp = new Date() }) {
  const db = createConnection();
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO download_history (user_id, status, device, file_path, timestamp) VALUES (?, ?, ?, ?, ?)',
      [userId, status, device, filePath, timestamp.toISOString()],
      function (err) {
        db.close();
        if (err) return reject(err);
        resolve({ id: this.lastID, userId, status, device, filePath, timestamp });
      }
    );
  });
}

module.exports = { logDownload };
