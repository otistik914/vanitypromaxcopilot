import fs from 'node:fs';
import path from 'node:path';
import { ensureDir } from '../utils/retry.js';

export class GraceStore {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    ensureDir(path.dirname(this.filePath));
    this.#ensureFile();
  }

  #ensureFile() {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify({ entries: {} }, null, 2));
    }
  }

  read() {
    const raw = fs.readFileSync(this.filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.entries ?? {};
  }

  write(entries) {
    fs.writeFileSync(this.filePath, JSON.stringify({ entries }, null, 2));
  }

  set(vanity, releaseAt) {
    const entries = this.read();
    entries[vanity] = releaseAt;
    this.write(entries);
  }

  delete(vanity) {
    const entries = this.read();
    if (vanity in entries) {
      delete entries[vanity];
      this.write(entries);
    }
  }

  list() {
    return Object.entries(this.read()).map(([vanity, releaseAt]) => ({ vanity, releaseAt }));
  }
}
