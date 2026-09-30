const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const { enqueueVanity } = require('./queue');
const { logPoll } = require('./db');
const logger = require('./logger');

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 5,
  timeout: 6000,
});

let lastVanity = null;
let pollCount = 0;
let lastErrorTime = 0;
let errorStreak = 0;
const maxConsecutiveErrors = 3;

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
          'Accept-Encoding': 'gzip',
        },
        timeout: 5000,
        httpAgent: httpsAgent,
        httpsAgent: httpsAgent,
      }
    );

    const latency = Date.now() - startTime;
    const currentVanity = response.data?.code?.toLowerCase();

    if (currentVanity && currentVanity !== lastVanity) {
      logger.info(`🎯 Vanity CHANGED in ${latency}ms: ${lastVanity || 'none'} → ${currentVanity}`);
      enqueueVanity(currentVanity, `poll-${Date.now()}`);
      logPoll(currentVanity, true, latency);
      lastVanity = currentVanity;
      errorStreak = 0; // Reset on success
    } else if (pollCount % 120 === 0) {
      // Log every 120 polls (~16 min at 8s interval)
      logger.debug(`📊 Poll check #${pollCount}: no change, latency ${latency}ms`);
    }
  } catch (err) {
    const latency = Date.now() - startTime;
    const now = Date.now();

    // Reset error counter if last error was >5 min ago
    if (now - lastErrorTime > 300000) {
      errorStreak = 0;
    }

    lastErrorTime = now;
    errorStreak++;

    if (errorStreak <= maxConsecutiveErrors) {
      let errorMsg = `⚠️  Poll error (${latency}ms):`;

      if (err.response) {
        const status = err.response.status;
        const data = err.response.data || {};
        errorMsg += ` HTTP ${status}`;
        if (data.message) errorMsg += ` - ${data.message}`;
        logPoll(null, false, latency, `HTTP_${status}`);
      } else if (err.code) {
        errorMsg += ` ${err.code}`;
        logPoll(null, false, latency, err.code);
      } else {
        errorMsg += ` ${err.message}`;
        logPoll(null, false, latency, 'UNKNOWN');
      }

      logger.warn(errorMsg);
    } else if (errorStreak === maxConsecutiveErrors + 1) {
      logger.warn(`⚠️  Polling errors persisting (${errorStreak}+ errors), suppressing detailed logs`);
    } else if (errorStreak % 60 === 0) {
      logger.warn(`⚠️  Polling still experiencing errors (${errorStreak} consecutive, last: ${(now - lastErrorTime) / 1000 | 0}s ago)`);
    }
  }
}

function startPoller() {
  const interval = parseInt(process.env.POLL_INTERVAL_MS || '8000');
  logger.info(`🔍 Poller started with ${interval}ms interval`);

  // Poll immediately
  pollGuildVanity();

  // Then poll at regular intervals
  setInterval(() => {
    pollGuildVanity();
  }, interval);
}

module.exports = { startPoller };
