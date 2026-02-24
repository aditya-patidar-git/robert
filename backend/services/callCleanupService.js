import mongoose from 'mongoose';
import CallRecord from '../models/CallRecord.js';

/**
 * Service to periodically clean up stale "In Progress" calls
 * Marks calls as "completed" if they've been in "in-progress" state for too long
 */
class CallCleanupService {
  constructor() {
    this.cleanupInterval = null;
    this.staleThresholdMinutes = parseInt(process.env.STALE_CALL_THRESHOLD_MINUTES || '10', 10);
    this.cleanupIntervalMinutes = parseInt(process.env.CALL_CLEANUP_INTERVAL_MINUTES || '5', 10);
  }

  /**
   * Clean up stale calls that are stuck in "in-progress" state
   * @returns {Promise<number>} Number of calls cleaned up
   */
  async cleanupStaleCalls() {
    try {
      // Wait for MongoDB connection before querying
      if (mongoose.connection.readyState !== 1) {
        console.log('⏳ [CALL CLEANUP] Waiting for MongoDB connection...');
        await new Promise((resolve) => {
          if (mongoose.connection.readyState === 1) {
            resolve();
          } else {
            mongoose.connection.once('connected', resolve);
          }
        });
      }

      const now = new Date();
      const thresholdTime = new Date(now.getTime() - this.staleThresholdMinutes * 60 * 1000);

      // Find calls that are still "in-progress" but were created/updated before threshold
      const staleCalls = await CallRecord.find({
        callStatus: 'in-progress',
        $or: [
          { createdAt: { $lt: thresholdTime } },
          { updatedAt: { $lt: thresholdTime } }
        ]
      });

      if (staleCalls.length === 0) {
        return 0;
      }

      // Calculate duration for each stale call and mark as completed
      const updatePromises = staleCalls.map(async (call) => {
        const duration = call.createdAt 
          ? Math.floor((now - new Date(call.createdAt)) / 1000) 
          : null;

        return CallRecord.findOneAndUpdate(
          { callSid: call.callSid },
          {
            callStatus: 'completed',
            ...(duration && { duration })
          }
        );
      });

      await Promise.all(updatePromises);

      console.log(`🧹 [CALL CLEANUP] Marked ${staleCalls.length} stale call(s) as completed (threshold: ${this.staleThresholdMinutes} minutes)`);
      
      return staleCalls.length;
    } catch (error) {
      console.error('❌ [CALL CLEANUP] Error cleaning up stale calls:', error);
      return 0;
    }
  }

  /**
   * Start the periodic cleanup job
   */
  start() {
    if (this.cleanupInterval) {
      console.log('⚠️ [CALL CLEANUP] Cleanup job already running');
      return;
    }

    console.log(`🔄 [CALL CLEANUP] Starting periodic cleanup job (interval: ${this.cleanupIntervalMinutes} minutes, threshold: ${this.staleThresholdMinutes} minutes)`);
    
    // Run cleanup immediately on start
    this.cleanupStaleCalls();

    // Then run periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleCalls();
    }, this.cleanupIntervalMinutes * 60 * 1000);
  }

  /**
   * Stop the periodic cleanup job
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('🛑 [CALL CLEANUP] Stopped periodic cleanup job');
    }
  }
}

export default new CallCleanupService();

