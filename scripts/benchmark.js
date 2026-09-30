#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { hrtime } = require('process');

const logger = {
  info: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  success: (msg) => console.log(`🎉 ${msg}`),
};

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-secret-12345678901234567890';

function createSignature(body) {
  const crypto = require('crypto');
  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
}

async function testHealth() {
  logger.info('Testing health endpoint...');
  try {
    const response = await axios.get(`${SERVER_URL}/health`);
    logger.success(`Health: ${response.data.status}`);
    return true;
  } catch (err) {
    logger.error(`Health check failed: ${err.message}`);
    return false;
  }
}

async function testWebhook() {
  logger.info('Testing webhook endpoint...');
  const vanity = 'benchmark-test';
  const payload = {
    vanity,
    eventId: `test-${Date.now()}`,
  };
  const body = JSON.stringify(payload);
  const signature = createSignature(body);

  try {
    const start = hrtime.bigint();
    const response = await axios.post(`${SERVER_URL}/webhooks/vanity`, payload, {
      headers: {
        'X-Signature': signature,
        'Content-Type': 'application/json',
      },
    });
    const latency = Number(hrtime.bigint() - start) / 1000000;

    if (response.status === 202) {
      logger.success(`Webhook accepted in ${latency.toFixed(2)}ms`);
      return true;
    } else {
      logger.error(`Unexpected status: ${response.status}`);
      return false;
    }
  } catch (err) {
    logger.error(`Webhook test failed: ${err.message}`);
    return false;
  }
}

async function testStats() {
  logger.info('Testing stats endpoint...');
  try {
    const response = await axios.get(`${SERVER_URL}/stats`);
    const stats = response.data;
    logger.success(`Stats retrieved:`);
    console.log(`  Queue size: ${stats.queue.queueSize}`);
    console.log(`  Memory: ${stats.process.memory}MB`);
    console.log(`  Uptime: ${stats.process.uptime}s`);
    return true;
  } catch (err) {
    logger.error(`Stats test failed: ${err.message}`);
    return false;
  }
}

async function benchmarkClaims(count = 10) {
  logger.info(`Benchmarking ${count} webhook calls...`);
  const latencies = [];

  for (let i = 0; i < count; i++) {
    const vanity = `bench-${i}-${Date.now()}`;
    const payload = {
      vanity,
      eventId: `benchmark-${i}`,
    };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    try {
      const start = hrtime.bigint();
      await axios.post(`${SERVER_URL}/webhooks/vanity`, payload, {
        headers: {
          'X-Signature': signature,
        },
      });
      const latency = Number(hrtime.bigint() - start) / 1000000;
      latencies.push(latency);
    } catch (err) {
      logger.warn(`Request ${i} failed: ${err.message}`);
    }
  }

  if (latencies.length > 0) {
    const avg = latencies.reduce((a, b) => a + b) / latencies.length;
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    const sorted = latencies.sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    logger.success(`Benchmark complete:`);
    console.log(`  Requests: ${latencies.length}/${count}`);
    console.log(`  Avg latency: ${avg.toFixed(2)}ms`);
    console.log(`  Min latency: ${min.toFixed(2)}ms`);
    console.log(`  Max latency: ${max.toFixed(2)}ms`);
    console.log(`  P95 latency: ${p95.toFixed(2)}ms`);
    console.log(`  P99 latency: ${p99.toFixed(2)}ms`);
    return true;
  } else {
    logger.error('All benchmark requests failed');
    return false;
  }
}

async function main() {
  console.log('🚀 Discord Vanity Sniper Pro - Benchmark Suite');
  console.log(`Server: ${SERVER_URL}`);
  console.log('');

  let passed = 0;
  let failed = 0;

  if (await testHealth()) passed++;
  else failed++;

  console.log('');

  if (await testWebhook()) passed++;
  else failed++;

  console.log('');

  if (await testStats()) passed++;
  else failed++;

  console.log('');

  if (await benchmarkClaims(10)) passed++;
  else failed++;

  console.log('');
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    logger.success('All tests passed!');
    process.exit(0);
  } else {
    logger.error('Some tests failed!');
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error(`Benchmark error: ${err.message}`);
  process.exit(1);
});
