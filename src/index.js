#!/usr/bin/env node
require('dotenv').config();
const path = require('path');
const cluster = require('cluster');
const os = require('os');

const { initDB } = require('./db');
const { startServer } = require('./server');
const { startWorker } = require('./worker');
const { startPoller } = require('./poller');
const logger = require('./logger');

const numCPUs = os.cpus().length;

async function main() {
  logger.info('🚀 Discord Vanity Sniper Pro v2.0 (Webhook-Driven)');
  logger.info(`Node: ${process.version}, ENV: ${process.env.NODE_ENV}`);

  // Initialize database
  try {
    initDB();
    logger.info('✅ Database initialized');
  } catch (err) {
    logger.error('Database init failed:', err.message);
    process.exit(1);
  }

  // Validate critical env vars
  if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_GUILD_ID || !process.env.WEBHOOK_SECRET) {
    logger.error('❌ Missing required env vars: DISCORD_TOKEN, DISCORD_GUILD_ID, WEBHOOK_SECRET');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production' && cluster.isMaster) {
    logger.info(`🔄 Master process starting ${numCPUs} worker processes...`);

    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      logger.warn(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
      cluster.fork();
    });
  } else {
    // Start webhook server
    await startServer();
    logger.info(`✅ Webhook server listening on port ${process.env.PORT || 3001}`);

    // Start claim worker
    startWorker();
    logger.info('✅ Claim worker started');

    // Start vanity poller
    startPoller();
    logger.info('✅ Vanity poller started');
  }
}

main().catch((err) => {
  logger.error('Fatal error:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});
