const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'vanity.db');
let db = null;

function initDB() {
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000');

    // Claims table
    db.exec(`
      CREATE TABLE IF NOT EXISTS claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vanity TEXT NOT NULL,
        success INTEGER NOT NULL,
        latency INTEGER,
        result TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(vanity, timestamp)
      );
      CREATE INDEX IF NOT EXISTS idx_claims_vanity ON claims(vanity);
      CREATE INDEX IF NOT EXISTS idx_claims_timestamp ON claims(timestamp DESC);
    `);

    // Polls table
    db.exec(`
      CREATE TABLE IF NOT EXISTS polls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vanity TEXT,
        success INTEGER NOT NULL,
        latency INTEGER,
        error_type TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_polls_timestamp ON polls(timestamp DESC);
    `);

    logger.info(`✅ Database initialized at: ${dbPath}`);
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
      SELECT success FROM claims
      WHERE vanity = ? AND success = 1
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    const result = stmt.get(vanity.toLowerCase());
    return !!result;
  } catch (err) {
    logger.error('Failed to check claim success:', err.message);
    return false;
  }
}

function getStats() {
  if (!db) return null;

  try {
    const claimsStmt = db.prepare(`
      SELECT COUNT(*) as total, SUM(success) as successful, AVG(latency) as avgLatency
      FROM claims
      WHERE timestamp > datetime('now', '-24 hours')
    `);
    const pollsStmt = db.prepare(`
      SELECT COUNT(*) as total, SUM(success) as successful, AVG(latency) as avgLatency
      FROM polls
      WHERE timestamp > datetime('now', '-24 hours')
    `);

    return {
      claims: claimsStmt.get(),
      polls: pollsStmt.get(),
    };
  } catch (err) {
    logger.error('Failed to get stats:', err.message);
    return null;
  }
}

function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initDB,
  logClaim,
  logPoll,
  isClaimSuccess,
  getStats,
  closeDB,
};
