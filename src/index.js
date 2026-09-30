#!/usr/bin/env node
/**
 * Advanced Discord Vanity Sniper Pro v2.0 - Final Edition
 * 
 * Features:
 * - HTTP/2 connection pooling for sub-100ms latency
 * - Advanced metrics collection
 * - Graceful shutdown with queue draining
 * - Process monitoring and auto-recovery
 * - Advanced error tracking
 */

require('dotenv').config();
const path = require('path');
const cluster = require('cluster');
const os = require('os');
const http2 = require('http2');

const { initDB, closeDB, getStats } = require('./db');
const { startServer, stopServer } = require('./server');
const { startWorker, stopWorker } = require('./worker');
const { startPoller } = require('./poller');
const logger = require('./logger');

const numCPUs = process.env.NODE_ENV === 'production' ? os.cpus().length : 1;
let isShuttingDown = false;

async function main() {
  logger.info('🚀 Discord Vanity Sniper Pro v2.0 (Final Edition)');
  logger.info(`📊 Node: ${process.version}, ENV: ${process.env.NODE_ENV}`);
  logger.info(`💻 CPUs: ${numCPUs}, Workers: ${process.env.WORKER_CONCURRENCY || 4}`);

  // Validate critical env vars
  const requiredEnvVars = ['DISCORD_TOKEN', 'DISCORD_GUILD_ID', 'WEBHOOK_SECRET'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    logger.error(`❌ Missing env vars: ${missingVars.join(', ')}`);
    process.exit(1);
  }

  // Initialize database
  try {
    initDB();
    logger.info('✅ Database initialized (SQLite WAL mode)');
  } catch (err) {
    logger.error('Database init failed:', err.message);
    process.exit(1);
  }

  // Cluster mode for production
  if (process.env.NODE_ENV === 'production' && cluster.isMaster) {
    logger.info(`🔄 Starting ${numCPUs} worker processes...`);

    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      if (!isShuttingDown) {
        logger.warn(`⚠️  Worker ${worker.process.pid} died (${signal || code}). Respawning...`);
        cluster.fork();
      }
    });

    // Master process metrics
    setInterval(() => {
      const stats = getStats();
      if (stats) {
        logger.debug('📊 24h Stats:', {
          claims: stats.claims.total,
          claimed: stats.claims.successful,
          avgClaimLatency: Math.round(stats.claims.avgLatency || 0),
          polls: stats.polls.total,
          avgPollLatency: Math.round(stats.polls.avgLatency || 0),
        });
      }
    }, 60000); // Every minute
  } else {
    // Worker process
    await startServer();
    logger.info(`✅ Webhook server listening on port ${process.env.PORT || 3001}`);

    startWorker();
    logger.info('✅ Claim worker started (HTTP/2 optimized)');

    startPoller();
    logger.info('✅ Vanity poller started (smart change detection)');
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`⏹️  ${signal} received, shutting down gracefully...`);

  try {
    // Stop accepting new requests
    await stopServer();
    logger.info('✅ Server stopped');

    // Drain queue
    await stopWorker();
    logger.info('✅ Worker queue drained');

    // Close database
    closeDB();
    logger.info('✅ Database closed');

    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown:', err.message);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('❌ Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection:', reason);
});

main().catch((err) => {
  logger.error('Fatal error:', err);
  process.exit(1);
});
