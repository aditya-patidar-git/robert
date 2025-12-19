/**
 * Retention Cleanup Job
 * Scheduled job to clean up expired data per GDPR retention policies
 * Runs daily at 3 AM
 */

import gdprService from '../services/gdprService.js';

/**
 * Run retention cleanup job
 */
async function runRetentionCleanup() {
  try {
    console.log('🧹 [RETENTION CLEANUP] Starting retention cleanup job...');
    
    // Use soft delete by default (configurable via env)
    const softDelete = process.env.GDPR_SOFT_DELETE !== 'false';
    
    const result = await gdprService.runRetentionCleanup(softDelete);
    
    console.log(`✅ [RETENTION CLEANUP] Cleanup completed. Total records cleaned: ${result.totalDeleted}`);
    console.log(`   - Transcripts: ${result.transcripts.deletedCount}`);
    console.log(`   - Recordings: ${result.recordings.deletedCount}`);
    console.log(`   - Metadata: ${result.metadata.deletedCount}`);
    
    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('❌ [RETENTION CLEANUP] Error during cleanup:', error);
    throw error;
  }
}

export default {
  name: 'retention-cleanup',
  schedule: '0 3 * * *', // Daily at 3 AM
  run: runRetentionCleanup
};

