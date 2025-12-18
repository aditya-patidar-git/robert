/**
 * Memory Cleanup Job
 * Scheduled job to clean up expired call memories
 * Runs daily at 2 AM
 */

import crossCallMemoryService from '../services/crossCallMemoryService.js';

/**
 * Run memory cleanup job
 */
async function runMemoryCleanup() {
  try {
    console.log('🧹 [MEMORY CLEANUP] Starting memory cleanup job...');
    
    const deletedCount = await crossCallMemoryService.cleanupExpiredMemories();
    
    console.log(`✅ [MEMORY CLEANUP] Cleanup completed. Deleted ${deletedCount} expired memories`);
    
    return {
      success: true,
      deletedCount,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ [MEMORY CLEANUP] Error during cleanup:', error);
    throw error;
  }
}

export default {
  name: 'memory-cleanup',
  schedule: '0 2 * * *', // Daily at 2 AM
  run: runMemoryCleanup
};

