#!/usr/bin/env node
require('dotenv').config();
const os = require('os');
const cluster = require('cluster');
const { initDB } = require('./db');
const { startServer } = require('./server');
const { startWorker } = require('./worker');
const { startPoller } = require('./poller');
const { startProxylessMode } = require('./proxyless');
const logger = require('./logger');

function main() {
  logger.info('🚀 Discord Vanity Sniper Pro v2.0 (Proxyless Ultra-Fast Mode)');

  if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_GUILD_ID || !process.env.WEBHOOK_SECRET) {
    logger.error('❌ Missing required env vars: DISCORD_TOKEN, DISCORD_GUILD_ID, WEBHOOK_SECRET');
    process.exit(1);
  }

  initDB();
  startProxylessMode();

  if (process.env.NODE_ENV === 'production' && cluster.isMaster) {
    const cpuCount = os.cpus().length;
    logger.info(`🔄 Starting ${cpuCount} workers in production mode`);

    for (let i = 0; i < cpuCount; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      logger.warn(`Worker ${worker.process.pid} died (${signal || code}), restarting...`);
      cluster.fork();
    });
  } else {
    startServer();
    startWorker();
    startPoller();
  }
}

main();
