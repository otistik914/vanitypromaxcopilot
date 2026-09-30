export const appState = {
  startedAt: Date.now(),
  isRunning: false,
  connected: false,
  lastHeartbeat: Date.now(),
  queue: [],
  graceAttempts: new Map()
};
