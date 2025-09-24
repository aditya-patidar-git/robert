import { useEffect, useRef, useState } from 'react';
import socketService from '../services/socketService';

/**
 * Custom hook for socket.io integration with React
 * Provides connection status, event handling, and automatic cleanup
 */
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const eventListenersRef = useRef(new Map());

  useEffect(() => {
    // Initialize connection
    socketService.connect();

    // Setup connection status listeners
    const handleConnect = () => {
      setIsConnected(true);
      setConnectionStatus(socketService.getConnectionStatus());
    };

    const handleDisconnect = (reason) => {
      setIsConnected(false);
      setConnectionStatus(socketService.getConnectionStatus());
      console.log('Socket disconnected:', reason);
    };

    const handleError = (error) => {
      console.error('Socket error:', error);
      setConnectionStatus(socketService.getConnectionStatus());
    };

    // Register callbacks
    socketService.onConnect(handleConnect);
    socketService.onDisconnect(handleDisconnect);
    socketService.onError(handleError);

    // Set initial status
    setConnectionStatus(socketService.getConnectionStatus());
    setIsConnected(socketService.isConnected);

    // Cleanup function
    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('error', handleError);
      
      // Clean up any event listeners registered through this hook
      eventListenersRef.current.forEach((callback, event) => {
        socketService.off(event, callback);
      });
      eventListenersRef.current.clear();
    };
  }, []);

  /**
   * Emit an event to the server
   */
  const emit = (event, data, callback) => {
    return socketService.emit(event, data, callback);
  };

  /**
   * Listen to an event from the server
   * Automatically cleans up on component unmount
   */
  const on = (event, callback) => {
    // Store the callback for cleanup
    eventListenersRef.current.set(event, callback);
    socketService.on(event, callback);
  };

  /**
   * Remove event listener
   */
  const off = (event, callback) => {
    eventListenersRef.current.delete(event);
    socketService.off(event, callback);
  };

  /**
   * Disconnect the socket
   */
  const disconnect = () => {
    socketService.disconnect();
  };

  /**
   * Reconnect the socket
   */
  const reconnect = () => {
    socketService.connect();
  };

  return {
    // Connection status
    isConnected,
    connectionStatus,
    
    // Socket methods
    emit,
    on,
    off,
    disconnect,
    reconnect,
    
    // Direct access to socket service for advanced usage
    socketService
  };
};

export default useSocket;
