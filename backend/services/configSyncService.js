// Import io from server (will be available after server initialization)
let io = null;

// Set io instance (called from server.js after initialization)
export const setIO = (ioInstance) => {
  io = ioInstance;
};

/**
 * Config Sync Service
 * Manages real-time configuration synchronization across services
 * Uses WebSocket to notify connected clients of configuration changes
 */
class ConfigSyncService {
  constructor() {
    this.syncStatus = new Map(); // Track sync status per service
    this.configWatchers = new Map(); // Track active watchers
  }

  /**
   * Notify all connected clients of a configuration change
   * @param {string} configType - Type of config (e.g., 'ai', 'telephony', 'payment-gateway')
   * @param {string} configId - Config ID (optional)
   * @param {Object} changeData - Change metadata
   */
  notifyConfigChange(configType, configId = null, changeData = {}) {
    const event = {
      type: 'config_change',
      configType,
      configId,
      timestamp: new Date().toISOString(),
      ...changeData
    };

    // Broadcast to all connected clients
    if (io) {
      io.emit('config_change', event);
      console.log(`📡 [CONFIG_SYNC] Broadcasted config change: ${configType}${configId ? ` (${configId})` : ''}`);
    } else {
      console.warn('⚠️ [CONFIG_SYNC] WebSocket server not available');
    }

    // Update sync status
    this.updateSyncStatus(configType, {
      lastChange: new Date(),
      lastChangeBy: changeData.changedBy || 'system',
      status: 'synced'
    });
  }

  /**
   * Register a config watcher (for future database change detection)
   * @param {string} configType - Type of config to watch
   * @param {Function} callback - Callback function when config changes
   */
  registerConfigWatcher(configType, callback) {
    if (!this.configWatchers.has(configType)) {
      this.configWatchers.set(configType, []);
    }
    this.configWatchers.get(configType).push(callback);
    console.log(`👀 [CONFIG_SYNC] Registered watcher for ${configType}`);
  }

  /**
   * Get sync status for all services
   * @returns {Object} Sync status map
   */
  getSyncStatus() {
    const status = {};
    
    // Default config types
    const configTypes = [
      'ai',
      'audio',
      'telephony',
      'privacy',
      'payment-gateway',
      'email-template',
      'sms-template',
      'model-discovery'
    ];

    configTypes.forEach(type => {
      const typeStatus = this.syncStatus.get(type) || {
        status: 'unknown',
        lastSync: null,
        lastChange: null,
        lastChangeBy: null
      };
      
      status[type] = {
        ...typeStatus,
        hasWatcher: this.configWatchers.has(type),
        watcherCount: this.configWatchers.get(type)?.length || 0
      };
    });

    return status;
  }

  /**
   * Get sync status for a specific config type
   * @param {string} configType - Config type
   * @returns {Object} Sync status
   */
  getConfigSyncStatus(configType) {
    return this.syncStatus.get(configType) || {
      status: 'unknown',
      lastSync: null,
      lastChange: null,
      lastChangeBy: null
    };
  }

  /**
   * Update sync status for a config type
   * @param {string} configType - Config type
   * @param {Object} statusData - Status data
   */
  updateSyncStatus(configType, statusData) {
    const currentStatus = this.syncStatus.get(configType) || {};
    this.syncStatus.set(configType, {
      ...currentStatus,
      ...statusData,
      lastSync: new Date()
    });
  }

  /**
   * Mark config as synced
   * @param {string} configType - Config type
   * @param {string} serviceId - Service ID that confirmed sync
   */
  markAsSynced(configType, serviceId) {
    this.updateSyncStatus(configType, {
      status: 'synced',
      lastSyncedBy: serviceId
    });
  }

  /**
   * Mark config as pending sync
   * @param {string} configType - Config type
   */
  markAsPending(configType) {
    this.updateSyncStatus(configType, {
      status: 'pending'
    });
  }

  /**
   * Get connected clients count
   * @returns {number} Number of connected clients
   */
  getConnectedClientsCount() {
    if (!io) return 0;
    return io.sockets.sockets.size;
  }

  /**
   * Get client connection info
   * @returns {Array} Array of client info
   */
  getConnectedClients() {
    if (!io) return [];
    
    const clients = [];
    io.sockets.sockets.forEach((socket, id) => {
      clients.push({
        id,
        connectedAt: socket.handshake.time || new Date(),
        userAgent: socket.handshake.headers['user-agent'],
        address: socket.handshake.address
      });
    });
    
    return clients;
  }
}

export default new ConfigSyncService();

