@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  Discord Vanity Sniper Pro - Setup Wizard (Windows)        ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Check Node.js
echo [1/4] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ Node.js is NOT installed!
    echo.
    echo How to fix:
    echo   1. Go to: https://nodejs.org/
    echo   2. Download Node.js v20.18 or higher
    echo   3. Install it (click Next, Next, Next)
    echo   4. Run this script again
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js installed: %NODE_VERSION%

REM Install dependencies
echo.
echo [2/4] Installing dependencies...
call npm install >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ Failed to install dependencies!
    echo.
    echo How to fix:
    echo   1. Make sure you have internet connection
    echo   2. Open Command Prompt or PowerShell
    echo   3. Type: npm install
    echo   4. Wait for it to finish
    echo.
    pause
    exit /b 1
)
echo ✅ Dependencies installed successfully

REM Setup config
echo.
echo [3/4] Setting up configuration file...
if exist config.json (
    echo ⚠️  config.json already exists
    echo.
    set /p OVERWRITE="   Do you want to overwrite it? (y/n): "
    if /i "!OVERWRITE!"=="y" (
        copy config.example.json config.json >nul
        echo ✅ config.json reset to default
    )
) else (
    copy config.example.json config.json >nul
    echo ✅ config.json created
)

REM Create data directory
echo.
echo [4/4] Creating data directory...
if not exist data mkdir data
echo ✅ Data directory ready

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                   Setup Complete! ✅                       ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Next steps:
echo.
echo 1️⃣  Open config.json with a text editor:
echo    • Right-click on config.json
    echo    • Select "Open with" then choose Notepad
echo.
echo 2️⃣  Fill in your Discord credentials (see section below)
echo.
echo 3️⃣  Save the file (Ctrl+S)
echo.
echo 4️⃣  Start the sniper by running this command in Command Prompt:
echo    npm start
echo.
echo ═════════════════════════════════════════════════════════════
echo.
echo 📋 GETTING YOUR DISCORD CREDENTIALS:
echo.
echo ┌─ YOUR DISCORD TOKEN ─────────────────────────────────────┐
echo │                                                            │
echo │ 1. Open Discord in your web browser (discord.com)        │
echo │ 2. Press: Ctrl + Shift + I                               │
echo │ 3. Click the 'Network' tab at the top                    │
echo │ 4. Type 'api' in the filter box                          │
echo │ 5. Refresh the page (F5)                                 │
echo │ 6. Click on any request in the list                      │
echo │ 7. Look in the Headers section                           │
echo │ 8. Find 'Authorization' - copy the entire value          │
echo │ 9. Paste it in config.json as: "token"                   │
echo │                                                            │
echo └────────────────────────────────────────────────────────────┘
echo.
echo ┌─ YOUR SERVER & USER IDS ──────────────────────────────────┐
echo │                                                            │
echo │ 1. Open Discord app                                      │
echo │ 2. Go to Settings > Advanced                             │
echo │ 3. Turn ON 'Developer Mode'                              │
echo │ 4. Now you can right-click and 'Copy ID'                 │
echo │                                                            │
echo │ Get these:
    echo │ • Your Server ID: Right-click on server icon             │
echo │   → Paste in config.json as: "serverId"                  │
echo │                                                            │
echo │ • Your User ID: Right-click on your username             │
echo │   → Paste in config.json as: "userToDm"                  │
echo │                                                            │
echo └────────────────────────────────────────────────────────────┘
echo.
echo ┌─ YOUR DISCORD PASSWORD ──────────────────────────────────┐
echo │                                                            │
echo │ Simply put your Discord login password in config.json     │
echo │                                                            │
echo └────────────────────────────────────────────────────────────┘
echo.
echo ┌─ WEBHOOK URL (Optional) ─────────────────────────────────┐
echo │                                                            │
echo │ 1. Go to any channel in Discord                          │
echo │ 2. Right-click on it > 'Edit Channel'                    │
echo │ 3. Click 'Integrations' on the left                      │
echo │ 4. Click 'Webhooks'                                      │
echo │ 5. Click 'New Webhook'                                   │
echo │ 6. Give it a name (e.g. 'Sniper Alerts')                │
echo │ 7. Click 'Copy Webhook URL'                              │
echo │ 8. Paste in config.json as: "webhookUrl"                 │
echo │                                                            │
echo │ (This will send you notifications when vanities drop)   │
echo │                                                            │
echo └────────────────────────────────────────────────────────────┘
echo.
echo ═════════════════════════════════════════════════════════════
echo.
echo ⚠️  IMPORTANT SECURITY NOTES:
echo.
echo   • NEVER share your config.json file
echo   • NEVER share your Discord token
echo   • Use a dedicated Discord account for this tool
echo   • Delete config.json when you're done
echo.
echo ═════════════════════════════════════════════════════════════
echo.
pause
