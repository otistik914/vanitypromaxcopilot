const crypto = require('crypto');
const logger = require('./logger');

class VanityQueue {
  constructor() {
    this.queue = [];
    this.processing = new Set();
    this.seen = new Map();
    this.dedupeWindow = parseInt(process.env.DEDUPE_TTL_MS || '60000');
    this.maxRetries = 5;
    this.maxQueueSize = parseInt(process.env.QUEUE_MAX_SIZE || '1000');
  }

  enqueue(vanity, eventId) {
    if (!vanity || typeof vanity !== 'string') return false;

    const vanityLower = vanity.toLowerCase();
    const now = Date.now();

    if (this.seen.has(vanityLower)) {
      const entry = this.seen.get(vanityLower);
      if (now - entry.timestamp < this.dedupeWindow) {
        return false;
      }
    }

    if (this.queue.length >= this.maxQueueSize) {
      logger.warn(`⚠️  Queue full (${this.maxQueueSize}), dropping: ${vanity}`);
      return false;
    }

    const queueItem = {
      vanity: vanityLower,
      eventId: eventId || crypto.randomUUID(),
      timestamp: now,
      retries: 0,
      addedAt: now,
    };

    this.queue.push(queueItem);
    this.seen.set(vanityLower, queueItem);

    return true;
  }

  dequeue() {
    const item = this.queue.shift();
    if (item) {
      this.processing.add(item.vanity);
    }
    return item;
  }

  markProcessed(vanity) {
    const vanityLower = vanity.toLowerCase();
    this.processing.delete(vanityLower);
    this.seen.delete(vanityLower);
  }

  recordFailure(vanity) {
    const vanityLower = vanity.toLowerCase();
    const entry = this.seen.get(vanityLower);

    if (entry) {
      if (entry.retries < this.maxRetries) {
        entry.retries++;
        entry.timestamp = Date.now();
        this.queue.push(entry);
      } else {
        logger.error(`❌ Max retries (${this.maxRetries}) exceeded: ${vanity}`);
        this.markProcessed(vanity);
      }
    }
  }

  getStats() {
    return {
      queueSize: this.queue.length,
      maxSize: this.maxQueueSize,
      processing: this.processing.size,
      seenEntries: this.seen.size,
      dedupeWindow: this.dedupeWindow,
      nextItem: this.queue.length > 0 ? this.queue[0].vanity : null,
    };
  }

  cleanup() {
    const now = Date.now();
    const deadlineTime = now - (this.dedupeWindow * 2);

    for (const [vanity, entry] of this.seen.entries()) {
      if (entry.timestamp < deadlineTime) {
        this.seen.delete(vanity);
      }
    }
  }
}

const vanityQueue = new VanityQueue();

setInterval(() => {
  vanityQueue.cleanup();
}, 5 * 60 * 1000);

module.exports = {
  enqueueVanity: (vanity, eventId) => vanityQueue.enqueue(vanity, eventId),
  takeNext: () => vanityQueue.dequeue(),
  markProcessed: (vanity) => vanityQueue.markProcessed(vanity),
  recordFailure: (vanity) => vanityQueue.recordFailure(vanity),
  getQueueStats: () => vanityQueue.getStats(),
};

