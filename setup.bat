@echo off
echo 🚀 Discord Vanity Sniper Pro - Setup
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo Visit https://nodejs.org/ to download and install Node.js v18+
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Node.js found: %NODE_VERSION%
echo.

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not installed!
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo ✅ npm found: %NPM_VERSION%
echo.

echo 📦 Installing dependencies...
call npm install

if not exist .env (
    echo.
    echo 📋 Creating .env file from .env.example...
    copy .env.example .env
    echo ✅ .env created. Please edit it with your credentials.
) else (
    echo ✅ .env already exists
)

echo.
echo 🎉 Setup complete!
echo Next steps:
echo   1. Edit .env with your Discord token and guild ID
echo   2. Run: npm start
echo.
pause
