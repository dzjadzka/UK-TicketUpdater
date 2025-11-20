const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(__dirname, '..', 'data');

function ensureFile(fileName) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]', 'utf8');
  }
  return filePath;
}

function readJson(fileName) {
  const filePath = ensureFile(fileName);
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to parse ${fileName}, resetting to empty array`, error);
    fs.writeFileSync(filePath, '[]', 'utf8');
    return [];
  }
}

function writeJson(fileName, data) {
  const filePath = ensureFile(fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { readJson, writeJson };
