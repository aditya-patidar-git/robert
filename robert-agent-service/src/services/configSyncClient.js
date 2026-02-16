/**
 * Config sync client: connects to backend Socket.io and refreshes config on config_change.
 * When connected, polling can be disabled; when disconnected, polling is re-enabled.
 */
import { io } from 'socket.io-client';

let socket = null;
let configManager = null;

function isConnected() {
  return socket != null && socket.connected;
}

function start(manager) {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    console.warn('⚠️ [CONFIG_SYNC_CLIENT] BACKEND_URL not set, config sync client not started');
    return;
  }
  if (!manager || !manager.refreshByType || typeof manager.setPollingEnabled !== 'function') {
    console.warn('⚠️ [CONFIG_SYNC_CLIENT] ConfigManager required with refreshByType and setPollingEnabled');
    return;
  }
  configManager = manager;
  if (socket) {
    socket.removeAllListeners();
    socket.close();
    socket = null;
  }
  const apiKey = process.env.AGENT_SERVICE_API_KEY || '';
  socket = io(backendUrl, {
    auth: { apiKey },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000
  });

  socket.on('connect', () => {
    console.log('✅ [CONFIG_SYNC_CLIENT] Connected to backend at', backendUrl);
    configManager.setPollingEnabled(false);
  });

  socket.on('disconnect', (reason) => {
    console.log('⚠️ [CONFIG_SYNC_CLIENT] Disconnected:', reason);
    configManager.setPollingEnabled(true);
  });

  socket.on('connect_error', (err) => {
    console.warn('⚠️ [CONFIG_SYNC_CLIENT] Connect error:', err.message);
    configManager.setPollingEnabled(true);
  });

  socket.on('config_change', (event) => {
    const configType = event?.configType;
    if (configType) {
      console.log('📡 [CONFIG_SYNC_CLIENT] Config change received:', configType);
      configManager.refreshByType(configType).catch((err) => {
        console.error('[CONFIG_SYNC_CLIENT] refreshByType failed:', err);
      });
    }
  });
}

function stop() {
  if (socket) {
    socket.removeAllListeners();
    socket.close();
    socket = null;
  }
  if (configManager) {
    configManager.setPollingEnabled(true);
    configManager = null;
  }
  console.log('✅ [CONFIG_SYNC_CLIENT] Stopped');
}

export default {
  start,
  stop,
  isConnected
};
