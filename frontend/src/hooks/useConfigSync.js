import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useToast } from '../components/common/ToastProvider';
import configSyncService from '../services/configSyncService';

/**
 * useConfigSync Hook
 * Manages WebSocket connection for real-time config synchronization
 */
const useConfigSync = (configTypes = ['all']) => {
  const { showSuccess, showError } = useToast();
  const [connected, setConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState({});
  const [lastSync, setLastSync] = useState(null);
  const socketRef = useRef(null);
  const subscriptionsRef = useRef(new Set(configTypes));

  // Initialize WebSocket connection
  useEffect(() => {
    // Get backend URL from environment or use default
    // Vite uses import.meta.env instead of process.env
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 
                       import.meta.env.REACT_APP_BACKEND_URL || 
                       'http://localhost:5000';
    
    // Use Socket.IO client (Socket.IO handles protocol automatically)
    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('✅ [CONFIG_SYNC] Connected to WebSocket server');
      setConnected(true);
      
      // Subscribe to config types
      subscriptionsRef.current.forEach(configType => {
        socket.emit('subscribe_config', configType);
      });

      // Request initial sync status
      socket.emit('get_sync_status');
    });

    socket.on('disconnect', () => {
      console.log('❌ [CONFIG_SYNC] Disconnected from WebSocket server');
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ [CONFIG_SYNC] Connection error:', error);
      setConnected(false);
    });

    // Config change events
    socket.on('config_change', (event) => {
      console.log('📡 [CONFIG_SYNC] Config change received:', event);
      
      // Update sync status
      setSyncStatus(prev => ({
        ...prev,
        [event.configType]: {
          status: 'synced',
          lastChange: new Date(event.timestamp),
          lastChangeBy: event.changedBy
        }
      }));
      
      setLastSync(new Date());
      
      // Show notification if not from current user
      if (event.changedBy && event.changedBy !== 'admin') {
        showSuccess(`Configuration updated: ${event.configType}`, 'Config Sync');
      }
    });

    // Sync status events
    socket.on('sync_status', (status) => {
      console.log('📊 [CONFIG_SYNC] Sync status received:', status);
      setSyncStatus(status);
    });

    // Config refresh events
    socket.on('config_refresh', (event) => {
      console.log('🔄 [CONFIG_SYNC] Config refresh requested:', event);
      // Trigger React Query refetch for the config type
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('config_refresh', { detail: event }));
      }
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        subscriptionsRef.current.forEach(configType => {
          socketRef.current.emit('unsubscribe_config', configType);
        });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []); // Empty deps - only run once

  // Subscribe to config type
  const subscribe = useCallback((configType) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('subscribe_config', configType);
      subscriptionsRef.current.add(configType);
    }
  }, []);

  // Unsubscribe from config type
  const unsubscribe = useCallback((configType) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('unsubscribe_config', configType);
      subscriptionsRef.current.delete(configType);
    }
  }, []);

  // Request sync status
  const requestSyncStatus = useCallback(async () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('get_sync_status');
    } else {
      // Fallback to HTTP API
      try {
        const status = await configSyncService.getSyncStatus();
        setSyncStatus(status.syncStatus || status || {});
      } catch (error) {
        console.error('Error fetching sync status:', error);
      }
    }
  }, []);

  // Trigger config refresh
  const triggerRefresh = useCallback(async (configType) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('refresh_config', configType);
    } else {
      // Fallback to HTTP API
      try {
        await configSyncService.refreshConfig(configType);
      } catch (error) {
        console.error('Error refreshing config:', error);
      }
    }
  }, []);

  return {
    connected,
    syncStatus,
    lastSync,
    subscribe,
    unsubscribe,
    requestSyncStatus,
    triggerRefresh
  };
};

export default useConfigSync;

