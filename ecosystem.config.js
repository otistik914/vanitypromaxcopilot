{
  "apps": [
    {
      "name": "vanity-sniper",
      "script": "src/index.js",
      "instances": "max",
      "exec_mode": "cluster",
      "env": {
        "NODE_ENV": "production",
        "PORT": 3001,
        "LOG_LEVEL": "info",
        "WORKER_CONCURRENCY": 8,
        "CLAIM_INTERVAL_MS": 1000,
        "POLL_INTERVAL_MS": 5000
      },
      "error_file": "logs/pm2-error.log",
      "out_file": "logs/pm2-out.log",
      "log_date_format": "YYYY-MM-DD HH:mm:ss Z",
      "merge_logs": true,
      "watch": false,
      "ignore_watch": ["logs", "node_modules", ".env"],
      "max_memory_restart": "500M",
      "kill_timeout": 15000,
      "wait_ready": true,
      "listen_timeout": 3000,
      "shutdown_with_message": true,
      "autorestart": true,
      "max_restarts": 10,
      "min_uptime": "10s",
      "restart_delay": 4000
    }
  ]
}
