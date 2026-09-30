# Discord Vanity Sniper Pro v2.0 - Final Edition

**Ultra-fast, webhook-driven Discord vanity claiming system**

## 🚀 Features

- ⚡ **Sub-100ms Claim Latency**: Optimized HTTP/2 requests with connection pooling
- 🔐 **Secure Token Management**: Zero credentials in config, env-based only
- 🎯 **Smart Deduplication**: Prevents duplicate queue entries (60s window)
- 📊 **Webhook-Driven**: Hybrid polling + webhook architecture
- 🔄 **Auto-Retry with Backoff**: Intelligent failure handling (5 retries max)
- 📈 **Concurrency Control**: P-Queue with configurable worker pool
- 💾 **SQLite Logging**: WAL mode for fast async inserts
- 🛡️ **HMAC Signature Validation**: Webhook request authentication
- 📱 **Discord Notifications**: Real-time alerts via webhook embeds
- 📊 **Metrics & Stats**: Built-in `/stats` and `/health` endpoints
- 🌍 **Multi-instance Ready**: Cluster mode support for scaling
- 🔍 **Detailed Logging**: File-based logs with configurable levels
- ⚙️ **Production-Ready**: Error handling, graceful shutdown, rate limiting

## 🎯 Architecture

```
┌─────────────┐
│   Poller    │ (8s intervals)
│  discovers  │
│   vanity    │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Webhook Server     │ (HMAC validated)
│  /webhooks/vanity   │
└──────┬──────────────┘
       │
       ▼
┌──────────────────┐
│  Dedup Queue     │ (60s window)
│  Max 1000 items  │
└──────┬───────────┘
       │
       ▼
┌──────────────────────────────────┐
│  Worker Pool (P-Queue)           │
│  Concurrency: 4 (configurable)   │
│  Rate limit: 50 req/sec          │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────┐
│  Discord API (HTTP/2)    │
│  PATCH /vanity-url       │
│  Timeout: 5s             │
└──────────────────────────┘
       │
       ├─ Success ──► Log ──► Alert
       ├─ 409 (taken) ──► Mark processed
       ├─ 429 (rate limit) ──► Requeue
       └─ 50013 (perms) ──► Mark processed
```

## 📋 Quick Setup

### Windows
```bash
setup.bat
# Edit .env with your credentials
npm start
```

### Mac/Linux
```bash
chmod +x setup.sh
./setup.sh
# Edit .env with your credentials
npm start
```

## 🔧 Configuration

### Required Environment Variables
```env
DISCORD_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_server_id
WEBHOOK_SECRET=random_long_secret_min_32_chars
```

### Performance Tuning
```env
# Worker concurrency (4-8 recommended)
WORKER_CONCURRENCY=4

# Claim interval in ms (5000 = 5 seconds)
CLAIM_INTERVAL_MS=5000

# Poller interval in ms (8000 = 8 seconds)
POLL_INTERVAL_MS=8000

# Deduplication window in ms (60000 = 60 seconds)
DEDUPE_TTL_MS=60000

# Max queue size (drop oldest when exceeded)
QUEUE_MAX_SIZE=1000
```

### Production Settings
```env
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
```

## 📊 Webhook Integration

### Sending Vanity Events to the Bot

```bash
VANITY="coolname"
TIMESTAMP=$(date +%s)
BODY=$(echo -n '{"vanity":"'$VANITY'","eventId":"'$TIMESTAMP'"}' | tr -d '\n')
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | cut -d' ' -f2)

curl -X POST http://localhost:3001/webhooks/vanity \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIGNATURE" \
  -d "$BODY"
```

### Response
```json
{
  "ok": true,
  "queued": true
}
```

## 📈 Monitoring

### Health Check
```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": 1696110123456
}
```

### Queue Stats
```bash
curl http://localhost:3001/stats
```

Response:
```json
{
  "queueSize": 5,
  "maxSize": 1000,
  "seenEntries": 12,
  "dedupeWindow": 60000,
  "nextItem": "coolname"
}
```

## 📊 Performance Metrics

- **Claim Latency**: 50-150ms (with good internet)
- **Webhook Throughput**: 50 requests/second
- **Queue Deduplication**: <1ms
- **Database Inserts**: <5ms per entry
- **Memory Usage**: ~50-100MB base + queue size
- **CPU**: <5% idle, scales with concurrency

## 🔐 Security Best Practices

✅ **Do:**
- Use a dedicated Discord bot account
- Enable 2FA on the bot account
- Store credentials in `.env` (never in repo)
- Set a strong `WEBHOOK_SECRET` (32+ chars)
- Use HTTPS in production
- Validate webhook signatures (already implemented)
- Rotate tokens periodically
- Run with least privilege user on server

❌ **Don't:**
- Commit `.env` to GitHub
- Share Discord tokens
- Use production token for testing
- Log raw tokens or secrets
- Expose `/webhooks` endpoint publicly without rate limiting

## 🛠️ Advanced Configuration

### Running Multiple Instances

```bash
# Instance 1
PORT=3001 npm start

# Instance 2 (different process)
PORT=3002 WORKER_CONCURRENCY=2 npm start
```

Load balance with nginx:
```nginx
upstream vanity_sniper {
  server localhost:3001;
  server localhost:3002;
}

server {
  listen 80;
  location / {
    proxy_pass http://vanity_sniper;
  }
}
```

### Database Maintenance

```sql
-- Cleanup old claims (older than 30 days)
DELETE FROM claims WHERE timestamp < datetime('now', '-30 days');
VACUUM;

-- Get statistics
SELECT DATE(timestamp), COUNT(*) as attempts, SUM(success) as successes
FROM claims
GROUP BY DATE(timestamp)
ORDER BY timestamp DESC;
```

## 📡 Integration Examples

### Discord Bot Integration

```javascript
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const crypto = require('crypto');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('guildUpdate', async (oldGuild, newGuild) => {
  if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
    const vanity = newGuild.vanityURLCode;
    const payload = { vanity, eventId: crypto.randomUUID() };
    const signature = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    await axios.post('http://localhost:3001/webhooks/vanity', payload, {
      headers: { 'X-Signature': signature },
    });
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
```

### External Webhook Caller

```python
import requests
import hmac
import hashlib
import json

def send_vanity(vanity, secret):
    payload = {'vanity': vanity, 'eventId': 'external-trigger'}
    body = json.dumps(payload)
    signature = hmac.new(
        secret.encode(),
        body.encode(),
        hashlib.sha256
    ).hexdigest();
    
    response = requests.post(
        'http://localhost:3001/webhooks/vanity',
        json=payload,
        headers={'X-Signature': signature}
    )
    return response.json()
```

## 🚨 Troubleshooting

### "Invalid signature"
- Ensure `WEBHOOK_SECRET` matches sender and receiver
- Check that the body is hashed exactly as sent (no extra whitespace)
- Verify HMAC-SHA256 algorithm

### "Rate limited (429)"
- Natural Discord rate limiting
- Bot automatically retries after delay
- Reduce `WORKER_CONCURRENCY` if persistent

### "Missing permissions (50013)"
- Server needs Level 3 Boost minimum
- Bot needs admin or specific vanity URL permission
- Check server audit logs

### High Memory Usage
- Check queue size (`/stats`)
- Reduce `QUEUE_MAX_SIZE` if needed
- Enable log rotation (for production)

### Claims Not Processing
- Check logs: `tail -f logs/vanity-*.log`
- Verify `/stats` shows items in queue
- Test webhook with: `curl http://localhost:3001/health`

## 📊 Log Files

Logs are stored in `logs/` directory with daily rotation:
```
logs/
├── vanity-2024-01-15.log
├── vanity-2024-01-16.log
└── vanity-2024-01-17.log
```

Log format:
```
[2024-01-17T10:30:45.123Z] [INFO] Message here
[2024-01-17T10:30:46.456Z] [ERROR] Error message {"context": "data"}
```

## 📈 Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `WEBHOOK_SECRET` (32+ chars)
- [ ] Store `.env` securely (not in repo)
- [ ] Enable 2FA on Discord bot account
- [ ] Configure firewall to restrict `/webhooks` access
- [ ] Set up log rotation
- [ ] Monitor `/stats` endpoint
- [ ] Test graceful shutdown (SIGTERM)
- [ ] Backup database regularly
- [ ] Set up alerting for errors

## 📜 License

MIT License - Feel free to use and modify.

## ⚖️ Legal Notice

This tool is for educational purposes. Ensure you have the right to claim vanities on your Discord servers. Unauthorized access to Discord accounts is prohibited.

---

**Need help?** Check the logs or review the source code in `src/`

