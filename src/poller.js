const axios = require('axios');
const crypto = require('crypto');
const { enqueueVanity } = require('./queue');
const { logPoll } = require('./db');
const logger = require('./logger');

let lastVanity = null;
let pollCount = 0;
let lastErrorTime = 0;
let consoleErrorsRemaining = 3; // Only log first 3 consecutive errors

async function pollGuildVanity() {
  const startTime = Date.now();
  pollCount++;

  try {
    const response = await axios.get(
      `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/vanity-url`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
          'User-Agent': 'DiscordVanitySniperPro/2.0',
        },
        timeout: 5000,
      }
    );

    const latency = Date.now() - startTime;
    const currentVanity = response.data?.code?.toLowerCase();

    if (currentVanity && currentVanity !== lastVanity) {
      logger.info(`🎯 Vanity change detected in ${latency}ms: ${lastVanity} → ${currentVanity}`);
      enqueueVanity(currentVanity, `poll-${Date.now()}`);
      logPoll(currentVanity, true, latency);
      lastVanity = currentVanity;
      consoleErrorsRemaining = 3; // Reset error counter on success
    } else if (pollCount % 60 === 0) {
      // Log every 60 polls (every ~8 minutes at 8s interval)
      logger.debug(`⏸️  No change in ${latency}ms (poll #${pollCount})`);
    }
  } catch (err) {
    const latency = Date.now() - startTime;
    const now = Date.now();

    // Only log first few consecutive errors
    if (now - lastErrorTime > 60000) {
      consoleErrorsRemaining = 3; // Reset counter if last error was >1 min ago
    }

    lastErrorTime = now;

    if (consoleErrorsRemaining > 0) {
      let errorMsg = `⚠️  Poll error (${latency}ms):`;

      if (err.response) {
        const status = err.response.status;
        const data = err.response.data || {};
        errorMsg += ` HTTP ${status} - ${data.message || 'unknown'}`;
        logPoll(null, false, latency, `HTTP_${status}`);
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        errorMsg += ` Network error: ${err.code}`;
        logPoll(null, false, latency, err.code);
      } else {
        errorMsg += ` ${err.message}`;
        logPoll(null, false, latency, 'CLIENT_ERROR');
      }

      logger.warn(errorMsg);
      consoleErrorsRemaining--;
    } else if (pollCount % 60 === 0) {
      // Log summary every 60 failed polls
      logger.warn(`⚠️  Polling still experiencing errors (60+ consecutive, suppressing logs)`);
    }
  }
}

function startPoller() {
  const interval = parseInt(process.env.POLL_INTERVAL_MS || '8000');
  logger.info(`🔍 Poller starting with interval: ${interval}ms`);

  // Poll immediately on startup
  pollGuildVanity();

  // Then poll at regular intervals
  setInterval(() => {
    pollGuildVanity();
  }, interval);
}

module.exports = { startPoller };
