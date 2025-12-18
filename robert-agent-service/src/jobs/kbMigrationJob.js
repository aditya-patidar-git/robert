/**
 * KB Migration Job
 * Scheduled job for nightly KB file re-ingestion
 * Runs daily at 1 AM
 */

import kbMigrationService from '../services/kbMigrationService.js';

/**
 * Run KB migration job
 */
async function runKBMigration() {
  try {
    console.log('🔄 [KB MIGRATION JOB] Starting KB migration job...');
    
    const result = await kbMigrationService.migrateFilesToOpenAI();
    
    console.log(`✅ [KB MIGRATION JOB] Migration completed:`);
    console.log(`   - Processed: ${result.filesProcessed}`);
    console.log(`   - Added: ${result.filesAdded}`);
    console.log(`   - Updated: ${result.filesUpdated}`);
    console.log(`   - Skipped: ${result.filesSkipped}`);
    console.log(`   - Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.warn(`⚠️ [KB MIGRATION JOB] ${result.errors.length} errors occurred during migration`);
      result.errors.forEach((error, index) => {
        console.warn(`   Error ${index + 1}: ${error.filePath} - ${error.error}`);
      });
    }
    
    return {
      success: result.errors.length === 0,
      ...result
    };
  } catch (error) {
    console.error('❌ [KB MIGRATION JOB] Error during migration:', error);
    throw error;
  }
}

export default {
  name: 'kb-migration',
  schedule: '0 1 * * *', // Daily at 1 AM
  run: runKBMigration
};

