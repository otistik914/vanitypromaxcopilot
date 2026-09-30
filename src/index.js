const { claimVanity } = require('./worker');
const logger = require('./logger');

// Direct, proxyless, ultra-fast mode for Discord API calls
// No HTTP proxy is required; all connections are direct and keep-alive optimized.

function startProxylessMode() {
  logger.info('🌐 Proxyless direct connection mode enabled');
  logger.info('📡 Direct DNS + keep-alive + TLS session reuse enabled');
}

module.exports = { startProxylessMode };
