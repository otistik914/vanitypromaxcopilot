const PQueue = require('p-queue').default;
const axios = require('axios');
const https = require('https');
const { takeNext, markProcessed, recordFailure } = require('./queue');
const { logClaim } = require('./db');
const logger = require('./logger');

// HTTP/2 Agent for connection pooling and performance
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 6000,
  freeSocketTimeout: 30000,
});

const queue = new PQueue({
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '4'),
  interval: 1000,
  intervalCap: 50, // Max 50 requests per second (Discord API safe)
  timeout: 30000,
  throwOnTimeout: true,
});

let isRunning = false;
let stats = {
  processed: 0,
  successful: 0,
  failed: 0,
  avgLatency: 0,
  latencies: [],
};

async function claimVanity(vanity) {
  const startTime = Date.now();

  try {
    const response = await axios.patch(
      `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/vanity-url`,
      { code: vanity },
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'DiscordVanitySniperPro/2.0',
          'Accept-Encoding': 'gzip',
        },
        timeout: 5000,
        httpAgent: httpsAgent,
        httpsAgent: httpsAgent,
      }
    );

    const latency = Date.now() - startTime;
    stats.processed++;
    stats.successful++;
    stats.latencies.push(latency);
    if (stats.latencies.length > 100) stats.latencies.shift();
    stats.avgLatency = Math.round(
      stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length
    );

    logClaim(vanity, true, latency, response.data.code);
    logger.info(`✅ Claim SUCCESS in ${latency}ms: ${vanity}`);
    markProcessed(vanity);
    return true;
  } catch (err) {
    const latency = Date.now() - startTime;
    stats.processed++;
    stats.failed++;

    if (err.response) {
      const status = err.response.status;
      const data = err.response.data || {};

      // 409 Conflict - Vanity taken
      if (status === 409) {
        logger.warn(`⚠️  Vanity taken (409) in ${latency}ms: ${vanity}`);
        logClaim(vanity, false, latency, 'TAKEN_BY_OTHER');
        markProcessed(vanity);
        return false;
      }
      // 400 Bad Request - Missing permissions
      else if (status === 400 && data.code === 50013) {
        logger.error(`❌ Missing permissions (50013) in ${latency}ms: ${vanity}`);
        logClaim(vanity, false, latency, 'MISSING_PERMS');
        markProcessed(vanity);
        return false;
      }
      // 429 Too Many Requests - Rate limited
      else if (status === 429) {
        logger.warn(`⏱️  Rate limited (429) in ${latency}ms: ${vanity}`);
        const retryAfter = err.response.headers['retry-after'];
        recordFailure(vanity);
        return null; // Retry
      }
      // 5xx Server errors - Retry
      else if (status >= 500) {
        logger.warn(`⚠️  Discord server error (${status}) in ${latency}ms: ${vanity}`);
        recordFailure(vanity);
        return null; // Retry
      }
      // Other API errors
      else {
        logger.error(`❌ API error (${status}) in ${latency}ms: ${vanity} - ${data.message}`);
        logClaim(vanity, false, latency, `API_ERROR_${status}`);
        markProcessed(vanity);
        return false;
      }
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
      logger.warn(`⏱️  Connection error (${err.code}) in ${latency}ms: ${vanity}`);
      recordFailure(vanity);
      return null; // Retry
    } else if (err.code === 'ERR_HTTP2_STREAM_DESTROYED' || err.code === 'ERR_TLS_ALERT') {
      logger.warn(`⚠️  Connection reset in ${latency}ms: ${vanity}`);
      recordFailure(vanity);
      return null; // Retry
    }

    logger.error(`❌ Claim error in ${latency}ms: ${vanity} - ${err.message}`);
    logClaim(vanity, false, latency, 'CLIENT_ERROR');
    markProcessed(vanity);
    return false;
  }
}

function startWorker() {
  if (isRunning) return;
  isRunning = true;

  logger.info('🔄 Worker pool initialized with ' + (process.env.WORKER_CONCURRENCY || 4) + ' concurrent tasks');

  const checkInterval = parseInt(process.env.CLAIM_INTERVAL_MS || '5000') / 10; // Check frequently

  setInterval(async () => {
    const item = takeNext();
    if (!item) return;

    queue.add(async () => {
      try {
        await claimVanity(item.vanity);
      } catch (err) {
        logger.error('Worker exception:', err.message);
        markProcessed(item.vanity);
      }
    }).catch((err) => {
      if (err.name === 'TimeoutError') {
        logger.warn(`⏱️  Task timeout for ${item.vanity}`);
        recordFailure(item.vanity);
      } else {
        logger.error('Queue error:', err.message);
      }
    });
  }, checkInterval);

  // Log worker stats periodically
  setInterval(() => {
    logger.debug(`📊 Worker stats - Processed: ${stats.processed}, Success: ${stats.successful}, Failed: ${stats.failed}, Avg latency: ${stats.avgLatency}ms`);
  }, 60000);
}

async function stopWorker() {
  isRunning = false;
  logger.info('⏹️  Draining worker queue...');
  await queue.onIdle();
  logger.info(`✅ Worker stopped - Processed ${stats.processed} items`);
}

module.exports = { startWorker, stopWorker, claimVanity };
