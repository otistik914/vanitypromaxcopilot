const PQueue = require('p-queue').default;
const axios = require('axios');
const https = require('https');
const http = require('http');
const { takeNext, markProcessed, recordFailure } = require('./queue');
const { logClaim } = require('./db');
const rateLimiter = require('./rate-limiter');
const logger = require('./logger');

const targetGuildId = process.env.DISCORD_GUILD_ID;

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 25,
  maxFreeSockets: 10,
  timeout: 3000,
  freeSocketTimeout: 60000,
  scheduling: 'lifo',
});

const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 25,
  maxFreeSockets: 10,
  timeout: 3000,
});

const claimClient = axios.create({
  httpsAgent,
  httpAgent,
  timeout: 4000,
  maxRedirects: 0,
  validateStatus: () => true,
});

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const queue = new PQueue({
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2'),
  interval: 1000,
  intervalCap: parseInt(process.env.REQUESTS_PER_SECOND || '2'),
  timeout: 15000,
  throwOnTimeout: true,
  autoStart: true,
});

let isRunning = false;
let stats = {
  processed: 0,
  successful: 0,
  failed: 0,
  rateLimited: 0,
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

  if (stats.latencies.length > 1000) {
    stats.latencies.shift();
  }

  stats.minLatency = Math.min(stats.minLatency, latency);
  stats.maxLatency = Math.max(stats.maxLatency, latency);
  stats.avgLatency = Math.round(
    stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length
  );

  const sorted = [...stats.latencies].sort((a, b) => a - b);
  stats.p95Latency = sorted[Math.floor(sorted.length * 0.95)] || 0;
  stats.p99Latency = sorted[Math.floor(sorted.length * 0.99)] || 0;
}

async function sendWebhook(status, vanity, message, details = {}) {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) return;

  const statusColors = {
    success: 3066993,  // Green
    failed: 15158332,  // Red
    ratelimit: 16776960,  // Yellow
    delayed: 16755200,  // Orange
  };

  const embed = {
    color: statusColors[status] || 9807270,
    title: `🎯 Vanity Claim: ${status.toUpperCase()}`,
    description: message,
    fields: [
      {
        name: '📝 Vanity',
        value: `\`${vanity}\``,
        inline: true,
      },
      {
        name: '⏱️ Timestamp',
        value: new Date().toISOString(),
        inline: true,
      },
    ],
    footer: {
      text: 'Discord Vanity Sniper Pro',
    },
  };

  if (details.latency) {
    embed.fields.push({
      name: '⏰ Latency',
      value: `${details.latency}ms`,
      inline: true,
    });
  }

  if (details.error) {
    embed.fields.push({
      name: '❌ Error',
      value: `\`\`\`${details.error}\`\`\``,
      inline: false,
    });
  }

  if (details.retryAfter) {
    embed.fields.push({
      name: '⏳ Retry After',
      value: `${details.retryAfter}s`,
      inline: true,
    });
  }

  try {
    await axios.post(webhookUrl, {
      embeds: [embed],
    });
  } catch (err) {
    logger.warn(`⚠️ Failed to send webhook: ${err.message}`);
  }
}

async function claimVanity(vanity) {
  if (!targetGuildId) {
    logger.error('❌ DISCORD_GUILD_ID is missing; cannot claim vanity on any guild');
    return false;
  }

  const userToken = process.env.DISCORD_USER_TOKEN;
  if (!userToken) {
    logger.error('❌ DISCORD_USER_TOKEN is missing; cannot claim vanity');
    return false;
  }

  await rateLimiter.wait();

  const startTime = process.hrtime.bigint();

  try {
    const response = await claimClient.patch(
      `https://discord.com/api/v10/guilds/${targetGuildId}/vanity-url`,
      { code: vanity },
      {
        headers: {
          Authorization: userToken,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        decompress: true,
      }
    );

    const status = response.status;
    const data = response.data || {};

    rateLimiter.updateFromHeaders(response.headers || {});
    rateLimiter.recordRequest();

    const latency = Math.round(Number(process.hrtime.bigint() - startTime) / 1000000);
    updateLatencyStats(latency);

    if (status === 200) {
      stats.successful++;
      logClaim(vanity, true, latency, 'SUCCESS');
      logger.info(`🚀 ✅ Claim SUCCESS in ${latency}ms: ${vanity}`);
      
      await sendWebhook('success', vanity, `Vanity URL claimed successfully!`, {
        latency,
      });
      
      markProcessed(vanity);
      return true;
    }

    if (status === 429) {
      const retryAfter = Number(data.retry_after || response.headers?.['retry-after'] || 1);
      const waitMs = rateLimiter.handle429(retryAfter);
      stats.rateLimited++;
      stats.failed++;
      logger.warn(`⏱️ 429 Rate Limited (${latency}ms): ${vanity}. Backoff ${Math.ceil(waitMs / 1000)}s`);
      
      await sendWebhook('ratelimit', vanity, `Rate limited! Will retry after delay.`, {
        latency,
        retryAfter,
      });
      
      recordFailure(vanity);
      return null;
    }

    if (status === 409) {
      stats.failed++;
      logger.warn(`⚠️ 409 Conflict - Vanity already taken (${latency}ms): ${vanity}`);
      logClaim(vanity, false, latency, 'CONFLICT_409');
      
      await sendWebhook('failed', vanity, `Vanity already taken by someone else.`, {
        latency,
        error: '409 Conflict',
      });
      
      markProcessed(vanity);
      return false;
    }

    if (status === 401) {
      stats.failed++;
      logger.error(`❌ 401 Unauthorized (${latency}ms): Invalid or expired user token`);
      logClaim(vanity, false, latency, 'AUTH_FAILED_401');
      
      await sendWebhook('failed', vanity, `Authentication failed! User token may be invalid or expired.`, {
        latency,
        error: '401 Unauthorized - Invalid/expired token',
      });
      
      markProcessed(vanity);
      return false;
    }

    if (status === 403) {
      stats.failed++;
      logger.error(`❌ 403 Forbidden (${latency}ms): User lacks permissions`);
      logClaim(vanity, false, latency, 'FORBIDDEN_403');
      
      await sendWebhook('failed', vanity, `Access forbidden! User may not have permissions on this guild.`, {
        latency,
        error: '403 Forbidden',
      });
      
      markProcessed(vanity);
      return false;
    }

    if (status === 404) {
      stats.failed++;
      logger.error(`❌ 404 Not Found (${latency}ms): Guild ${targetGuildId} not found`);
      logClaim(vanity, false, latency, 'GUILD_NOT_FOUND_404');
      
      await sendWebhook('failed', vanity, `Guild not found! Invalid DISCORD_GUILD_ID.`, {
        latency,
        error: '404 Not Found',
      });
      
      markProcessed(vanity);
      return false;
    }

    if (status === 400 && data.code === 50013) {
      stats.failed++;
      logger.error(`❌ 400 Permission Error (50013) (${latency}ms): ${vanity}`);
      logClaim(vanity, false, latency, 'MISSING_PERMS_50013');
      
      await sendWebhook('failed', vanity, `Permission error! User may lack required permissions.`, {
        latency,
        error: '400 Missing Permissions (50013)',
      });
      
      markProcessed(vanity);
      return false;
    }

    if (status >= 500) {
      stats.failed++;
      logger.warn(`⚠️ ${status} Server Error (${latency}ms): ${vanity}`);
      
      await sendWebhook('delayed', vanity, `Discord server error (${status}). Will retry.`, {
        latency,
        error: `${status} Server Error`,
      });
      
      recordFailure(vanity);
      return null;
    }

    stats.failed++;
    logger.error(`❌ API Error ${status} (${latency}ms): ${vanity} - ${data.message || 'unknown'}`);
    logClaim(vanity, false, latency, `API_ERROR_${status}`);
    
    await sendWebhook('failed', vanity, `API error occurred (${status})`, {
      latency,
      error: `${status} ${data.message || 'Unknown'}`,
    });
    
    markProcessed(vanity);
    return false;
  } catch (err) {
    const latency = Math.round(Number(process.hrtime.bigint() - startTime) / 1000000);
    updateLatencyStats(latency);
    stats.failed++;

    let errorType = 'Unknown Error';
    let retryable = true;

    if (err.code === 'ECONNREFUSED') {
      logger.warn(`⏱️ Connection refused (${latency}ms): ${vanity}`);
      errorType = 'Connection Refused';
    } else if (err.code === 'ETIMEDOUT') {
      logger.warn(`⏱️ Request timeout (${latency}ms): ${vanity}`);
      errorType = 'Request Timeout';
    } else if (err.code === 'ENOTFOUND') {
      logger.warn(`⏱️ DNS error (${latency}ms): ${vanity}`);
      errorType = 'DNS Error';
    } else if (err.code === 'ERR_HTTP2_STREAM_DESTROYED' || err.code === 'ERR_TLS_ALERT') {
      logger.warn(`⚠️ Connection reset (${latency}ms): ${vanity}`);
      errorType = 'Connection Reset';
    } else {
      logger.error(`❌ Claim error (${latency}ms): ${vanity} - ${err.message}`);
      errorType = err.message;
      retryable = false;
    }

    logClaim(vanity, false, latency, 'CLIENT_ERROR');
    
    await sendWebhook('delayed', vanity, `Connection error occurred. Will retry.`, {
      latency,
      error: errorType,
    });

    if (retryable) {
      recordFailure(vanity);
      return null;
    } else {
      markProcessed(vanity);
      return false;
    }
  }
}

function startWorker() {
  if (isRunning) return;
  isRunning = true;

  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '2');
  const hasToken = !!process.env.DISCORD_USER_TOKEN;

  logger.info(`🔄 Worker Pool Config:`);
  logger.info(`   Concurrency: ${concurrency}`);
  logger.info(`   Requests/sec: ${parseInt(process.env.REQUESTS_PER_SECOND || '2')}`);
  logger.info(`   User Token: ${hasToken ? '✅ Set' : '❌ MISSING'}`);
  logger.info(`   Guild ID: ${process.env.DISCORD_GUILD_ID || '❌ MISSING'}`);
  logger.info(`   Webhook: ${process.env.WEBHOOK_URL ? '✅ Set' : '⏭️ Disabled'}`);

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
        logger.warn(`⏱️ Task timeout for ${item.vanity}`);
        recordFailure(item.vanity);
      } else {
        logger.error('Queue error:', err.message);
      }
    });
  }, 250);

  setInterval(() => {
    const rateLimitStatus = rateLimiter.getStatus();
    const rlInfo = rateLimitStatus.rateLimited
      ? `⏱️ THROTTLED (reset in ${Math.ceil(rateLimitStatus.resetIn / 1000)}s)`
      : '✅ OK';

    logger.info(
      `📊 Worker Stats: Avg ${stats.avgLatency}ms | P95 ${stats.p95Latency}ms | P99 ${stats.p99Latency}ms | ` +
      `Success ${stats.successful} | Failed ${stats.failed} | RateLimited ${stats.rateLimited} | ` +
      `Status: ${rlInfo}`
    );
  }, 30000);
}

async function stopWorker() {
  isRunning = false;
  logger.info('⏹️ Draining worker queue...');
  await queue.onIdle();
  logger.info(
    `✅ Worker stopped - Processed ${stats.processed} items | Avg Latency: ${stats.avgLatency}ms`
  );
}

module.exports = { startWorker, stopWorker, claimVanity };
