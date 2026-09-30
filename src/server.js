const express = require('express');
const crypto = require('crypto');
const { enqueueVanity } = require('./queue');
const logger = require('./logger');

const app = express();
let server = null;

// Custom middleware to capture raw body for signature verification
app.use(express.json({ verify: verifySignature }));

function verifySignature(req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Webhook endpoint - receives vanity events
app.post('/webhooks/vanity', (req, res) => {
  const signature = req.headers['x-signature'];

  if (!signature) {
    logger.warn('⚠️  Webhook rejected: missing signature');
    return res.status(401).json({ error: 'missing signature' });
  }

  const rawBody = req.rawBody || JSON.stringify(req.body);
  const expected = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (!crypto.timingSafeEqual(signature, expected)) {
    logger.warn('⚠️  Webhook rejected: invalid signature');
    return res.status(401).json({ error: 'invalid signature' });
  }

  try {
    const { vanity, eventId } = req.body;

    if (!vanity || typeof vanity !== 'string' || vanity.length === 0) {
      logger.warn('⚠️  Webhook rejected: invalid vanity format');
      return res.status(400).json({ error: 'invalid vanity' });
    }

    if (vanity.length > 100 || !/^[a-z0-9-]+$/i.test(vanity)) {
      logger.warn(`⚠️  Webhook rejected: vanity doesn't match Discord format: ${vanity}`);
      return res.status(400).json({ error: 'vanity format invalid' });
    }

    const queued = enqueueVanity(vanity, eventId || crypto.randomUUID());

    if (queued) {
      logger.info(`📝 Vanity queued: ${vanity}`);
      return res.status(202).json({ ok: true, queued: true });
    } else {
      logger.debug(`⏭️  Vanity already queued (dedupe): ${vanity}`);
      return res.status(202).json({ ok: true, queued: false, reason: 'dedupe' });
    }
  } catch (err) {
    logger.error('Webhook error:', err.message);
    return res.status(400).json({ error: 'bad request' });
  }
});

// Queue stats endpoint
app.get('/stats', (req, res) => {
  const { getQueueStats } = require('./queue');
  const stats = getQueueStats();
  res.json(stats);
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Server error:', err.message);
  res.status(500).json({ error: 'internal server error' });
});

async function startServer() {
  return new Promise((resolve, reject) => {
    server = app.listen(process.env.PORT || 3001, () => {
      resolve();
    });
    server.on('error', reject);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(resolve);
    } else {
      resolve();
    }
  });
}

module.exports = { app, startServer, stopServer };
