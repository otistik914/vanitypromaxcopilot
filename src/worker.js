const PQueue = require('p-queue').default;
const axios = require('axios');
const https = require('https');
const http = require('http');
const { takeNext, markProcessed, recordFailure } = require('./queue');
const { logClaim } = require('./db');
const logger = require('./logger');

// Ultra-optimized HTTP/2 Agent with aggressive pooling
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000, // Keep alive 30s
  maxSockets: 100, // More concurrent connections
  maxFreeSockets: 50, // More free socket pool
  timeout: 3000, // Ultra-tight timeout
  freeSocketTimeout: 60000,
  scheduling: 'lifo', // Last In First Out - reuse warm connections
});

const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 100,
  maxFreeSockets: 50,
  timeout: 3000,
});

// Axios instance with pre-configured optimizations
const claimClient = axios.create({
  httpsAgent,
  httpAgent,
  timeout: 4000,
  maxRedirects: 0, // No redirects needed for Discord API
});

// DNS cache optimization
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Use Google DNS for faster resolution

const queue = new PQueue({
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '8'), // Default 8 for speed
  interval: 100, // Check every 100ms
  intervalCap: 100, // 100 tasks per 100ms = 1000/sec (way above Discord limit)
  timeout: 15000,
  throwOnTimeout: true,
  autoStart: true,
});

let isRunning = false;
let stats = {
  processed: 0,
  successful: 0,
  failed: 0,
  latencies: [],
  minLatency: Infinity,
  maxLatency: 0,
  avgLatency: 0,
  p95Latency: 0,
  p99Latency: 0,
};

function updateLatencyStats(latency) {
  stats.processed++;
  stats.latencies.push(latency);
  
  // Keep only last 1000 for p-percentile calculation
  if (stats.latencies.length > 1000) {
    stats.latencies.shift();
  }

  stats.minLatency = Math.min(stats.minLatency, latency);
  stats.maxLatency = Math.max(stats.maxLatency, latency);
  stats.avgLatency = Math.round(
    stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length
  );

  // Calculate percentiles
  const sorted = [...stats.latencies].sort((a, b) => a - b);
  stats.p95Latency = sorted[Math.floor(sorted.length * 0.95)];
  stats.p99Latency = sorted[Math.floor(sorted.length * 0.99)];
}

async function claimVanity(vanity) {
  const startTime = process.hrtime.bigint(); // Nanosecond precision

  try {
    const response = await claimClient.patch(
      `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/vanity-url`,
      { code: vanity },
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'DiscordVanitySniperPro/2.0-ultra',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        decompress: true,
      }
    );

    const latency = Math.round(Number(process.hrtime.bigint() - startTime) / 1000000); // Convert to ms
    updateLatencyStats(latency);
    stats.successful++;

    logClaim(vanity, true, latency, response.data.code);
    
    if (latency < 50) {
      logger.info(`🚀 ULTRA-FAST claim in ${latency}ms: ${vanity}`);
    } else if (latency < 100) {
      logger.info(`✅ Fast claim in ${latency}ms: ${vanity}`);
    } else {
      logger.info(`✅ Claim SUCCESS in ${latency}ms: ${vanity}`);
    }
    
    markProcessed(vanity);
    return true;
  } catch (err) {
    const latency = Math.round(Number(process.hrtime.bigint() - startTime) / 1000000);
    updateLatencyStats(latency);
    stats.failed++;

    if (err.response) {
      const status = err.response.status;
      const data = err.response.data || {};

      // 409 - Taken
      if (status === 409) {
        logger.warn(`⚠️  Vanity taken (409) in ${latency}ms: ${vanity}`);
        logClaim(vanity, false, latency, 'TAKEN_BY_OTHER');
        markProcessed(vanity);
        return false;
      }
      // 400 - Missing perms
      else if (status === 400 && data.code === 50013) {
        logger.error(`❌ Missing permissions (50013) in ${latency}ms: ${vanity}`);
        logClaim(vanity, false, latency, 'MISSING_PERMS');
        markProcessed(vanity);
        return false;
      }
      // 429 - Rate limited (RETRY)
      else if (status === 429) {
        logger.warn(`⏱️  Rate limited (429) in ${latency}ms: ${vanity}`);
        recordFailure(vanity);
        return null;
      }
      // 5xx - Server error (RETRY)
      else if (status >= 500) {
        logger.warn(`⚠️  Discord server error (${status}) in ${latency}ms: ${vanity}`);
        recordFailure(vanity);
        return null;
      }
      // Other errors
      else {
        logger.error(`❌ API error (${status}) in ${latency}ms: ${vanity} - ${data.message}`);
        logClaim(vanity, false, latency, `API_ERROR_${status}`);
        markProcessed(vanity);
        return false;
      }
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
      logger.warn(`⏱️  Connection error (${err.code}) in ${latency}ms: ${vanity}`);
      recordFailure(vanity);
      return null;
    } else if (err.code === 'ERR_HTTP2_STREAM_DESTROYED' || err.code === 'ERR_TLS_ALERT') {
      logger.warn(`⚠️  Connection reset in ${latency}ms: ${vanity}`);
      recordFailure(vanity);
      return null;
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

  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '8');
  logger.info(`🔄 ULTRA-FAST Worker pool: ${concurrency} concurrent, aggressive pooling, nanosecond precision`);

  // Immediate processing (no delay)
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
  }, 5); // Check every 5ms (ultra-aggressive)

  // Log performance stats every 30 seconds
  setInterval(() => {
    logger.info(
      `📊 PERFORMANCE: Avg ${stats.avgLatency}ms | Min ${stats.minLatency}ms | Max ${stats.maxLatency}ms | P95 ${stats.p95Latency}ms | P99 ${stats.p99Latency}ms | Success ${stats.successful}/${stats.processed}`
    );
  }, 30000);
}

async function stopWorker() {
  isRunning = false;
  logger.info('⏹️  Draining worker queue...');
  await queue.onIdle();
  logger.info(
    `✅ Worker stopped - Processed ${stats.processed} items | Final Avg Latency: ${stats.avgLatency}ms`
  );
}

module.exports = { startWorker, stopWorker, claimVanity };
