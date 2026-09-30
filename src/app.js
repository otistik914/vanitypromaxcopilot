import { createLogger } from './logger.js';
import { loadConfig } from './config.js';
import { Http2Client } from './claim/httpClient.js';
import { MFAManager } from './claim/mfaManager.js';
import { AggressiveClaimEngine } from './claim/aggressiveEngine.js';
import { GatewayMonitor } from './monitor/gatewayOptimized.js';
import { Database2 } from './monitor/database.js';
import { sendWebhook } from './notifications/discordWebhook.js';
import { buildSuccessEmbed, buildGraceEmbed } from './notifications/embeds.js';
import { wait } from './utils/retry.js';

export async function startApp() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  logger.info('═════════════════════════════════════════════════════════');
  logger.info('🚀 Discord Vanity Sniper Pro - AGGRESSIVE MODE');
  logger.info('═════════════════════════════════════════════════════════');
  logger.info({ targetGuild: config.targetGuildId }, 'Initializing...');

  // Initialize components
  const httpClient = new Http2Client({ logger });
  const database = new Database2(config.graceDbPath, logger);
  const mfaManager = new MFAManager({ logger });
  const claimEngine = new AggressiveClaimEngine({
    httpClient,
    mfaManager,
    config,
    database,
    logger
  });

  logger.info('✅ Components initialized');

  // Pre-refresh MFA
  logger.info('🔐 Initializing MFA token...');
  const mfaReady = await mfaManager.refresh({
    httpClient,
    discordToken: config.discordToken,
    password: config.discordPassword,
    guildId: config.targetGuildId,
    logger
  });

  if (!mfaReady) {
    throw new Error('❌ Failed to acquire MFA token');
  }

  logger.info('✅ MFA token acquired');

  // Auto-refresh MFA every 4 minutes
  mfaManager.startAutoRefresh({
    httpClient,
    discordToken: config.discordToken,
    password: config.discordPassword,
    guildId: config.targetGuildId,
    logger
  });

  // Start aggressive claim processing (50ms cycle)
  claimEngine.startProcessing();

  // Monitor grace periods (every 500ms, aggressive check)
  const graceInterval = setInterval(() => {
    const expired = database.getExpiredGrace();

    for (const { vanity, attempts } of expired) {
      if (attempts >= 3) {
        database.deleteGrace(vanity);
        logger.debug({ vanity }, 'Grace period removed (max attempts)');
        continue;
      }

      // Enqueue with HIGHEST priority for grace claims
      claimEngine.enqueue(vanity, 1000);
      database.incrementGraceAttempts(vanity);
      logger.debug({ vanity, graceAttempt: attempts + 1 }, 'Grace period claim queued');
    }
  }, 500);

  logger.info('✅ Grace monitor started (500ms cycle)');

  // Connect gateway
  const gatewayMonitor = new GatewayMonitor({ token: config.monitorToken, config, logger });
  await gatewayMonitor.connect({
    onVanityChange: async (vanity, timestamp) => {
      logger.info({ vanity }, '⚡ VANITY DETECTED - QUEUED');

      // Queue with high priority
      claimEngine.enqueue(vanity, 500);

      // Store grace period
      const releaseAt = Date.now() + (config.graceDays * 24 * 60 * 60 * 1000);
      database.setGrace(vanity, releaseAt);

      // Send webhook
      if (config.webhookUrl) {
        sendWebhook({
          url: config.webhookUrl,
          username: config.webhookUsername,
          embed: buildGraceEmbed({
            vanity,
            guildId: config.targetGuildId,
            releaseAt
          })
        }).catch((error) => logger.warn({ error: error.message }, 'Webhook failed'));
      }
    }
  });

  logger.info('✅ Gateway connected');
  logger.info('═════════════════════════════════════════════════════════');
  logger.info('🟢 SNIPER READY - AGGRESSIVE MODE ACTIVE');
  logger.info('═════════════════════════════════════════════════════════');

  // Stats reporter (every 10 seconds)
  setInterval(() => {
    const stats = claimEngine.getStats();
    logger.info(
      {
        processed: stats.processed,
        successful: stats.successful,
        failed: stats.failed,
        avgLatency: Math.round(stats.avgLatency),
        queuePending: stats.queue?.pending ?? 0,
        graceTotal: stats.grace?.total ?? 0
      },
      '📊 SNIPER STATS'
    );
  }, 10000);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('═════════════════════════════════════════════════════════');
    logger.info('🛑 Shutting down...');
    logger.info('═════════════════════════════════════════════════════════');

    claimEngine.stopProcessing();
    clearInterval(graceInterval);
    gatewayMonitor.close();
    mfaManager.stopAutoRefresh();
    httpClient.close();
    database.cleanup();

    logger.info('✅ Cleanup complete');
    process.exit(0);
  });

  return { config, logger, database, claimEngine, gatewayMonitor };
}
