const dns = require('dns');
const tls = require('tls');
const http = require('http');
const https = require('https');
const net = require('net');

// Direct, proxyless DNS + TLS optimization layer
// This keeps the system fast without a proxy

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['1.1.1.1', '8.8.8.8', '8.8.4.4']);

// Reuse TLS sessions aggressively for lower handshake costs on direct connections
const tlsSessionCache = new Map();

tls.DEFAULT_ECDSA_CURVE = 'auto';

// Disable idle socket stalls for direct connection performance
https.globalAgent.keepAlive = true;
https.globalAgent.keepAliveMsecs = 30000;
https.globalAgent.maxSockets = 100;
https.globalAgent.maxFreeSockets = 50;

http.globalAgent.keepAlive = true;
http.globalAgent.keepAliveMsecs = 30000;
http.globalAgent.maxSockets = 100;
http.globalAgent.maxFreeSockets = 50;

function getSharedSessionKey(host, port) {
  return `${host}:${port}`;
}

function configureSessionReuse(socket) {
  const key = getSharedSessionKey(socket.servername || socket.host || 'discord.com', 443);
  socket.on('secureConnect', () => {
    const session = socket.getSession ? socket.getSession() : null;
    if (session) {
      tlsSessionCache.set(key, session);
    }
  });

  return socket;
}

if (https.globalAgent && https.globalAgent.createConnection) {
  const originalCreateConnection = https.globalAgent.createConnection;
  https.globalAgent.createConnection = function (options, callback) {
    const socket = originalCreateConnection.call(this, options, callback);
    return configureSessionReuse(socket);
  };
}

module.exports = {
  dns,
  tlsSessionCache,
  directSocket: net,
  configureSessionReuse,
};
