/**
 * KB Drift Detection Job
 * Scheduled job for weekly KB drift detection
 * Runs Sunday at 2 AM
 */

import kbDriftDetectionService from '../services/kbDriftDetectionService.js';

/**
 * Run KB drift detection job
 * Note: This requires file-URL mappings to be configured
 */
async function runKBDriftDetection() {
  try {
    console.log('🔍 [KB DRIFT JOB] Starting KB drift detection job...');
    
    // Get file-URL mappings from environment or config
    // Format: JSON string with array of { filePath, url }
    const mappingsEnv = process.env.KB_FILE_URL_MAPPINGS;
    let fileUrlMappings = [];
    
    if (mappingsEnv) {
      try {
        fileUrlMappings = JSON.parse(mappingsEnv);
      } catch (parseError) {
        console.error('❌ [KB DRIFT JOB] Error parsing KB_FILE_URL_MAPPINGS:', parseError);
        // Try auto-detection as fallback
        fileUrlMappings = await kbDriftDetectionService.autoDetectMappings();
      }
    } else {
      // Try auto-detection
      fileUrlMappings = await kbDriftDetectionService.autoDetectMappings();
    }
    
    if (fileUrlMappings.length === 0) {
      console.warn('⚠️ [KB DRIFT JOB] No file-URL mappings found. Skipping drift detection.');
      return {
        success: false,
        error: 'No file-URL mappings configured',
        timestamp: new Date().toISOString()
      };
    }
    
    const report = await kbDriftDetectionService.generateDriftReport(fileUrlMappings);
    
    console.log(`✅ [KB DRIFT JOB] Drift detection completed:`);
    console.log(`   - Total files checked: ${report.totalFiles}`);
    console.log(`   - Stale files found: ${report.staleFiles}`);
    
    if (report.staleFiles > 0) {
      console.warn(`⚠️ [KB DRIFT JOB] Action required: ${report.staleFiles} files are stale and need updating`);
      report.staleFilesList.forEach(stale => {
        console.warn(`   - ${stale.fileName}: ${(stale.difference * 100).toFixed(1)}% difference from live site`);
      });
    }
    
    return {
      success: true,
      ...report
    };
  } catch (error) {
    console.error('❌ [KB DRIFT JOB] Error during drift detection:', error);
    throw error;
  }
}

export default {
  name: 'kb-drift-detection',
  schedule: '0 2 * * 0', // Sunday at 2 AM
  run: runKBDriftDetection
};

