import { useEffect, useState, useCallback } from 'react';
import socketService from '../services/socketService';

/**
 * Custom hook for tracking backup/restore progress via WebSocket
 * Provides real-time progress updates during long-running backup operations
 */
export const useBackupProgress = () => {
  const [backupProgress, setBackupProgress] = useState(null);
  const [restoreProgress, setRestoreProgress] = useState(null);
  const [isBackupInProgress, setIsBackupInProgress] = useState(false);
  const [isRestoreInProgress, setIsRestoreInProgress] = useState(false);

  useEffect(() => {
    // Ensure socket is connected
    socketService.connect();

    // Handle backup progress events
    const handleBackupProgress = (data) => {
      console.log('📦 Backup progress:', data);
      setBackupProgress(data);
      
      if (data.status === 'started' || data.status === 'in_progress') {
        setIsBackupInProgress(true);
      } else if (data.status === 'completed' || data.status === 'failed') {
        setIsBackupInProgress(false);
        // Clear progress after a short delay to show completion
        if (data.status === 'completed') {
          setTimeout(() => setBackupProgress(null), 3000);
        }
      }
    };

    // Handle restore progress events
    const handleRestoreProgress = (data) => {
      console.log('🔄 Restore progress:', data);
      setRestoreProgress(data);
      
      if (data.status === 'started' || data.status === 'in_progress') {
        setIsRestoreInProgress(true);
      } else if (data.status === 'completed' || data.status === 'completed_with_errors' || data.status === 'failed') {
        setIsRestoreInProgress(false);
        // Clear progress after a short delay to show completion
        if (data.status === 'completed' || data.status === 'completed_with_errors') {
          setTimeout(() => setRestoreProgress(null), 3000);
        }
      }
    };

    // Subscribe to events
    socketService.on('backup_progress', handleBackupProgress);
    socketService.on('restore_progress', handleRestoreProgress);

    // Cleanup
    return () => {
      socketService.off('backup_progress', handleBackupProgress);
      socketService.off('restore_progress', handleRestoreProgress);
    };
  }, []);

  // Reset backup progress manually
  const resetBackupProgress = useCallback(() => {
    setBackupProgress(null);
    setIsBackupInProgress(false);
  }, []);

  // Reset restore progress manually
  const resetRestoreProgress = useCallback(() => {
    setRestoreProgress(null);
    setIsRestoreInProgress(false);
  }, []);

  return {
    backupProgress,
    restoreProgress,
    isBackupInProgress,
    isRestoreInProgress,
    resetBackupProgress,
    resetRestoreProgress
  };
};

export default useBackupProgress;
