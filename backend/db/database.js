const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'agrinova.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'farmer',
    plan TEXT DEFAULT 'free',
    scans_this_month INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fields (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    location_lat REAL,
    location_lng REAL,
    size_ha REAL,
    crop_type TEXT,
    planting_date TEXT,
    soil_type TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    field_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    image_path TEXT,
    status TEXT DEFAULT 'pending',
    crop_type TEXT,
    growth_stage TEXT,
    health_score INTEGER,
    issues TEXT,
    severity TEXT,
    urgency TEXT,
    yield_impact TEXT,
    recommendations TEXT,
    ai_confidence REAL,
    roi TEXT,
    summary TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(field_id) REFERENCES fields(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS treatments (
    id TEXT PRIMARY KEY,
    scan_id TEXT NOT NULL,
    name TEXT,
    type TEXT,
    dosage TEXT,
    cost_per_ha REAL,
    effectiveness REAL,
    pre_harvest_interval TEXT,
    notes TEXT,
    FOREIGN KEY(scan_id) REFERENCES scans(id)
  );

  CREATE TABLE IF NOT EXISTS market_prices (
    id TEXT PRIMARY KEY,
    crop_type TEXT NOT NULL,
    price_per_kg REAL NOT NULL,
    region TEXT,
    date TEXT NOT NULL,
    trend TEXT DEFAULT 'stable'
  );

  CREATE TABLE IF NOT EXISTS farm_inputs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    field_id TEXT,
    type TEXT,
    name TEXT,
    quantity REAL,
    unit TEXT,
    cost REAL,
    date TEXT,
    notes TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Create indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_fields_user_id ON fields(user_id);
  CREATE INDEX IF NOT EXISTS idx_scans_field_id ON scans(field_id);
  CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
`);

module.exports = db;
