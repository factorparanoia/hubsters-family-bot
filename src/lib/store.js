const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.resolve(__dirname, '..', '..', 'data');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function filePath(name) {
  ensureDataDir();
  return path.join(dataDir, `${name}.json`);
}

function readJson(name, fallback) {
  const target = filePath(name);
  if (!fs.existsSync(target)) {
    return fallback;
  }

  try {
    const raw = fs.readFileSync(target, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(name, value) {
  const target = filePath(name);
  fs.writeFileSync(target, JSON.stringify(value, null, 2));
}

function appendJsonArray(name, entry) {
  const existing = readJson(name, []);
  existing.push(entry);
  writeJson(name, existing);
}

module.exports = {
  readJson,
  writeJson,
  appendJsonArray
};
