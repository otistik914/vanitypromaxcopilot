const PQueue = require('p-queue').default;
const axios = require('axios');
const { takeNext, markProcessed, recordFailure } = require('./queue');
const { logClaim, isClaimSuccess } = require('./db');
const logger = require('./logger');

const queue = new PQueue({
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '4'),
  interval: 1000,
  intervalCap: 50, // Max 50 requests per second (Discord rate limit safe)
});

let isRunning = false;

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
        },
        timeout: 5000,
      }
    );

    const latency = Date.now() - startTime;

    if (response.status === 200) {
      logClaim(vanity, true, latency, response.data.code);
      logger.info(`✅ Claim SUCCESS in ${latency}ms: ${vanity}`);
      markProcessed(vanity);
      return true;
    }
  } catch (err) {
    const latency = Date.now() - startTime;

    if (err.response) {
      const status = err.response.status;
      const data = err.response.data || {};

      if (status === 409) {
        logger.warn(`⚠️  Vanity taken (409) in ${latency}ms: ${vanity}`);
        logClaim(vanity, false, latency, 'TAKEN_BY_OTHER');
        markProcessed(vanity);
        return false;
      } else if (status === 400 && data.code === 50013) {
        logger.error(`❌ Missing permissions (50013) in ${latency}ms: ${vanity}`);
        logClaim(vanity, false, latency, 'MISSING_PERMS');
        markProcessed(vanity);
        return false;
      } else if (status === 429) {
        logger.warn(`⏱️  Rate limited (429) in ${latency}ms: ${vanity}`);
        recordFailure(vanity);
        return null; // Retry later
      } else if (status === 500 || status === 502 || status === 503) {
        logger.warn(`⚠️  Discord server error (${status}) in ${latency}ms: ${vanity}`);
        recordFailure(vanity);
        return null; // Retry later
      }

      logger.error(`❌ API error (${status}) in ${latency}ms: ${vanity}`, data.message);
      logClaim(vanity, false, latency, `API_ERROR_${status}`);
      markProcessed(vanity);
      return false;
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      logger.warn(`⏱️  Connection timeout in ${latency}ms: ${vanity}`);
      recordFailure(vanity);
      return null; // Retry later
    }

    logger.error(`❌ Claim error in ${latency}ms: ${vanity}`, err.message);
    logClaim(vanity, false, latency, 'CLIENT_ERROR');
    markProcessed(vanity);
    return false;
  }
}

function startWorker() {
  if (isRunning) return;
  isRunning = true;

  setInterval(async () => {
    const item = takeNext();
    if (!item) return;

    queue.add(async () => {
      try {
        await claimVanity(item.vanity);
      } catch (err) {
        logger.error('Worker exception:', err.message);
      }
    });
  }, parseInt(process.env.CLAIM_INTERVAL_MS || '5000') / 10); // Check often, but respect interval
}

function stopWorker() {
  isRunning = false;
  return queue.onIdle();
}

module.exports = { startWorker, stopWorker, claimVanity };
