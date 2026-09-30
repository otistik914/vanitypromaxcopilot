# Discord Vanity Sniper Pro v2.0 - Production Ready

## 🚀 Quick Deployment

### Option 1: Docker (Recommended)
```bash
# 1. Copy .env.example to .env and fill in credentials
cp .env.example .env
# Edit .env with your Discord token, guild ID, and webhook secret

# 2. Deploy
chmod +x deploy.sh
./deploy.sh

# 3. Verify
curl http://localhost:3001/health
```

### Option 2: PM2 (Node.js)
```bash
# 1. Install dependencies
npm ci --only=production

# 2. Set up environment
cp .env.example .env
# Edit .env with your credentials

# 3. Start with PM2
chmod +x scripts/pm2-start.sh
./scripts/pm2-start.sh

# 4. Check status
pm2 status
pm2 logs vanity-sniper
```

### Option 3: Direct Node.js
```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env

# 3. Start
npm start
```

## 🔧 Configuration

### Required (.env)
```env
DISCORD_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_guild_id
WEBHOOK_SECRET=your_long_random_secret_32chars_min
```

### Performance Tuning
```env
# Proxyless ultra-fast mode (default)
WORKER_CONCURRENCY=8          # 8 concurrent workers
CLAIM_INTERVAL_MS=1000        # 1 second worker check
POLL_INTERVAL_MS=5000         # 5 second vanity poll

# For more conservative systems
WORKER_CONCURRENCY=4
CLAIM_INTERVAL_MS=5000
POLL_INTERVAL_MS=10000
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3001/health
```

### Performance Stats
```bash
curl http://localhost:3001/stats
```

### Real-time Logs
```bash
# Docker
docker-compose logs -f

# PM2
pm2 logs vanity-sniper

# Direct
# tail -f logs/vanity-*.log
```

## 🧪 Benchmarking

```bash
# Run benchmark suite
node scripts/benchmark.js

# Custom server
SERVER_URL=http://your-server:3001 node scripts/benchmark.js
```

## 🌐 Proxyless Architecture

This application runs in **proxyless direct mode**:
- No HTTP/SOCKS proxy required
- Direct socket connection to Discord API
- Optimized DNS (Cloudflare + Google)
- TLS session reuse
- Keep-alive connection pooling
- Sub-50ms latency target

## 🔐 Security

✅ **Best Practices Implemented:**
- HMAC-SHA256 webhook signature validation
- Secure env-based credentials (no config.json)
- Rate limiting (2000 req/min per IP)
- Graceful error handling
- Detailed audit logging
- SQLite with WAL mode

❌ **Never:**
- Commit .env to GitHub
- Share Discord tokens
- Expose /webhooks endpoint publicly
- Use production token for testing

## 📦 Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `WEBHOOK_SECRET` (32+ chars)
- [ ] Enable Discord 2FA on bot account
- [ ] Set up log rotation
- [ ] Configure firewall/rate limiting
- [ ] Test graceful shutdown (SIGTERM)
- [ ] Set up monitoring/alerting
- [ ] Backup database regularly
- [ ] Document webhook endpoint
- [ ] Load test before production

## 🆘 Troubleshooting

### Port already in use
```bash
# Change PORT in .env
PORT=3002 npm start
```

### High memory usage
```bash
# Reduce queue size in .env
QUEUE_MAX_SIZE=500
```

### Claims not processing
```bash
# Check logs
grep "ULTRA-FAST" logs/vanity-*.log

# Verify stats
curl http://localhost:3001/stats
```

### Docker issues
```bash
# View detailed logs
docker-compose logs --tail=100

# Rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📞 Support

For issues:
1. Check logs: `logs/vanity-*.log`
2. Verify .env configuration
3. Test with `node scripts/benchmark.js`
4. Check `/stats` endpoint for queue depth

## 📄 License

MIT License - Educational use only.

---

**Version**: 2.0.0 (Final Edition - Proxyless Ultra-Fast)
**Status**: Production Ready ✅

