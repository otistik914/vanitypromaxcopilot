export class AggressiveClaimEngine {
  constructor({ httpClient, mfaManager, config, database, logger }) {
    this.httpClient = httpClient;
    this.mfaManager = mfaManager;
    this.config = config;
    this.database = database;
    this.logger = logger;
    this.processingInterval = null;
    this.stats = {
      processed: 0,
      successful: 0,
      failed: 0,
      avgLatency: 0
    };
  }

  enqueue(vanity, priority = 0) {
    this.database.enqueue(vanity, priority);
  }

  startProcessing() {
    // Process queue AGGRESSIVELY every 50ms
    this.processingInterval = setInterval(async () => {
      await this.#processNext();
    }, 50);
    this.logger.info('Claim processing started (50ms cycle)');
  }

  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  async #processNext() {
    const row = this.database.dequeue();
    if (!row) {
      return;
    }

    const { vanity, priority, attempts } = row;

    for (let attempt = 0; attempt < this.config.claimRetryLimit; attempt += 1) {
      try {
        const result = await this.#claimVanity(vanity);

        if (result.success) {
          this.database.markQueueSuccess(vanity);
          this.stats.successful += 1;
          this.stats.avgLatency = (this.stats.avgLatency + result.latencyMs) / 2;

          this.logger.info(
            { vanity, latencyMs: result.latencyMs, priority, attempt },
            '✅ CLAIMED'
          );
          return;
        }
      } catch (error) {
        this.logger.debug(
          { vanity, attempt: attempt + 1, error: error.message },
          'Claim attempt failed'
        );

        // Exponential backoff: 50ms, 100ms, 200ms
        if (attempt < this.config.claimRetryLimit - 1) {
          const backoff = 50 * Math.pow(2, attempt);
          await this.#sleep(backoff);
        }
      }
    }

    this.database.markQueueFailed(vanity);
    this.stats.failed += 1;
    this.logger.warn({ vanity }, '❌ Failed after all retries');
  }

  async #claimVanity(vanity) {
    if (this.mfaManager.isExpired()) {
      throw new Error('MFA expired');
    }

    const start = Date.now();

    try {
      const response = await this.httpClient.request({
        host: 'canary.discord.com',
        path: `/api/v9/guilds/${this.config.targetGuildId}/vanity-url`,
        method: 'PATCH',
        headers: {
          'Authorization': this.config.discordToken,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          'X-Discord-MFA-Authorization': this.mfaManager.getToken()
        },
        body: JSON.stringify({ code: vanity }),
        timeoutMs: 3500
      });

      const latency = Date.now() - start;
      this.stats.processed += 1;

      if (response.status === 200) {
        return { success: true, latencyMs: latency };
      }

      if (response.status === 429) {
        throw new Error('Rate limited');
      }

      if (response.status === 400 || response.status === 404) {
        throw new Error('Taken or invalid');
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      throw new Error(`Claim failed: ${error.message}`);
    }
  }

  #sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getStats() {
    return {
      ...this.stats,
      queue: this.database.getQueueStats(),
      grace: this.database.getGraceStats()
    };
  }
}
