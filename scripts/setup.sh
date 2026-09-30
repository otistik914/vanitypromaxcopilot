#!/bin/bash
# Quick setup script

echo ""
echo "🚀 Discord Vanity Sniper Pro - Quick Setup"
echo ""

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found!"
    echo "📦 Install from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js: $(node -v)"
echo ""

if [ ! -f .env ]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo "✅ .env created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env with your Discord credentials:"
    echo "   vim .env"
else
    echo "✅ .env already exists"
fi

echo ""
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"

echo ""
echo "🎉 Setup complete!"
echo ""
echo "▶️  Start service:"
echo "   npm start          (direct)"
echo "   pm2 start ecosystem.config.js  (PM2)"
echo "   bash deploy.sh     (Docker)"
echo ""
