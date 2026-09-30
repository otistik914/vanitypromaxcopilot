const Database = require('better-sqlite3');
const path = require('path');
const logger = require('./logger');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'vanity.db');
let db = null;

function initDB() {
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000');
    db.pragma('temp_store = MEMORY');
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE IF NOT EXISTS claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vanity TEXT NOT NULL COLLATE NOCASE,
        success INTEGER NOT NULL,
        latency INTEGER,
        result TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(vanity, timestamp)
      );
      CREATE INDEX IF NOT EXISTS idx_claims_vanity ON claims(vanity);
      CREATE INDEX IF NOT EXISTS idx_claims_success ON claims(success);
      CREATE INDEX IF NOT EXISTS idx_claims_timestamp ON claims(timestamp DESC);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS polls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vanity TEXT COLLATE NOCASE,
        success INTEGER NOT NULL,
        latency INTEGER,
        error_type TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_polls_success ON polls(success);
      CREATE INDEX IF NOT EXISTS idx_polls_timestamp ON polls(timestamp DESC);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS stats_cache (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    logger.info(`✅ Database ready: ${dbPath}`);
  } catch (err) {
    logger.error('Database error:', err.message);
    throw err;
  }
}

function logClaim(vanity, success, latency, result) {
  if (!db) return;

  try {
    const stmt = db.prepare(`
      INSERT INTO claims (vanity, success, latency, result, timestamp)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(vanity.toLowerCase(), success ? 1 : 0, latency, result);
  } catch (err) {
    logger.error('Failed to log claim:', err.message);
  }
}

function logPoll(vanity, success, latency, errorType = null) {
  if (!db) return;

  try {
    const stmt = db.prepare(`
      INSERT INTO polls (vanity, success, latency, error_type, timestamp)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(vanity, success ? 1 : 0, latency, errorType);
  } catch (err) {
    logger.error('Failed to log poll:', err.message);
  }
}

function isClaimSuccess(vanity) {
  if (!db) return false;

  try {
    const stmt = db.prepare(`
      SELECT 1 FROM claims
      WHERE vanity = ? AND success = 1
      LIMIT 1
    `);
    return !!stmt.get(vanity.toLowerCase());
  } catch (err) {
    logger.error('Failed to check claim success:', err.message);
    return false;
  }
}

function getStats() {
  if (!db) return null;

  try {
    const claims24h = db.prepare(`
      SELECT COUNT(*) as total, SUM(success) as successful, AVG(latency) as avgLatency
      FROM claims
      WHERE timestamp > datetime('now', '-24 hours')
    `).get();

    const polls24h = db.prepare(`
      SELECT COUNT(*) as total, SUM(success) as successful, AVG(latency) as avgLatency
      FROM polls
      WHERE timestamp > datetime('now', '-24 hours')
    `).get();

    return {
      claims: claims24h,
      polls: polls24h,
    };
  } catch (err) {
    logger.error('Failed to get stats:', err.message);
    return null;
  }
}

function cleanup() {
  if (!db) return;

  try {
    db.prepare(`DELETE FROM claims WHERE timestamp < datetime('now', '-30 days')`).run();
    db.prepare(`DELETE FROM polls WHERE timestamp < datetime('now', '-7 days')`).run();
    db.exec('VACUUM;');
    logger.info('✅ Database cleanup completed');
  } catch (err) {
    logger.error('Database cleanup error:', err.message);
  }
}

function closeDB() {
  if (db) {
    try {
      db.close();
      db = null;
      logger.info('✅ Database connection closed');
    } catch (err) {
      logger.error('Error closing database:', err.message);
    }
  }
}

setInterval(() => {
  cleanup();
}, 24 * 60 * 60 * 1000);

module.exports = {
  initDB,
  logClaim,
  logPoll,
  isClaimSuccess,
  getStats,
  cleanup,
  closeDB,
};

