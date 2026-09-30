const fs = require('fs');
const path = require('path');

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const logLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];
const logsDir = path.join(__dirname, '..', 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, `vanity-${new Date().toISOString().split('T')[0]}.log`);

function formatTime() {
  return new Date().toISOString();
}

function formatMessage(level, message, data) {
  let msg = `[${formatTime()}] [${level.toUpperCase()}] ${message}`;
  if (data) {
    msg += ` ${JSON.stringify(data)}`;
  }
  return msg;
}

function writeLog(level, message, data) {
  try {
    fs.appendFileSync(logFile, formatMessage(level, message, data) + '\n');
  } catch (err) {
    console.error('Failed to write log:', err.message);
  }
}

const logger = {
  error: (message, data) => {
    if (logLevel >= LOG_LEVELS.error) {
      const msg = formatMessage('error', message, data);
      console.error(msg);
      writeLog('error', message, data);
    }
  },
  warn: (message, data) => {
    if (logLevel >= LOG_LEVELS.warn) {
      const msg = formatMessage('warn', message, data);
      console.warn(msg);
      writeLog('warn', message, data);
    }
  },
  info: (message, data) => {
    if (logLevel >= LOG_LEVELS.info) {
      const msg = formatMessage('info', message, data);
      console.log(msg);
      writeLog('info', message, data);
    }
  },
  debug: (message, data) => {
    if (logLevel >= LOG_LEVELS.debug) {
      const msg = formatMessage('debug', message, data);
      console.debug(msg);
      writeLog('debug', message, data);
    }
  },
};

module.exports = logger;

