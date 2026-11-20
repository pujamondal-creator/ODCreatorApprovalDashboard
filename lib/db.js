const fs = require('fs');
const path = require('path');
const seed = require('./seed');

const FILE = path.join(__dirname, '..', 'data', 'db.json');
let db = null;

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}

function fresh() {
  db = seed.build();
  seed.initialSync(db);
  seed.applyDemoState(db);
  save();
  return db;
}

function get() {
  if (db) return db;
  if (fs.existsSync(FILE)) {
    db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return db;
  }
  return fresh();
}

module.exports = { get, save, reset: fresh };
