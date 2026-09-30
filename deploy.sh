#!/bin/bash
# Production deployment script for Discord Vanity Sniper Pro

set -e

echo "🚀 Discord Vanity Sniper Pro - Production Deploy"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Please create .env file with required variables:"
    echo "  DISCORD_TOKEN"
    echo "  DISCORD_GUILD_ID"
    echo "  WEBHOOK_SECRET"
    exit 1
fi

echo "✅ .env file found"
echo ""

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down || true

echo "✅ Containers stopped"
echo ""

# Build image
echo "�� Building Docker image..."
docker-compose build --no-cache

echo "✅ Image built"
echo ""

# Start containers
echo "🚀 Starting containers..."
docker-compose up -d

echo "✅ Containers started"
echo ""

# Wait for health check
echo "⏳ Waiting for service to be healthy..."
sleep 5

# Check health
echo "🔍 Checking health..."
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Service is healthy!"
    echo ""
    echo "🎉 Deployment successful!"
    echo ""
    echo "📄 Useful commands:"
    echo "  View logs:        docker-compose logs -f"
    echo "  Check stats:      curl http://localhost:3001/stats"
    echo "  Health check:     curl http://localhost:3001/health"
    echo "  Stop service:     docker-compose down"
    echo "  Restart service:  docker-compose restart"
else
    echo "❌ Service failed to start!"
    echo ""
    echo "🔍 Debugging:"
    docker-compose logs
    exit 1
fi
