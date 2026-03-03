/**
 * DSAR Cleanup Job
 * Clears expired export content from DB and archives old completed requests
 */

import DSARRequest from '../models/DSARRequest.js';

class DSARCleanupJob {
  constructor() {
    this.name = 'dsar-cleanup';
    this.schedule = '0 2 * * *'; // Daily at 2 AM
  }

  async run() {
    console.log('🧹 Starting DSAR cleanup job...');
    
    try {
      const results = {
        expiredExportsCleared: 0,
        completedRequestsArchived: 0,
        errors: []
      };

      await this.cleanupExpiredExports(results);
      await this.archiveOldRequests(results);

      console.log('✅ DSAR cleanup job completed:', results);
      return results;
    } catch (error) {
      console.error('❌ DSAR cleanup job failed:', error);
      throw error;
    }
  }

  async cleanupExpiredExports(results) {
    try {
      const now = new Date();
      const expiredRequests = await DSARRequest.find({
        exportExpiresAt: { $exists: true, $ne: null, $lt: now }
      });

      for (const request of expiredRequests) {
        try {
          request.exportUrl = null;
          request.exportFileName = null;
          request.exportContent = null;
          request.exportExpiresAt = null;
          await request.save();
          results.expiredExportsCleared++;
        } catch (error) {
          results.errors.push(`Failed to clear export for ${request.requestId}: ${error.message}`);
        }
      }
    } catch (error) {
      results.errors.push(`Error in cleanupExpiredExports: ${error.message}`);
    }
  }

  async archiveOldRequests(results) {
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      // Find completed requests older than 1 year
      const oldRequests = await DSARRequest.find({
        status: 'completed',
        completedAt: { $lt: oneYearAgo }
      }).limit(100);

      // In a production system, you might move these to an archive collection
      // For now, we'll just add a note
      for (const request of oldRequests) {
        if (!request.notes || !request.notes.includes('[ARCHIVED]')) {
          request.notes = (request.notes || '') + ' [ARCHIVED]';
          await request.save();
          results.completedRequestsArchived++;
        }
      }

      console.log(`📦 Archived ${results.completedRequestsArchived} old requests`);
    } catch (error) {
      results.errors.push(`Error in archiveOldRequests: ${error.message}`);
      throw error;
    }
  }
}

export default new DSARCleanupJob();

