const logger = require('./logger');

/**
 * Advanced Rate Limiter
 * Handles Discord API rate limits with exponential backoff and smart throttling
 */
class RateLimiter {
  constructor() {
    this.limits = new Map();
    this.requestQueue = [];
    this.processing = false;
    this.globalResetTime = null;
    this.requestsPerSecond = parseInt(process.env.REQUESTS_PER_SECOND || '5');
    this.minRequestInterval = 1000 / this.requestsPerSecond;
    this.lastRequestTime = 0;
  }

  /**
   * Check if we should wait before making a request
   */
  shouldThrottle() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    return timeSinceLastRequest < this.minRequestInterval;
  }

  /**
   * Get wait time before next request
   */
  getWaitTime() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const waitTime = Math.max(0, this.minRequestInterval - timeSinceLastRequest);
    return waitTime;
  }

  /**
   * Update rate limit info from response headers
   */
  updateFromHeaders(headers) {
    const remaining = parseInt(headers['x-ratelimit-remaining'] || '0');
    const resetTime = parseInt(headers['x-ratelimit-reset'] || '0') * 1000;
    const limit = parseInt(headers['x-ratelimit-limit'] || '0');

    if (remaining === 0 && resetTime) {
      const waitTime = Math.max(0, resetTime - Date.now() + 100);
      logger.warn(`⏱️ Rate limit hit! Waiting ${Math.ceil(waitTime / 1000)}s until reset`);
      this.globalResetTime = Date.now() + waitTime;
    }

    return {
      remaining,
      limit,
      resetTime,
      usage: limit - remaining,
    };
  }

  /**
   * Handle 429 response with exponential backoff
   */
  handle429(retryAfter = null) {
    const waitMs = (retryAfter || 1) * 1000;
    const backoffMultiplier = 1.5;
    const maxBackoff = 60000; // 60 seconds max

    const exponentialWait = Math.min(waitMs * backoffMultiplier, maxBackoff);
    this.globalResetTime = Date.now() + exponentialWait;

    logger.warn(`⏱️ 429 Rate Limited! Backing off for ${Math.ceil(exponentialWait / 1000)}s`);
    return exponentialWait;
  }

  /**
   * Check if we're currently rate limited
   */
  isRateLimited() {
    if (!this.globalResetTime) return false;
    if (Date.now() < this.globalResetTime) return true;
    this.globalResetTime = null;
    return false;
  }

  /**
   * Get current rate limit status
   */
  getStatus() {
    return {
      rateLimited: this.isRateLimited(),
      resetIn: Math.max(0, this.globalResetTime - Date.now()),
      requestsPerSecond: this.requestsPerSecond,
      lastRequestTime: this.lastRequestTime,
      timeSinceLastRequest: Date.now() - this.lastRequestTime,
    };
  }

  /**
   * Record a successful request
   */
  recordRequest() {
    this.lastRequestTime = Date.now();
  }

  /**
   * Wait before next request (respects rate limits and throttling)
   */
  async wait() {
    // Check global rate limit
    if (this.isRateLimited()) {
      const waitTime = Math.max(0, this.globalResetTime - Date.now());
      logger.warn(`⏱️ Global rate limit active, waiting ${Math.ceil(waitTime / 1000)}s`);
      await new Promise(resolve => setTimeout(resolve, waitTime + 100));
      this.globalResetTime = null;
    }

    // Check request throttling
    const throttleWait = this.getWaitTime();
    if (throttleWait > 0) {
      await new Promise(resolve => setTimeout(resolve, throttleWait));
    }
  }
}

const rateLimiter = new RateLimiter();

module.exports = rateLimiter;
