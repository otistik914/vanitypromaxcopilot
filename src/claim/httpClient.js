import http2 from 'http2';
import tls from 'tls';

const sessionCache = new Map();

export class Http2Client {
  constructor({ logger }) {
    this.logger = logger;
    this.sessions = new Map();
  }

  getSession(host) {
    if (this.sessions.has(host)) {
      return this.sessions.get(host);
    }

    const session = http2.connect(`https://${host}`, {
      createConnection: () => {
        const socket = tls.connect({
          host,
          port: 443,
          servername: host,
          minVersion: 'TLSv1.2'
        });
        return socket;
      }
    });

    session.on('error', (error) => {
      this.logger.warn({ host, error: error.message }, 'Session error');
      this.sessions.delete(host);
    });

    this.sessions.set(host, session);
    return session;
  }

  async request({
    host = 'canary.discord.com',
    path,
    method = 'PATCH',
    headers = {},
    body = null,
    timeoutMs = 5000
  }) {
    const session = this.getSession(host);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        req.destroy();
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const req = session.request({
        ':method': method,
        ':path': path,
        ':scheme': 'https',
        ':authority': host,
        ...headers
      });

      let data = '';

      req.on('data', (chunk) => {
        data += chunk.toString();
      });

      req.on('end', () => {
        clearTimeout(timer);
        resolve({
          status: req.getHeaderObject()[':status'],
          headers: req.getHeaderObject(),
          body: data
        });
      });

      req.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });

      if (body) {
        req.write(body);
      }

      req.end();
    });
  }

  close() {
    for (const session of this.sessions.values()) {
      session.destroy();
    }
    this.sessions.clear();
  }
}
