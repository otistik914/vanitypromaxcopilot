import WebSocket from 'ws';
import { appState } from '../state.js';
import { wait } from '../utils/retry.js';

export async function connectGateway({
  url,
  token,
  onMessage,
  reconnectDelayMs,
  heartbeatTimeoutMs,
  onReady
}) {
  let socket;
  let sequence = null;
  let hbTimer = null;
  let lastHeartbeatAck = Date.now();

  const connect = () => {
    socket = new WebSocket(url);

    socket.on('open', () => {
      appState.connected = true;
      socket.send(JSON.stringify({
        op: 2,
        d: {
          token,
          intents: 1 | 128 | 256,
          properties: {
            os: 'Windows',
            browser: 'Chrome',
            device: '',
            system_locale: 'en-US',
            browser_version: '130.0.0.0'
          },
          presence: { status: 'online', afk: false, since: 0 }
        }
      }));

      if (onReady) {
        onReady();
      }
    });

    socket.on('message', async (raw) => {
      try {
        const payload = JSON.parse(raw.toString());

        if (payload.s !== null) {
          sequence = payload.s;
        }

        if (payload.op === 10 && payload.d?.heartbeat_interval) {
          hbTimer = setInterval(() => {
            if (Date.now() - lastHeartbeatAck > heartbeatTimeoutMs) {
              socket.close();
              return;
            }

            socket.send(JSON.stringify({ op: 1, d: sequence }));
          }, payload.d.heartbeat_interval);
        }

        if (payload.op === 11) {
          lastHeartbeatAck = Date.now();
        }

        if (payload.op === 0 && payload.t) {
          await onMessage(payload);
        }
      } catch (error) {
        console.error('Gateway payload parsing failed:', error);
      }
    });

    socket.on('close', async () => {
      appState.connected = false;
      clearInterval(hbTimer);
      await wait(reconnectDelayMs);
      connect();
    });

    socket.on('error', (error) => {
      console.error('Gateway socket error:', error.message);
    });
  };

  connect();

  return {
    close() {
      if (socket) {
        socket.close();
      }
    }
  };
}
