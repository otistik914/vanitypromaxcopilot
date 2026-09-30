#!/bin/bash

echo "🚀 Discord Vanity Sniper Pro - Setup"
echo ""

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Visit https://nodejs.org/ to download and install Node.js v18+"
    exit 1
fi

echo "✅ Node.js found: $(node -v)"
echo ""

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    exit 1
fi

echo "✅ npm found: $(npm -v)"
echo ""

echo "📦 Installing dependencies..."
npm install

if [ ! -f .env ]; then
    echo ""
    echo "📋 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env created. Please edit it with your credentials."
else
    echo "✅ .env already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo "Next steps:"
echo "  1. Edit .env with your Discord token and guild ID"
echo "  2. Run: npm start"
