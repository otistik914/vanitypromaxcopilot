#!/bin/bash

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Discord Vanity Sniper Pro - Setup Wizard (Linux/Mac)      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check Node.js
echo "[1/4] Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo ""
    echo "❌ Node.js is NOT installed!"
    echo ""
    echo "How to fix:"
    echo "  1. Go to: https://nodejs.org/"
    echo "  2. Download Node.js v20.18 or higher"
    echo "  3. Install it"
    echo "  4. Run this script again"
    echo ""
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js installed: $NODE_VERSION"

# Check Node.js version
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo ""
    echo "❌ Node.js version too old! Need v20.18+, you have $NODE_VERSION"
    echo ""
    echo "How to fix:"
    echo "  1. Go to: https://nodejs.org/"
    echo "  2. Download Node.js v20.18 or higher"
    echo "  3. Uninstall your current version"
    echo "  4. Install the new version"
    echo "  5. Run this script again"
    echo ""
    exit 1
fi

# Install dependencies
echo ""
echo "[2/4] Installing dependencies..."
if npm install > /dev/null 2>&1; then
    echo "✅ Dependencies installed successfully"
else
    echo ""
    echo "❌ Failed to install dependencies!"
    echo ""
    echo "How to fix:"
    echo "  1. Make sure you have internet connection"
    echo "  2. Try running: npm install"
    echo "  3. If still fails, delete node_modules: rm -rf node_modules"
    echo "  4. Then run npm install again"
    echo ""
    exit 1
fi

# Setup config
echo ""
echo "[3/4] Setting up configuration file..."
if [ -f config.json ]; then
    echo "⚠️  config.json already exists"
    echo ""
    read -p "   Do you want to overwrite it? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp config.example.json config.json
        echo "✅ config.json reset to default"
    fi
else
    cp config.example.json config.json
    echo "✅ config.json created"
fi

# Create data directory
echo ""
echo "[4/4] Creating data directory..."
mkdir -p data
echo "✅ Data directory ready"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   Setup Complete! ✅                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "1️⃣  Open config.json with a text editor:"
echo "   nano config.json"
echo ""
echo "2️⃣  Fill in your Discord credentials (see section below)"
echo ""
echo "3️⃣  Save and exit (Ctrl+X if using nano)"
echo ""
echo "4️⃣  Start the sniper:"
echo "   npm start"
echo ""
echo "═════════════════════════════════════════════════════════════"
echo ""
echo "📋 GETTING YOUR DISCORD CREDENTIALS:"
echo ""
echo "┌─ YOUR DISCORD TOKEN ─────────────────────────────────────┐"
echo "│                                                            │"
echo "│ 1. Open Discord in your web browser (discord.com)        │"
echo "│ 2. Press: Ctrl + Shift + I (or Cmd + Shift + I on Mac)  │"
echo "│ 3. Click the 'Network' tab at the top                    │"
echo "│ 4. Type 'api' in the filter box                          │"
echo "│ 5. Click on any request in the list                      │"
echo "│ 6. Look for 'Authorization' in the Headers               │"
echo "│ 7. Copy the entire long string (that's your TOKEN)       │"
echo "│ 8. Paste it in config.json as: \"token\"                 │"
echo "│                                                            │"
echo "└────────────────────────────────────────────────────────────┘"
echo ""
echo "┌─ YOUR SERVER & CHANNEL IDS ──────────────────────────────┐"
echo "│                                                            │"
echo "│ 1. Open Discord app/browser                              │"
echo "│ 2. Go to User Settings > Advanced                        │"
echo "│ 3. Enable 'Developer Mode'                               │"
echo "│ 4. Now you can right-click things to 'Copy ID'           │"
echo "│                                                            │"
echo "│ Get these IDs:                                           │"
echo "│ • Your Server ID: Right-click server icon                │"
echo "│ • Paste in config.json as: \"serverId\"                   │"
echo "│                                                            │"
echo "│ • Your User ID: Right-click your name                    │"
echo "│ • Paste in config.json as: \"userToDm\"                  │"
echo "│                                                            │"
echo "└────────────────────────────────────────────────────────────┘"
echo ""
echo "┌─ YOUR DISCORD PASSWORD ──────────────────────────────────┐"
echo "│                                                            │"
echo "│ Simply put your Discord login password in config.json     │"
echo "│                                                            │"
echo "└────────────────────────────────────────────────────────────┘"
echo ""
echo "┌─ WEBHOOK URL (Optional) ─────────────────────────────────┐"
echo "│                                                            │"
echo "│ 1. Go to your Discord server                             │"
echo "│ 2. Right-click any channel > Edit Channel                │"
echo "│ 3. Go to 'Integrations' > 'Webhooks'                     │"
echo "│ 4. Click 'New Webhook'                                   │"
echo "│ 5. Give it a name (e.g. 'Sniper Alerts')                │"
echo "│ 6. Click 'Copy Webhook URL'                              │"
echo "│ 7. Paste in config.json as: \"webhookUrl\"                │"
echo "│                                                            │"
echo "│ (This will send you notifications when vanities drop)   │"
echo "│                                                            │"
echo "└────────────────────────────────────────────────────────────┘"
echo ""
echo "═════════════════════════════════════════════════════════════"
echo ""
echo "⚠️  IMPORTANT SECURITY NOTES:"
echo ""
echo "  • NEVER share your config.json file"
echo "  • NEVER share your Discord token"
echo "  • NEVER push config.json to GitHub"
echo "  • Use a dedicated Discord account for this tool"
echo ""
echo "═════════════════════════════════════════════════════════════"
echo ""
