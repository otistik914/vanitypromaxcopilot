import WebSocket from 'ws';

const HEARTBEAT_GRACE_MS = 5000;

export class GatewayMonitor {
  constructor({ token, config, logger }) {
    this.token = token;
    this.config = config;
    this.logger = logger;
    this.ws = null;
    this.sequence = null;
    this.hbTimer = null;
    this.lastHbAck = Date.now();
    this.eventBuffer = [];
    this.bufferTimer = null;
    this.isConnected = false;
  }

  async connect({ onVanityChange }) {
    this.ws = new WebSocket('wss://gateway.discord.gg/?encoding=json&v=9');

    this.ws.on('open', () => {
      this.logger.info('Gateway connected');
      this.isConnected = true;

      this.ws.send(JSON.stringify({
        op: 2,
        d: {
          token: this.token,
          capabilities: 509,
          intents: 1 | 128 | 256,
          properties: {
            os: 'Windows',
            browser: 'Chrome',
            device: '',
            system_locale: 'en-US',
            browser_user_agent: 'Mozilla/5.0'
          },
          compress: false,
          presence: { status: 'online', afk: false, since: 0 }
        }
      }));
    });

    this.ws.on('message', async (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        this.#handlePayload(payload, onVanityChange);
      } catch (error) {
        this.logger.warn({ error: error.message }, 'Failed to parse gateway message');
      }
    });

    this.ws.on('close', () => {
      this.logger.info('Gateway disconnected, reconnecting...');
      this.isConnected = false;
      clearInterval(this.hbTimer);
      this.#flushBuffer(onVanityChange);

      setTimeout(() => this.connect({ onVanityChange }), this.config.gatewayReconnectDelayMs);
    });

    this.ws.on('error', (error) => {
      this.logger.error({ error: error.message }, 'Gateway error');
    });
  }

  #handlePayload(payload, onVanityChange) {
    if (payload.s !== null) {
      this.sequence = payload.s;
    }

    if (payload.op === 10 && payload.d?.heartbeat_interval) {
      this.hbTimer = setInterval(() => {
        if (Date.now() - this.lastHbAck > this.config.heartbeatTimeoutMs + HEARTBEAT_GRACE_MS) {
          this.logger.warn('Heartbeat timeout, closing connection');
          this.ws.close();
          return;
        }

        this.ws.send(JSON.stringify({ op: 1, d: this.sequence }));
      }, payload.d.heartbeat_interval);
    }

    if (payload.op === 11) {
      this.lastHbAck = Date.now();
    }

    if (payload.op === 0 && (payload.t === 'GUILD_UPDATE' || payload.t === 'GUILD_DELETE')) {
      const vanity = payload.d?.vanity_url_code;
      if (vanity) {
        this.eventBuffer.push({ vanity, timestamp: Date.now() });
        this.#scheduleFlush(onVanityChange);
      }
    }
  }

  #scheduleFlush(onVanityChange) {
    if (this.bufferTimer) {
      return;
    }

    this.bufferTimer = setTimeout(() => {
      this.#flushBuffer(onVanityChange);
    }, 50); // Batch events every 50ms
  }

  #flushBuffer(onVanityChange) {
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
    }

    if (this.eventBuffer.length === 0) {
      return;
    }

    const events = this.eventBuffer.splice(0);
    this.logger.debug({ count: events.length }, 'Flushing buffered vanity events');

    for (const event of events) {
      onVanityChange(event.vanity, event.timestamp);
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
    clearInterval(this.hbTimer);
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
    }
  }
}
