const express = require('express');
const crypto = require('crypto');
const { enqueueVanity, getQueueStats } = require('./queue');
const { getStats } = require('./db');
const logger = require('./logger');

const app = express();
let server = null;
let requestCount = 0;
const startTime = Date.now();

app.use(express.json({ verify: verifySignature, limit: '1mb' }));

function verifySignature(req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
}

app.use((req, res, next) => {
  requestCount++;
  res.on('finish', () => {
    const duration = Date.now() - req._startTime;
    if (duration > 100) {
      logger.debug(`⏱️  ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    }
  });
  req._startTime = Date.now();
  next();
});

const ipRequests = new Map();
app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const windowStart = now - 60000;

  if (!ipRequests.has(ip)) {
    ipRequests.set(ip, []);
  }

  const requests = ipRequests.get(ip).filter(t => t > windowStart);
  requests.push(now);
  ipRequests.set(ip, requests);

  if (requests.length > 2000) {
    logger.warn(`⚠️  Rate limit exceeded for ${ip} (${requests.length} req/min)`);
    return res.status(429).json({ error: 'too many requests' });
  }

  next();
});

app.get('/health', (req, res) => {
  const uptime = Math.round((Date.now() - startTime) / 1000);
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    requests: requestCount,
    env: process.env.NODE_ENV,
    pid: process.pid,
  });
});

app.get('/stats', (req, res) => {
  const queueStats = getQueueStats();
  const dbStats = getStats();
  const uptime = Math.round((Date.now() - startTime) / 1000);

  res.json({
    queue: queueStats,
    database: dbStats,
    process: {
      uptime,
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      pid: process.pid,
    },
    requests: requestCount,
  });
});

app.post('/webhooks/vanity', (req, res) => {
  const signature = req.headers['x-signature'];

  if (!signature) {
    logger.warn('⚠️  Webhook rejected: missing signature');
    return res.status(401).json({ error: 'missing signature', code: 'NO_SIGNATURE' });
  }

  const rawBody = req.rawBody || JSON.stringify(req.body);

  let expected;
  try {
    expected = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
  } catch (err) {
    logger.error('HMAC error:', err.message);
    return res.status(500).json({ error: 'internal error' });
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    logger.warn('⚠️  Webhook rejected: invalid signature');
    return res.status(401).json({ error: 'invalid signature', code: 'INVALID_SIGNATURE' });
  }

  try {
    const { vanity, eventId } = req.body;

    if (!vanity || typeof vanity !== 'string' || vanity.length === 0) {
      logger.warn('⚠️  Webhook rejected: invalid vanity format');
      return res.status(400).json({ error: 'invalid vanity', code: 'INVALID_FORMAT' });
    }

    if (vanity.length > 100 || !/^[a-z0-9-]+$/i.test(vanity)) {
      logger.warn(`⚠️  Webhook rejected: vanity format mismatch: ${vanity}`);
      return res.status(400).json({ error: 'vanity format invalid', code: 'FORMAT_MISMATCH' });
    }

    const queued = enqueueVanity(vanity, eventId || crypto.randomUUID());

    if (queued) {
      logger.info(`📝 Vanity queued: ${vanity}`);
      return res.status(202).json({
        ok: true,
        queued: true,
        vanity,
        eventId: eventId || 'generated',
      });
    } else {
      logger.debug(`↩️  Vanity deduplicated: ${vanity}`);
      return res.status(202).json({
        ok: true,
        queued: false,
        reason: 'dedupe',
        vanity,
      });
    }
  } catch (err) {
    logger.error('Webhook error:', err.message);
    return res.status(400).json({ error: 'bad request', code: 'BAD_REQUEST' });
  }
});

app.get('/stats/perf', (req, res) => {
  const { getWorkerStats } = require('./worker');
  const stats = getWorkerStats();
  res.json(stats);
});

app.get('/stats/detailed', (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'not available in production' });
  }

  const queueStats = getQueueStats();
  const dbStats = getStats();
  const memUsage = process.memoryUsage();

  res.json({
    queue: queueStats,
    database: dbStats,
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
    },
    uptime: Math.round((Date.now() - startTime) / 1000),
    pid: process.pid,
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'not found', code: 'NOT_FOUND' });
});

app.use((err, req, res, next) => {
  logger.error('Server error:', err.message);
  res.status(500).json({ error: 'internal server error', code: 'INTERNAL_ERROR' });
});

async function startServer() {
  return new Promise((resolve, reject) => {
    server = app.listen(process.env.PORT || 3001, () => {
      resolve();
    });
    server.on('error', reject);
    server.keepAliveTimeout = 65000;
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        resolve();
      });
      setTimeout(() => resolve(), 10000);
    } else {
      resolve();
    }
  });
}

module.exports = { app, startServer, stopServer };

