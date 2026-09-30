# Discord Vanity Sniper Pro - Final Checklist

## ✅ Pre-Deployment

- [ ] Node.js 18+ installed
- [ ] Docker & Docker Compose installed (for Docker deployment)
- [ ] PM2 installed globally (for PM2 deployment)
- [ ] `.env` file created with credentials
- [ ] `WEBHOOK_SECRET` is 32+ characters
- [ ] Discord bot token is valid
- [ ] Discord server ID is correct

## ✅ Deployment

### Docker Method
```bash
cp .env.example .env
# Edit .env
bash deploy.sh
```

### PM2 Method
```bash
cp .env.example .env
# Edit .env
bash scripts/pm2-start.sh
```

### Direct Method
```bash
cp .env.example .env
# Edit .env
npm install
npm start
```

## ✅ Verification

After deployment, verify:

```bash
# Health check
curl http://localhost:3001/health
# Expected: {"status":"ok",...}

# Queue stats
curl http://localhost:3001/stats
# Expected: {"queue":{...},"database":{...},...}

# Run benchmark
node scripts/benchmark.js
# Expected: ✅ All tests passed
```

## ✅ Production Setup

- [ ] Set `NODE_ENV=production` in .env
- [ ] Configure `WORKER_CONCURRENCY` for your hardware
- [ ] Set up log rotation (daily logs)
- [ ] Configure firewall rules
- [ ] Set up monitoring/alerting
- [ ] Backup database (`vanity.db`)
- [ ] Test graceful shutdown (Ctrl+C or SIGTERM)
- [ ] Document webhook endpoint for your systems
- [ ] Test rate limiting and error handling
- [ ] Load test before production traffic

## ✅ Monitoring

### Docker
```bash
# Logs
docker-compose logs -f

# Health
docker-compose ps

# Stats
curl http://localhost:3001/stats
```

### PM2
```bash
# Status
pm2 status

# Logs
pm2 logs vanity-sniper

# Monitor
pm2 monit
```

### Direct
```bash
# Logs
tail -f logs/vanity-*.log

# Stats
curl http://localhost:3001/stats
```

## ✅ Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3001 in use | Set `PORT=3002` in .env |
| High memory | Reduce `QUEUE_MAX_SIZE` in .env |
| Claims not processing | Check `/stats` for queue depth, check logs |
| Docker won't start | Run `docker-compose logs` to see error |
| Connection refused | Check port is open, firewall rules |
| Rate limited | Discord API is rate limiting, bot will retry |

## ✅ Performance Tuning

### Conservative (Low Resource)
```env
WORKER_CONCURRENCY=4
CLAIM_INTERVAL_MS=5000
POLL_INTERVAL_MS=10000
# Expected latency: 80-150ms
```

### Balanced (Default)
```env
WORKER_CONCURRENCY=8
CLAIM_INTERVAL_MS=1000
POLL_INTERVAL_MS=5000
# Expected latency: 35-55ms
```

### Aggressive (High Performance)
```env
WORKER_CONCURRENCY=12
CLAIM_INTERVAL_MS=500
POLL_INTERVAL_MS=3000
# Expected latency: 25-45ms (requires good network)
```

## ✅ Maintenance

### Daily
- Monitor logs for errors
- Check queue depth
- Verify health endpoint

### Weekly
- Review performance metrics
- Check database size (`vanity.db`)
- Test backup/restore

### Monthly
- Database maintenance (vacuum)
- Security updates (npm audit)
- Performance optimization review

## ✅ Security

- [ ] .env file not committed to Git
- [ ] WEBHOOK_SECRET is strong (32+ chars)
- [ ] Discord token rotated regularly
- [ ] Logs don't contain sensitive data
- [ ] Rate limiting configured
- [ ] Firewall restricts access
- [ ] Only necessary ports open (3001)
- [ ] Regular backups of database

---

**Status**: ✅ Production Ready
**Version**: 2.0.0 (Final Edition)
**Last Updated**: 2026-09-30

