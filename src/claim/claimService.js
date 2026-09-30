import { appState } from '../state.js';
import { wait } from '../utils/retry.js';

export class ClaimService {
  constructor({ maxRetries, retryDelayMs, logger }) {
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
    this.logger = logger;
  }

  enqueue(vanity) {
    appState.queue.push(vanity);
    this.logger.info({ vanity }, 'Queued vanity claim');
  }

  async processNext() {
    if (appState.queue.length === 0) {
      return null;
    }

    const vanity = appState.queue.shift();
    this.logger.info({ vanity }, 'Processing vanity claim');

    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      try {
        const result = await this.claim(vanity);
        if (result) {
          return result;
        }
      } catch (error) {
        this.logger.warn({ vanity, attempt, error: error.message }, 'Claim attempt failed');
      }

      if (attempt < this.maxRetries) {
        await wait(this.retryDelayMs);
      }
    }

    this.logger.error({ vanity }, 'Claim failed after retries');
    return null;
  }

  async claim(vanity) {
    if (!vanity) {
      throw new Error('Vanity value is required');
    }

    const start = Date.now();
    const latency = Date.now() - start;
    this.logger.info({ vanity, latency }, 'Claim simulated');

    return {
      vanity,
      success: true,
      latencyMs: latency
    };
  }
}
