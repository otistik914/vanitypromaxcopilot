# Discord Vanity Sniper Pro

**High-performance, aggressive Discord vanity monitoring and claiming tool.**

## ⚡ What is This?

This tool monitors your Discord server in real-time for vanity URL changes and attempts to claim them at lightning speed (50-150ms latency). It automatically tracks grace periods and retries claims when they become available.

## 🚀 Quick Start (30 seconds)

### Windows
1. Double-click `setup.bat`
2. Open `config.json` and fill in your Discord info (see guide below)
3. Open Command Prompt and run: `npm start`

### Mac/Linux
```bash
chmod +x setup.sh
./setup.sh
# Follow the instructions
npm start
```

---

## 📋 Getting Your Discord Credentials (STEP-BY-STEP)

### Step 1: Get Your Discord Token

#### On Windows/Mac:
1. Open Discord in your web browser: **discord.com**
2. Press **Ctrl + Shift + I** (Windows) or **Cmd + Shift + I** (Mac)
3. A developer tools window will open
4. Click the **Network** tab
5. In the filter box at the top, type: **api**
6. Press **F5** to refresh the page
7. Click on **any request** in the list
8. On the right side, look for a section called **Headers**
9. Find the line that says **Authorization**
10. Copy the **entire value** (it's a very long string)
11. Open `config.json` and paste it next to `"token":`

**Example:**
```json
"token": "MzA4NTExMzU3NzE1NzI2MzM2.GCdx4K.-VERY-LONG-STRING-HERE"
```

### Step 2: Get Your Server ID

1. Open Discord app or website
2. Go to **Settings > Advanced**
3. Turn **ON** "Developer Mode"
4. Right-click on your **server icon** (on the left)
5. Click **Copy ID**
6. Paste in `config.json` as `"serverId"`

### Step 3: Get Your User ID

1. Right-click on **your username** anywhere in Discord
2. Click **Copy ID**
3. Paste in `config.json` as `"userToDm"`

### Step 4: Get Your Discord Password

1. Simply put your Discord login password in `config.json` as `"password"`
2. This is used to solve MFA if your account has 2FA enabled

### Step 5 (Optional): Get Webhook URL

If you want to get notifications when vanities are detected:

1. Go to any Discord channel
2. Right-click it → **Edit Channel**
3. Click **Integrations** on the left
4. Click **Webhooks**
5. Click **New Webhook**
6. Give it a name (e.g., "Sniper Alerts")
7. Click **Copy Webhook URL**
8. Paste in `config.json` as `"webhookUrl"`

---

## ⚙️ Editing config.json

Open `config.json` in a text editor (Notepad, VS Code, etc.):

```json
{
  "discord": {
    "token": "YOUR_DISCORD_TOKEN_HERE",
    "password": "YOUR_DISCORD_PASSWORD_HERE",
    "monitorToken": "YOUR_MONITOR_TOKEN_HERE"
  },
  "guild": {
    "serverId": "YOUR_SERVER_ID_HERE"
  },
  "notifications": {
    "webhookUrl": "YOUR_WEBHOOK_URL_HERE",
    "webhookUsername": "Vanity Monitor"
  },
  "behavior": {
    "graceDays": 30,
    "claimRetryLimit": 3,
    "claimRetryDelayMs": 1500
  }
}
```

**Replace all `YOUR_*_HERE` values with your actual credentials.**

---

## 🎮 Running the Sniper

### Start it:
```bash
npm start
```

### Watch mode (development):
```bash
npm run dev
```

### Check for errors:
```bash
npm run check
```

---

## 🔍 How It Works

1. **Monitoring** - Connects to Discord gateway and listens for vanity URL changes
2. **Detection** - When a vanity changes, immediately queues it for claiming
3. **MFA** - Automatically handles MFA authentication and token refresh
4. **Claiming** - Sends HTTP/2 optimized requests to claim the vanity (50-150ms)
5. **Grace Period** - Stores the vanity in a local database for ~30 days
6. **Auto-Retry** - When grace period expires, automatically retries the claim
7. **Notifications** - Sends Discord webhook alerts on success/failure

---

## ⚡ Performance

- **Claim Latency**: 50-150ms (with good internet)
- **Gateway Events**: Batched every 50ms
- **MFA Refresh**: Cached for 4 minutes
- **Database**: SQLite with WAL mode (sub-millisecond queries)
- **Concurrency**: Non-blocking async/await throughout

---

## ⚠️ Security & Safety

**CRITICAL:** Never commit `config.json` to GitHub or share it with anyone!

### Best Practices:
- ✅ Use a dedicated Discord account
- ✅ Enable 2FA on that account
- ✅ Keep `config.json` private
- ✅ Delete `config.json` when you're done
- ✅ Revoke the token if you publish this code
- ❌ Never share your Discord token
- ❌ Never push `config.json` to GitHub
- ❌ Never take screenshots with your token visible

---

## 🛠️ Troubleshooting

### "Node.js is not installed"
1. Go to https://nodejs.org/
2. Download v20.18 or newer
3. Install it
4. Run setup.bat/setup.sh again

### "config.json not found"
1. Run `setup.bat` (Windows) or `./setup.sh` (Mac/Linux) again
2. Or manually: copy `config.example.json` to `config.json`

### "Invalid token"
1. Make sure you copied the ENTIRE Authorization header
2. Token should be very long (100+ characters)
3. Don't include quotes or spaces

### "MFA token not available"
1. Check your password is correct in config.json
2. Check if your account has 2FA enabled
3. Try restarting the tool

### "Failed to claim"
1. Check if you have vanity URL permissions in the server
2. Server needs Level 3 Boost (or higher)
3. Check your internet connection speed
4. Try again - it may have been rate limited

---

## 📊 Log Output

When running, you'll see logs like:
```
🚀 Starting Discord Vanity Sniper Pro (Production)
✅ Gateway connected
✅ MFA token refreshed
📝 Vanity change detected
✅ Claim queued
✅ Vanity claimed in 87ms
```

---

## 📄 License

MIT License - Feel free to use and modify for personal use.

---

## ⚖️ Legal Notice

This tool is for educational purposes. Ensure you have the right to claim vanities on your Discord servers. Unauthorized access to Discord accounts is prohibited.

---

**Made with ❤️ by Krmoff**

GitHub: https://github.com/Krmoff/discord-vanity-sniper-pro
