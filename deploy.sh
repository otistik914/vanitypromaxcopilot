#!/bin/bash
# Discord Vanity Sniper Pro - One-Click Production Deploy

set -e

echo ""
echo "🚀 Discord Vanity Sniper Pro v2.0 - Production Deployment"
echo ""

# Validate .env
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo ""
    echo "📝 Setup steps:"
    echo "  1. cp .env.example .env"
    echo "  2. Edit .env with your Discord credentials"
    echo "  3. Run: bash deploy.sh"
    exit 1
fi

echo "✅ .env file found"
echo ""

# Check Docker
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not installed!"
    echo ""
    echo "📦 Install from: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker Compose installed"
echo ""

# Stop existing
echo "🛑 Stopping existing containers..."
docker-compose down 2>/dev/null || true
echo "✅ Stopped"
echo ""

# Build
echo "🔨 Building Docker image (this may take a minute)..."
docker-compose build --no-cache
echo "✅ Built"
echo ""

# Start
echo "▶️  Starting service..."
docker-compose up -d
echo "✅ Started"
echo ""

# Wait for health
echo "⏳ Waiting for service to be healthy..."
sleep 5

for i in {1..30}; do
    if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ Service is healthy!"
        echo ""
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Service failed to start!"
        echo ""
        echo "🔍 Debugging:"
        docker-compose logs
        exit 1
    fi
    sleep 1
done

echo "🎉 Deployment successful!"
echo ""
echo "📊 Quick commands:"
echo "   Logs:      docker-compose logs -f"
echo "   Health:    curl http://localhost:3001/health"
echo "   Stats:     curl http://localhost:3001/stats"
echo "   Benchmark: node scripts/benchmark.js"
echo "   Stop:      docker-compose down"
echo ""
echo "📖 Full guide: https://github.com/otistik914/vanitypromaxcopilot/blob/main/DEPLOYMENT.md"
echo ""
