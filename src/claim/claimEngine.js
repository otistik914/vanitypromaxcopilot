import { wait } from '../utils/retry.js';

const BACKOFF_BASE_MS = 100;
const BACKOFF_MAX_MS = 5000;

function calculateBackoff(attempt) {
  const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt), BACKOFF_MAX_MS);
  const jitter = Math.random() * delay * 0.1;
  return delay + jitter;
}

export class ClaimEngine {
  constructor({ httpClient, mfaManager, config, logger }) {
    this.httpClient = httpClient;
    this.mfaManager = mfaManager;
    this.config = config;
    this.logger = logger;
    this.claimQueue = [];
    this.isProcessing = false;
  }

  enqueue(vanity, priority = 0) {
    this.claimQueue.push({ vanity, priority, queuedAt: Date.now() });
    this.claimQueue.sort((a, b) => b.priority - a.priority);
  }

  async processQueue() {
    if (this.isProcessing || this.claimQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.claimQueue.length > 0) {
      const { vanity, queuedAt } = this.claimQueue.shift();
      const queuedFor = Date.now() - queuedAt;

      for (let attempt = 0; attempt < this.config.claimRetryLimit; attempt += 1) {
        try {
          const result = await this.claim(vanity);
          if (result.success) {
            this.logger.info(
              { vanity, latencyMs: result.latencyMs, queuedForMs: queuedFor, attempt },
              'Vanity claimed'
            );
            return result;
          }
        } catch (error) {
          if (attempt < this.config.claimRetryLimit - 1) {
            const backoff = calculateBackoff(attempt);
            this.logger.debug(
              { vanity, attempt, backoffMs: backoff, error: error.message },
              'Claim failed, retrying'
            );
            await wait(backoff);
          }
        }
      }

      this.logger.warn({ vanity }, 'Claim exhausted retries');
    }

    this.isProcessing = false;
  }

  async claim(vanity) {
    if (this.mfaManager.isExpired()) {
      throw new Error('MFA token expired');
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
          'X-Discord-MFA-Authorization': this.mfaManager.getToken()
        },
        body: JSON.stringify({ code: vanity }),
        timeoutMs: 4000
      });

      const latency = Date.now() - start;

      if (response.status === 200) {
        return { success: true, vanity, latencyMs: latency };
      }

      const body = JSON.parse(response.body);

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers['retry-after'] ?? '1', 10);
        throw new Error(`Rate limited: retry after ${retryAfter}s`);
      }

      if (response.status === 400 || response.status === 404) {
        return { success: false, vanity, reason: 'Taken or invalid', latencyMs: latency };
      }

      throw new Error(`HTTP ${response.status}: ${body.message ?? 'Unknown'}`);
    } catch (error) {
      const latency = Date.now() - start;
      throw new Error(`Claim failed after ${latency}ms: ${error.message}`);
    }
  }
}
