#!/usr/bin/env node
/**
 * Discord Vanity Sniper Pro v2.0 - User Token Edition
 * Claims vanity URLs using user account token
 */

require('dotenv').config();
const path = require('path');
const cluster = require('cluster');
const os = require('os');

const { initDB, closeDB } = require('./db');
const { startServer, stopServer } = require('./server');
const { startWorker, stopWorker } = require('./worker');
const { startPoller } = require('./poller');
const logger = require('./logger');

let isShuttingDown = false;

function validateConfig() {
  const required = ['DISCORD_USER_TOKEN', 'DISCORD_GUILD_ID', 'WEBHOOK_SECRET'];
  const missing = required.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    logger.error(`Missing env vars: ${missing.join(', ')}`);
    logger.error('Copy .env.example to .env and fill in your credentials');
    logger.error('');
    logger.error('Required:');
    logger.error('  DISCORD_USER_TOKEN - Your Discord user token (from DevTools)');
    logger.error('  DISCORD_GUILD_ID - Target server ID (where to claim vanities)');
    logger.error('  WEBHOOK_SECRET - Random string, min 32 characters');
    process.exit(1);
  }

  if (process.env.WEBHOOK_SECRET.length < 32) {
    logger.error('WEBHOOK_SECRET must be at least 32 characters');
    process.exit(1);
  }
}

async function main() {
  validateConfig();

  logger.info('🚀 Discord Vanity Sniper Pro v2.0 (User Token Edition)');
  logger.info(`🔧 Mode: ${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}`);
  logger.info(`👤 Auth: User Token`);
  logger.info('');

  try {
    initDB();
    logger.info('✅ Database initialized');
  } catch (err) {
    logger.error('Database init failed:', err.message);
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production' && cluster.isMaster) {
    const cpuCount = os.cpus().length;
    logger.info(`🔄 Cluster mode: spawning ${cpuCount} workers`);
    logger.info('');

    for (let i = 0; i < cpuCount; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      if (!isShuttingDown) {
        logger.warn(`Worker ${worker.process.pid} died (${signal || code}). Respawning...`);
        cluster.fork();
      }
    });
  } else {
    await startServer();
    logger.info(`✅ Server listening on port ${process.env.PORT || 3001}`);

    startWorker();
    logger.info('✅ Worker pool started');

    startPoller();
    logger.info('✅ Vanity poller started');

    logger.info('');
    logger.info('📊 Monitor with:');
    logger.info(`   curl http://localhost:${process.env.PORT || 3001}/health`);
    logger.info(`   curl http://localhost:${process.env.PORT || 3001}/stats`);
  }
}

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`\n⏹️  ${signal} received - graceful shutdown starting...`);

  try {
    await stopServer();
    logger.info('✅ Server stopped');

    await stopWorker();
    logger.info('✅ Worker queue drained');

    closeDB();
    logger.info('✅ Database closed');

    logger.info('✅ Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Shutdown error:', err.message);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('💥 Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason) => {
  logger.error('💥 Unhandled Rejection:', reason);
});

main().catch((err) => {
  logger.error('Fatal error:', err);
  process.exit(1);
});
