#!/bin/bash
# Quick start script for Discord Vanity Sniper Pro

echo "🚀 Discord Vanity Sniper Pro - Quick Start"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found! Install from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js: $(node -v)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo ""
echo "📋 Configuration:"

if [ ! -f .env ]; then
    echo "Creating .env from template..."
    cp .env.example .env
    echo "✅ .env created (please edit with your credentials)"
else
    echo "✅ .env already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📑 Next steps:"
echo "  1. Edit .env with your Discord credentials"
echo "  2. Run: npm start"
echo ""
echo "📐 Or choose a deployment method:"
echo "  - Docker:  docker-compose up -d"
echo "  - PM2:     pm2 start ecosystem.config.js"
echo "  - Direct:  npm start"
echo ""
