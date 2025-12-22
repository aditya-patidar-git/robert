/**
 * DSAR Cleanup Job
 * Cleans up expired export files and archives completed requests
 */

import DSARRequest from '../models/DSARRequest.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DSARCleanupJob {
  constructor() {
    this.name = 'dsar-cleanup';
    this.schedule = '0 2 * * *'; // Daily at 2 AM
    this.exportsDir = path.join(process.cwd(), 'audit-logs', 'exports');
  }

  async run() {
    console.log('🧹 Starting DSAR cleanup job...');
    
    try {
      const results = {
        expiredExportsDeleted: 0,
        expiredExportsArchived: 0,
        completedRequestsArchived: 0,
        errors: []
      };

      // 1. Clean up expired export files
      await this.cleanupExpiredExports(results);

      // 2. Archive old completed requests (older than 1 year)
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
      
      // Find requests with expired exports
      const expiredRequests = await DSARRequest.find({
        exportExpiresAt: { $exists: true, $lt: now },
        exportUrl: { $exists: true, $ne: null }
      });

      for (const request of expiredRequests) {
        try {
          // Extract filename from export URL
          const urlParts = request.exportUrl.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const filePath = path.join(this.exportsDir, fileName);

          // Delete file if it exists
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            results.expiredExportsDeleted++;
            console.log(`🗑️ Deleted expired export: ${fileName}`);
          }

          // Clear export URL and expiry
          request.exportUrl = null;
          request.exportExpiresAt = null;
          await request.save();
        } catch (error) {
          results.errors.push(`Failed to cleanup export for ${request.requestId}: ${error.message}`);
          console.error(`❌ Error cleaning up export for ${request.requestId}:`, error.message);
        }
      }

      // Also clean up any orphaned files in exports directory
      if (fs.existsSync(this.exportsDir)) {
        const files = fs.readdirSync(this.exportsDir);
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        for (const file of files) {
          const filePath = path.join(this.exportsDir, file);
          const stats = fs.statSync(filePath);
          
          // Delete files older than 1 week that aren't referenced in database
          if (stats.mtime.getTime() < oneWeekAgo) {
            const requestId = file.match(/dsar-export-(.+?)-/)?.[1];
            if (requestId) {
              const request = await DSARRequest.findOne({ requestId });
              if (!request || !request.exportUrl || !request.exportUrl.includes(file)) {
                fs.unlinkSync(filePath);
                results.expiredExportsDeleted++;
                console.log(`🗑️ Deleted orphaned export file: ${file}`);
              }
            }
          }
        }
      }
    } catch (error) {
      results.errors.push(`Error in cleanupExpiredExports: ${error.message}`);
      throw error;
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

