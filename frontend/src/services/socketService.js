import { io } from "socket.io-client";

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 1000; // Start with 1 second
    this.maxReconnectInterval = 30000; // Max 30 seconds
    this.reconnectTimeout = null;
    this.eventListeners = new Map();
    this.connectionCallbacks = [];
    this.disconnectionCallbacks = [];
    this.errorCallbacks = [];
  }

  /**
   * Initialize socket connection with comprehensive configuration
   */
  connect(url = null) {
    if (this.socket && this.socket.connected) {
      console.log('Socket already connected');
      return this.socket;
    }

    const SOCKET_URL = url || import.meta.env.VITE_API_BASE || "http://localhost:5000";
    
    console.log(`Connecting to socket server: ${SOCKET_URL}`);

    this.socket = io(SOCKET_URL, {
      // Connection options
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectInterval,
      reconnectionDelayMax: this.maxReconnectInterval,
      timeout: 20000,
      
      // Transport options
      transports: ['websocket', 'polling'],
      upgrade: true,
      
      // Additional options
      forceNew: true,
      multiplex: true,
    });

    this.setupEventListeners();
    return this.socket;
  }

  /**
   * Setup comprehensive event listeners for connection management
   */
  setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Socket connected successfully');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.clearReconnectTimeout();
      this.notifyConnectionCallbacks();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      this.isConnected = false;
      this.notifyDisconnectionCallbacks(reason);
      
      // Handle different disconnect reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, manual reconnect needed
        console.log('Server initiated disconnect, attempting manual reconnect...');
        this.attemptReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('🚨 Socket connection error:', error);
      this.isConnected = false;
      this.notifyErrorCallbacks(error);
      this.handleConnectionError(error);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.notifyConnectionCallbacks();
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}/${this.maxReconnectAttempts}`);
      this.reconnectAttempts = attemptNumber;
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('🚨 Reconnection error:', error);
      this.notifyErrorCallbacks(error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('💥 All reconnection attempts failed');
      this.notifyErrorCallbacks(new Error('All reconnection attempts failed'));
    });

    // Ping/Pong for connection health monitoring
    this.socket.on('ping', () => {
      console.log('🏓 Received ping from server');
    });

    this.socket.on('pong', (latency) => {
      console.log(`🏓 Pong received, latency: ${latency}ms`);
    });
  }

  /**
   * Handle connection errors with fallback mechanisms
   */
  handleConnectionError(error) {
    console.error('Connection error details:', {
      message: error.message,
      description: error.description,
      context: error.context,
      type: error.type
    });

    // Implement fallback mechanisms
    if (error.type === 'TransportError') {
      console.log('Transport error detected, trying fallback transport...');
      this.attemptFallbackConnection();
    }
  }

  /**
   * Attempt fallback connection with different transport
   */
  attemptFallbackConnection() {
    if (this.socket) {
      this.socket.disconnect();
    }

    const SOCKET_URL = import.meta.env.VITE_API_BASE || "http://localhost:5000";
    
    // Try with polling transport as fallback
    this.socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectInterval,
      reconnectionDelayMax: this.maxReconnectInterval,
      timeout: 20000,
      transports: ['polling'], // Force polling transport
      upgrade: false,
      forceNew: true,
    });

    this.setupEventListeners();
  }

  /**
   * Manual reconnection with exponential backoff
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectInterval
    );

    console.log(`Attempting reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      if (this.socket) {
        this.socket.connect();
      }
    }, delay);
  }

  /**
   * Clear reconnection timeout
   */
  clearReconnectTimeout() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Emit event with error handling
   */
  emit(event, data, callback) {
    if (!this.socket || !this.isConnected) {
      console.warn('Socket not connected, cannot emit event:', event);
      if (callback) callback(new Error('Socket not connected'));
      return false;
    }

    try {
      this.socket.emit(event, data, callback);
      return true;
    } catch (error) {
      console.error('Error emitting event:', error);
      if (callback) callback(error);
      return false;
    }
  }

  /**
   * Listen to event with automatic cleanup
   */
  on(event, callback) {
    if (!this.socket) {
      console.warn('Socket not initialized, cannot listen to event:', event);
      return;
    }

    // Store listener for cleanup
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);

    this.socket.on(event, callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (!this.socket) return;

    if (callback) {
      this.socket.off(event, callback);
      // Remove from stored listeners
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    } else {
      this.socket.off(event);
      this.eventListeners.delete(event);
    }
  }

  /**
   * Add connection callback
   */
  onConnect(callback) {
    this.connectionCallbacks.push(callback);
  }

  /**
   * Add disconnection callback
   */
  onDisconnect(callback) {
    this.disconnectionCallbacks.push(callback);
  }

  /**
   * Add error callback
   */
  onError(callback) {
    this.errorCallbacks.push(callback);
  }

  /**
   * Notify connection callbacks
   */
  notifyConnectionCallbacks() {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in connection callback:', error);
      }
    });
  }

  /**
   * Notify disconnection callbacks
   */
  notifyDisconnectionCallbacks(reason) {
    this.disconnectionCallbacks.forEach(callback => {
      try {
        callback(reason);
      } catch (error) {
        console.error('Error in disconnection callback:', error);
      }
    });
  }

  /**
   * Notify error callbacks
   */
  notifyErrorCallbacks(error) {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (error) {
        console.error('Error in error callback:', error);
      }
    });
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      socketId: this.socket?.id || null,
      transport: this.socket?.io?.engine?.transport?.name || null
    };
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      this.clearReconnectTimeout();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
    }
  }

  /**
   * Cleanup all resources
   */
  destroy() {
    this.disconnect();
    this.eventListeners.clear();
    this.connectionCallbacks = [];
    this.disconnectionCallbacks = [];
    this.errorCallbacks = [];
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
