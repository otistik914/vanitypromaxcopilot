const axios = require('axios');
const { enqueueVanity } = require('./queue');
const { logPoll } = require('./db');
const logger = require('./logger');

let lastVanity = null;
let pollCount = 0;
let lastErrorTime = 0;
let consoleErrorsRemaining = 3;
let isPolling = false;

const pollerClient = axios.create({
  timeout: 8000,
  maxRedirects: 0,
  validateStatus: () => true,
});

async function pollGuildVanity() {
  if (isPolling) {
    logger.debug('⏩ Poll already in progress, skipping...');
    return false;
  }

  isPolling = true;
  const guildId = process.env.DISCORD_GUILD_ID;
  const token = process.env.DISCORD_TOKEN;

  if (!guildId || !token) {
    logger.error('❌ DISCORD_GUILD_ID or DISCORD_TOKEN not set');
    isPolling = false;
    return false;
  }

  const startTime = Date.now();
  pollCount++;

  try {
    const response = await pollerClient.get(
      `https://discord.com/api/v10/guilds/${guildId}/vanity-url`,
      {
        headers: {
          Authorization: `Bot ${token}`,
          'User-Agent': 'DiscordVanitySniperPro/2.0',
          'Content-Type': 'application/json',
        },
      }
    );

    const latency = Date.now() - startTime;
    const status = response.status;
    const data = response.data || {};

    if (status === 401) {
      logger.error(`❌ POLL: Unauthorized (401) - Invalid or expired DISCORD_TOKEN`);
      logPoll(null, false, latency, 'AUTH_FAILED_401');
      isPolling = false;
      return false;
    }

    if (status === 403) {
      logger.error(`❌ POLL: Forbidden (403) - Bot lacks permissions on guild ${guildId}`);
      logPoll(null, false, latency, 'FORBIDDEN_403');
      isPolling = false;
      return false;
    }

    if (status === 404) {
      logger.error(`❌ POLL: Not Found (404) - Invalid DISCORD_GUILD_ID: ${guildId}`);
      logPoll(null, false, latency, 'GUILD_NOT_FOUND_404');
      isPolling = false;
      return false;
    }

    if (status >= 500) {
      logger.warn(`⚠️ POLL: Discord server error (${status}) in ${latency}ms`);
      logPoll(null, false, latency, `SERVER_ERROR_${status}`);
      isPolling = false;
      return false;
    }

    if (status !== 200) {
      logger.warn(`⚠️ POLL: Unexpected status ${status} in ${latency}ms - ${data.message || 'unknown'}`);
      logPoll(null, false, latency, `HTTP_${status}`);
      isPolling = false;
      return false;
    }

    // Success: status 200
    const currentVanity = data.code ? data.code.trim().toLowerCase() : null;

    if (!currentVanity) {
      logger.debug(`⏸️ No vanity is currently set for guild ${guildId}`);
      if (lastVanity !== null) {
        logger.warn(`🔄 Vanity was cleared: ${lastVanity} → (none)`);
        lastVanity = null;
      }
      isPolling = false;
      return true;
    }

    if (lastVanity === null) {
      logger.info(`🎯 Initial vanity for guild ${guildId}: ${currentVanity}`);
      lastVanity = currentVanity;
      logPoll(currentVanity, true, latency);
      consoleErrorsRemaining = 3;
      isPolling = false;
      return true;
    }

    if (currentVanity !== lastVanity) {
      logger.info(`🎯 Vanity CHANGED in ${latency}ms: ${lastVanity} → ${currentVanity}`);
      enqueueVanity(currentVanity, `poll-${Date.now()}`);
      logPoll(currentVanity, true, latency);
      lastVanity = currentVanity;
      consoleErrorsRemaining = 3;
      isPolling = false;
      return true;
    }

    if (pollCount % 120 === 0) {
      logger.debug(`✓ Poll OK in ${latency}ms (poll #${pollCount}) - Vanity: ${currentVanity}`);
    }

    logPoll(currentVanity, true, latency);
    isPolling = false;
    return true;
  } catch (err) {
    const latency = Date.now() - startTime;
    const now = Date.now();

    if (now - lastErrorTime > 60000) {
      consoleErrorsRemaining = 3;
    }

    lastErrorTime = now;

    if (consoleErrorsRemaining > 0) {
      let errorMsg = `⚠️ POLL ERROR (${latency}ms):`;

      if (err.response) {
        const s = err.response.status;
        const d = err.response.data || {};
        errorMsg += ` HTTP ${s} - ${d.message || 'unknown'}`;
        logPoll(null, false, latency, `HTTP_${s}`);
      } else if (err.code === 'ECONNREFUSED') {
        errorMsg += ` Connection refused - Discord API unreachable`;
        logPoll(null, false, latency, 'CONN_REFUSED');
      } else if (err.code === 'ETIMEDOUT') {
        errorMsg += ` Request timeout (${err.timeout}ms)`;
        logPoll(null, false, latency, 'TIMEOUT');
      } else if (err.code === 'ENOTFOUND') {
        errorMsg += ` DNS resolution failed for discord.com`;
        logPoll(null, false, latency, 'DNS_FAILED');
      } else {
        errorMsg += ` ${err.message}`;
        logPoll(null, false, latency, 'UNKNOWN_ERROR');
      }

      logger.warn(errorMsg);
      consoleErrorsRemaining--;
    } else if (pollCount % 60 === 0) {
      logger.warn(`⚠️ Polling errors continue (60+ suppressed)`);
    }

    isPolling = false;
    return false;
  }
}

function startPoller() {
  const interval = parseInt(process.env.POLL_INTERVAL_MS || '8000');
  const guildId = process.env.DISCORD_GUILD_ID;
  const hasToken = !!process.env.DISCORD_TOKEN;

  logger.info(`🔍 Vanity Poller Config:`);
  logger.info(`   Guild ID: ${guildId || '❌ MISSING'}`);
  logger.info(`   Token: ${hasToken ? '✅ Set' : '❌ MISSING'}`);
  logger.info(`   Interval: ${interval}ms`);

  if (!guildId || !hasToken) {
    logger.error('❌ Cannot start poller: DISCORD_GUILD_ID and DISCORD_TOKEN required');
    return;
  }

  pollGuildVanity();

  setInterval(() => {
    pollGuildVanity().catch((err) => {
      logger.error('Poller crashed:', err.message);
    });
  }, interval);
}

module.exports = { startPoller, pollGuildVanity };
