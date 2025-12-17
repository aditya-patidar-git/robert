// Import io from server (will be available after server initialization)
let io = null;

// Set io instance (called from server.js after initialization)
export const setIO = (ioInstance) => {
  io = ioInstance;
};

import configSyncService from './configSyncService.js';

/**
 * WebSocket Service
 * Manages WebSocket connections for real-time updates
 * Handles config sync, notifications, and client management
 */
class WebSocketService {
  constructor() {
    this.clients = new Map(); // Track connected clients
    // Don't setup handlers in constructor - will be done via initialize()
  }

  /**
   * Initialize event handlers (called after io is set)
   */
  initialize() {
    if (!io) {
      console.warn('⚠️ [WEBSOCKET] Socket.IO server not available');
      return;
    }

    io.on('connection', (socket) => {
      console.log(`✅ [WEBSOCKET] Client connected: ${socket.id}`);
      
      // Track client
      this.clients.set(socket.id, {
        id: socket.id,
        connectedAt: new Date(),
        userAgent: socket.handshake.headers['user-agent'],
        address: socket.handshake.address,
        subscriptions: new Set()
      });

      // Handle client subscription to config types
      socket.on('subscribe_config', (configType) => {
        const client = this.clients.get(socket.id);
        if (client) {
          client.subscriptions.add(configType);
          console.log(`📡 [WEBSOCKET] Client ${socket.id} subscribed to ${configType}`);
        }
      });

      // Handle client unsubscription
      socket.on('unsubscribe_config', (configType) => {
        const client = this.clients.get(socket.id);
        if (client) {
          client.subscriptions.delete(configType);
          console.log(`📡 [WEBSOCKET] Client ${socket.id} unsubscribed from ${configType}`);
        }
      });

      // Handle sync status request
      socket.on('get_sync_status', () => {
        const status = configSyncService.getSyncStatus();
        socket.emit('sync_status', status);
      });

      // Handle config refresh request
      socket.on('refresh_config', (configType) => {
        // Notify all clients to refresh this config type
        io.emit('config_refresh', {
          configType,
          timestamp: new Date().toISOString()
        });
      });

      // Handle client disconnect
      socket.on('disconnect', () => {
        console.log(`❌ [WEBSOCKET] Client disconnected: ${socket.id}`);
        this.clients.delete(socket.id);
      });

      // Send initial sync status
      const initialStatus = configSyncService.getSyncStatus();
      socket.emit('sync_status', initialStatus);
    });
  }

  /**
   * Broadcast config change to specific subscribers
   * @param {string} configType - Config type
   * @param {Object} data - Change data
   */
  broadcastToSubscribers(configType, data) {
    if (!io) return;

    this.clients.forEach((client, socketId) => {
      if (client.subscriptions.has(configType) || client.subscriptions.has('all')) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('config_change', {
            configType,
            ...data
          });
        }
      }
    });
  }

  /**
   * Get connected clients info
   * @returns {Array} Array of client info
   */
  getClients() {
    return Array.from(this.clients.values());
  }

  /**
   * Get client count
   * @returns {number} Number of connected clients
   */
  getClientCount() {
    return this.clients.size;
  }
}

export default new WebSocketService();

