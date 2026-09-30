import Database from 'better-sqlite3';
import { ensureDir } from '../utils/retry.js';
import path from 'node:path';

const QUEUE_TABLE_CREATE = `
  CREATE TABLE IF NOT EXISTS vanity_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vanity TEXT NOT NULL UNIQUE,
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    last_attempted_at INTEGER,
    queued_at INTEGER NOT NULL,
    status TEXT DEFAULT 'pending'
  );
  CREATE INDEX IF NOT EXISTS idx_priority_status ON vanity_queue(priority DESC, status);
  CREATE INDEX IF NOT EXISTS idx_vanity ON vanity_queue(vanity);
`;

const GRACE_TABLE_CREATE = `
  CREATE TABLE IF NOT EXISTS grace_periods (
    vanity TEXT PRIMARY KEY,
    release_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    attempts INTEGER DEFAULT 0,
    last_attempt_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_release_at ON grace_periods(release_at);
`;

export class Database2 {
  constructor(dbPath, logger) {
    this.logger = logger;
    ensureDir(path.dirname(dbPath));

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -10000');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 30000000');
    this.db.pragma('locking_mode = NORMAL');

    this.#init();
  }

  #init() {
    this.db.exec(GRACE_TABLE_CREATE);
    this.db.exec(QUEUE_TABLE_CREATE);
  }

  // Grace Period Methods
  setGrace(vanity, releaseAt) {
    const stmt = this.db.prepare(`
      INSERT INTO grace_periods (vanity, release_at, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(vanity) DO UPDATE SET release_at = excluded.release_at
    `);
    stmt.run(vanity, releaseAt, Date.now());
  }

  getExpiredGrace(now = Date.now()) {
    const stmt = this.db.prepare(`
      SELECT vanity, attempts FROM grace_periods 
      WHERE release_at <= ? AND attempts < 3
      ORDER BY attempts ASC
      LIMIT 50
    `);
    return stmt.all(now);
  }

  incrementGraceAttempts(vanity) {
    const stmt = this.db.prepare(`
      UPDATE grace_periods SET attempts = attempts + 1, last_attempt_at = ?
      WHERE vanity = ?
    `);
    stmt.run(Date.now(), vanity);
  }

  deleteGrace(vanity) {
    const stmt = this.db.prepare('DELETE FROM grace_periods WHERE vanity = ?');
    stmt.run(vanity);
  }

  // Queue Methods
  enqueue(vanity, priority = 0) {
    const stmt = this.db.prepare(`
      INSERT INTO vanity_queue (vanity, priority, queued_at, status)
      VALUES (?, ?, ?, 'pending')
      ON CONFLICT(vanity) DO UPDATE SET priority = MAX(priority, excluded.priority)
    `);
    try {
      stmt.run(vanity, priority, Date.now());
      return true;
    } catch (error) {
      return false;
    }
  }

  dequeue() {
    const stmt = this.db.prepare(`
      SELECT id, vanity, priority, attempts FROM vanity_queue
      WHERE status = 'pending'
      ORDER BY priority DESC, queued_at ASC
      LIMIT 1
    `);
    const row = stmt.get();

    if (row) {
      const updateStmt = this.db.prepare(
        'UPDATE vanity_queue SET status = "processing", last_attempted_at = ? WHERE id = ?'
      );
      updateStmt.run(Date.now(), row.id);
    }

    return row;
  }

  markQueueSuccess(vanity) {
    const stmt = this.db.prepare('UPDATE vanity_queue SET status = "success" WHERE vanity = ?');
    stmt.run(vanity);
  }

  markQueueFailed(vanity) {
    const stmt = this.db.prepare(
      'UPDATE vanity_queue SET status = "failed", attempts = attempts + 1 WHERE vanity = ?'
    );
    stmt.run(vanity);
  }

  getQueueStats() {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM vanity_queue
    `);
    return stmt.get();
  }

  getGraceStats() {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN release_at <= ? THEN 1 ELSE 0 END) as expired
      FROM grace_periods
    `);
    return stmt.get(Date.now());
  }

  cleanup() {
    this.db.close();
  }
}
