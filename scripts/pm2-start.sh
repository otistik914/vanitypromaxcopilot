#!/bin/bash
# Production PM2 startup script

echo "🚀 Discord Vanity Sniper Pro - PM2 Production Start"
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "⚠️  PM2 not found. Installing globally..."
    npm install -g pm2
fi

echo "✅ PM2 version: $(pm2 -v)"
echo ""

# Check .env
if [ ! -f .env ]; then
    echo "❌ .env not found!"
    echo "Please create .env with required variables first."
    exit 1
fi

echo "✅ .env found"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

echo "✅ Dependencies installed"
echo ""

# Start with PM2
echo "🚀 Starting with PM2..."
pm2 start ecosystem.config.js

echo "✅ Service started"
echo ""

echo "📐 Useful PM2 commands:"
echo "  View logs:       pm2 logs vanity-sniper"
echo "  View status:     pm2 status"
echo "  View details:    pm2 show vanity-sniper"
echo "  Stop service:    pm2 stop vanity-sniper"
echo "  Restart service: pm2 restart vanity-sniper"
echo "  Delete service:  pm2 delete vanity-sniper"
echo ""
echo "🔍 Check health:"
echo "  curl http://localhost:3001/health"
echo ""
