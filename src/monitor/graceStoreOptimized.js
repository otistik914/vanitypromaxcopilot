import Database from 'better-sqlite3';
import { ensureDir } from '../utils/retry.js';
import path from 'node:path';

export class GraceStore {
  constructor(dbPath, logger) {
    this.logger = logger;
    ensureDir(path.dirname(dbPath));

    this.db = new Database(dbPath, { verbose: null });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 10000');
    this.db.pragma('temp_store = MEMORY');

    this.#init();
  }

  #init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS grace_periods (
        vanity TEXT PRIMARY KEY,
        release_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        attempts INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_release_at ON grace_periods(release_at);
    `);
  }

  set(vanity, releaseAt) {
    const stmt = this.db.prepare(`
      INSERT INTO grace_periods (vanity, release_at, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(vanity) DO UPDATE SET release_at = excluded.release_at
    `);
    stmt.run(vanity, releaseAt, Date.now());
  }

  getExpired(now = Date.now()) {
    const stmt = this.db.prepare(`
      SELECT vanity, attempts FROM grace_periods WHERE release_at <= ? LIMIT 100
    `);
    return stmt.all(now);
  }

  incrementAttempts(vanity) {
    const stmt = this.db.prepare('UPDATE grace_periods SET attempts = attempts + 1 WHERE vanity = ?');
    stmt.run(vanity);
  }

  delete(vanity) {
    const stmt = this.db.prepare('DELETE FROM grace_periods WHERE vanity = ?');
    stmt.run(vanity);
  }

  cleanup() {
    this.db.close();
  }
}
