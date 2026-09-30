const crypto = require('crypto');
const logger = require('./logger');

class VanityQueue {
  constructor() {
    this.queue = [];
    this.seen = new Map(); // vanity -> { timestamp, eventId, retries }
    this.dedupeWindow = parseInt(process.env.DEDUPE_TTL_MS || '60000');
    this.maxRetries = 5;
    this.maxQueueSize = parseInt(process.env.QUEUE_MAX_SIZE || '1000');
  }

  enqueue(vanity, eventId) {
    if (!vanity || typeof vanity !== 'string') return false;

    const vanityLower = vanity.toLowerCase();
    const now = Date.now();

    // Check if already processed recently
    if (this.seen.has(vanityLower)) {
      const entry = this.seen.get(vanityLower);
      const age = now - entry.timestamp;

      if (age < this.dedupeWindow) {
        // Still in dedupe window
        return false;
      }
    }

    // Check queue size
    if (this.queue.length >= this.maxQueueSize) {
      logger.warn(`⚠️  Queue full (${this.maxQueueSize}), dropping: ${vanity}`);
      return false;
    }

    // Add to queue
    this.queue.push({
      vanity: vanityLower,
      eventId: eventId || crypto.randomUUID(),
      timestamp: now,
      retries: 0,
      addedAt: now,
    });

    // Update seen map
    this.seen.set(vanityLower, {
      timestamp: now,
      eventId,
      retries: 0,
    });

    return true;
  }

  dequeue() {
    return this.queue.shift();
  }

  markProcessed(vanity) {
    const vanityLower = vanity.toLowerCase();
    this.seen.delete(vanityLower);
  }

  recordFailure(vanity) {
    const vanityLower = vanity.toLowerCase();
    const entry = this.seen.get(vanityLower);

    if (entry) {
      if (entry.retries < this.maxRetries) {
        entry.retries++;
        // Re-queue with delay
        this.queue.push({
          vanity: vanityLower,
          eventId: entry.eventId,
          timestamp: Date.now(),
          retries: entry.retries,
          addedAt: Date.now(),
        });
      } else {
        logger.error(`❌ Max retries exceeded for: ${vanity}`);
        this.markProcessed(vanity);
      }
    }
  }

  getStats() {
    return {
      queueSize: this.queue.length,
      maxSize: this.maxQueueSize,
      seenEntries: this.seen.size,
      dedupeWindow: this.dedupeWindow,
      nextItem: this.queue.length > 0 ? this.queue[0].vanity : null,
    };
  }

  // Cleanup old entries from seen map
  cleanup() {
    const now = Date.now();
    for (const [vanity, entry] of this.seen.entries()) {
      if (now - entry.timestamp > this.dedupeWindow * 2) {
        this.seen.delete(vanity);
      }
    }
  }
}

const vanityQueue = new VanityQueue();

// Cleanup every 5 minutes
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
