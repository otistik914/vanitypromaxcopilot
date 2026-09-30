export class GraceMonitor {
  constructor({ graceStore, claimEngine, config, logger }) {
    this.graceStore = graceStore;
    this.claimEngine = claimEngine;
    this.config = config;
    this.logger = logger;
    this.monitorTimer = null;
  }

  start() {
    this.monitorTimer = setInterval(() => {
      this.#checkExpired();
    }, 1000); // Check every second
  }

  #checkExpired() {
    const now = Date.now();
    const expired = this.graceStore.getExpired(now);

    for (const { vanity, attempts } of expired) {
      if (attempts >= 3) {
        this.logger.info({ vanity }, 'Grace period max attempts reached');
        this.graceStore.delete(vanity);
        continue;
      }

      this.logger.info({ vanity, attempt: attempts + 1 }, 'Grace period expired, attempting claim');
      this.claimEngine.enqueue(vanity, 10); // High priority
      this.graceStore.incrementAttempts(vanity);
    }
  }

  stop() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
  }
}
